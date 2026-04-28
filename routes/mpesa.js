const express = require("express");
const axios = require("axios");
const moment = require("moment");

const router = express.Router();

// ===============================
// CONFIG
// ===============================
const BASE_URL =
    process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

// ===============================
// PLAN PRICING (SAAS CONTROLLED)
// ===============================
const PLAN_PRICING = {
    basic: 1000,
    pro: 2500,
    premium: 5000
};

// ===============================
// PHONE FORMATTER
// ===============================
function formatPhone(phone) {
    if (!phone) return null;

    let clean = phone.toString().replace(/\s/g, "");

    if (clean.startsWith("+")) clean = clean.slice(1);
    if (clean.startsWith("0")) clean = "254" + clean.slice(1);
    if (clean.startsWith("7")) clean = "254" + clean;

    return clean;
}

// ===============================
// GET TOKEN
// ===============================
async function getToken() {
    const auth = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const res = await axios.get(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        {
            headers: {
                Authorization: `Basic ${auth}`
            }
        }
    );

    return res.data.access_token;
}

// ===============================
// STK PUSH (PRODUCTION SAFE)
// ===============================
router.post("/stkpush", async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const { school_id, phone, plan } = req.body;

        // ===============================
        // VALIDATION
        // ===============================
        if (!school_id || !phone || !plan) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        if (!PLAN_PRICING[plan]) {
            return res.status(400).json({
                success: false,
                error: "Invalid plan"
            });
        }

        const amount = PLAN_PRICING[plan];
        const cleanPhone = formatPhone(phone);

        if (!cleanPhone || cleanPhone.length !== 12) {
            return res.status(400).json({
                success: false,
                error: "Invalid phone number"
            });
        }

        // ===============================
        // VERIFY SCHOOL
        // ===============================
        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("id, name")
            .eq("id", school_id)
            .single();

        if (schoolError || !school) {
            return res.status(404).json({
                success: false,
                error: "School not found"
            });
        }

        // ===============================
        // GET TOKEN
        // ===============================
        const token = await getToken();

        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;

        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            shortcode + passkey + timestamp
        ).toString("base64");

        const callbackURL =
            process.env.MPESA_CALLBACK ||
            "https://academix-backend-pe8o.onrender.com/api/mpesa/callback";

        // ===============================
        // STK PAYLOAD
        // ===============================
        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: cleanPhone,
            PartyB: shortcode,
            PhoneNumber: cleanPhone,
            CallBackURL: callbackURL,
            AccountReference: `${school.name}-${plan}`,
            TransactionDesc: `AcademiX ${plan} subscription`
        };

        console.log("🔥 STK REQUEST:", payload);

        // ===============================
        // CREATE PAYMENT (SAFE INSERT)
        // ===============================
        const { data: payment, error: insertError } = await supabase
            .from("mpesa_payments")
            .insert([
                {
                    school_id,
                    phone: cleanPhone,
                    amount,
                    plan,
                    status: "PENDING"
                }
            ])
            .select()
            .single();

        if (insertError || !payment) {
            console.log("❌ DB INSERT FAILED:", insertError);

            return res.status(500).json({
                success: false,
                error: "Payment record failed"
            });
        }

        // ===============================
        // SEND STK PUSH
        // ===============================
        const response = await axios.post(
            `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                timeout: 20000
            }
        );

        console.log("🔥 STK RESPONSE:", response.data);

        const checkout =
            response.data?.CheckoutRequestID ||
            response.data?.checkoutRequestID;

        const merchant =
            response.data?.MerchantRequestID ||
            response.data?.merchantRequestID;

        if (!checkout) {
            return res.status(500).json({
                success: false,
                error: "STK not accepted by Safaricom",
                raw: response.data
            });
        }

        // ===============================
        // UPDATE PAYMENT
        // ===============================
        await supabase
            .from("mpesa_payments")
            .update({
                checkout_request_id: checkout,
                merchant_request_id: merchant
            })
            .eq("id", payment.id);

        return res.json({
            success: true,
            message: "STK Push sent",
            checkout,
            plan,
            amount
        });

    } catch (err) {
        console.log("🔥 MPESA ERROR:", err.response?.data || err.message);

        return res.status(500).json({
            success: false,
            error: err.response?.data?.errorMessage || "STK Push failed",
            details: err.response?.data || err.message
        });
    }
});

// ===============================
// CALLBACK (SUBSCRIPTION ACTIVATION)
// ===============================
router.post("/callback", async (req, res) => {
    const supabase = req.app.locals.supabase;

    try {
        const stk = req.body?.Body?.stkCallback;

        if (!stk) return res.json({ ResultCode: 0 });

        const checkoutId = stk.CheckoutRequestID;

        // FAILED PAYMENT
        if (stk.ResultCode !== 0) {
            await supabase
                .from("mpesa_payments")
                .update({ status: "FAILED" })
                .eq("checkout_request_id", checkoutId);

            return res.json({ ResultCode: 0 });
        }

        const items = stk.CallbackMetadata?.Item || [];

        const amount = items.find(i => i.Name === "Amount")?.Value;
        const receipt = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;

        const { data: payment } = await supabase
            .from("mpesa_payments")
            .update({
                status: "SUCCESS",
                amount,
                receipt
            })
            .eq("checkout_request_id", checkoutId)
            .select()
            .single();

        // ACTIVATE SUBSCRIPTION
        if (payment) {
            await supabase.from("subscriptions").upsert({
                school_id: payment.school_id,
                plan: payment.plan,
                status: "active",
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }

        return res.json({ ResultCode: 0 });

    } catch (err) {
        console.log("CALLBACK ERROR:", err.message);
        return res.json({ ResultCode: 0 });
    }
});

module.exports = router;