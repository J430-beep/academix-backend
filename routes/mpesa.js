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
// PLAN PRICING (SERVER CONTROLLED)
// ===============================
const PLAN_PRICING = {
    basic: 1000,
    pro: 2500,
    premium: 5000
};

// ===============================
// FORMAT PHONE (SAFARI STANDARD)
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
// STK PUSH (PRODUCTION SaaS)
// ===============================
router.post("/stkpush", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { school_id, phone, plan } = req.body;

        // ===============================
        // VALIDATION
        // ===============================
        if (!school_id || !phone || !plan) {
            return res.status(400).json({
                error: "school_id, phone, plan required"
            });
        }

        if (!PLAN_PRICING[plan]) {
            return res.status(400).json({
                error: "Invalid subscription plan"
            });
        }

        const amount = PLAN_PRICING[plan];

        const cleanPhone = formatPhone(phone);

        if (!cleanPhone || cleanPhone.length !== 12) {
            return res.status(400).json({
                error: "Invalid phone number"
            });
        }

        // ===============================
        // CHECK SCHOOL EXISTS
        // ===============================
        const { data: school } = await supabase
            .from("schools")
            .select("id, name")
            .eq("id", school_id)
            .single();

        if (!school) {
            return res.status(404).json({
                error: "School not found"
            });
        }

        // ===============================
        // TOKEN
        // ===============================
        const token = await getToken();

        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;

        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            shortcode + passkey + timestamp
        ).toString("base64");

        // ===============================
        // CALLBACK
        // ===============================
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
        // SAVE PAYMENT FIRST (PENDING)
        // ===============================
        const { data: payment } = await supabase
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

        // ===============================
        // SEND STK PUSH
        // ===============================
        const response = await axios.post(
            `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        console.log("🔥 STK RESPONSE:", response.data);

        // ===============================
        // UPDATE PAYMENT IDS
        // ===============================
        await supabase
            .from("mpesa_payments")
            .update({
                checkout_request_id: response.data.CheckoutRequestID,
                merchant_request_id: response.data.MerchantRequestID
            })
            .eq("id", payment.id);

        return res.json({
            success: true,
            message: "STK Push sent successfully",
            checkout: response.data.CheckoutRequestID,
            amount,
            plan
        });

    } catch (err) {
        console.log("🔥 MPESA ERROR:", err.response?.data || err.message);

        return res.status(500).json({
            success: false,
            error: err.response?.data?.errorMessage || "STK Push failed"
        });
    }
});

// ===============================
// CALLBACK (PRODUCTION SAFE)
// ===============================
router.post("/callback", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const stk = req.body?.Body?.stkCallback;

        if (!stk) return res.json({ ResultCode: 0 });

        const checkoutId = stk.CheckoutRequestID;

        // ===============================
        // FAILED PAYMENT
        // ===============================
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

        // ===============================
        // UPDATE PAYMENT
        // ===============================
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

        // ===============================
        // ACTIVATE SUBSCRIPTION (SAAS CORE)
        // ===============================
        if (payment) {
            await supabase.from("subscriptions").upsert({
                school_id: payment.school_id,
                status: "active",
                plan: payment.plan,
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