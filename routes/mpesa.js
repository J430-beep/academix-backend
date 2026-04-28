const express = require("express");
const axios = require("axios");
const moment = require("moment");
const router = express.Router();

// ===============================
// MPESA BASE URL
// ===============================
const BASE_URL =
    process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

// ===============================
// FORMAT PHONE (IMPORTANT FIX)
// ===============================
function formatPhone(phone) {
    if (!phone) return null;

    let clean = phone.toString().replace(/\s/g, "");

    if (clean.startsWith("+")) {
        clean = clean.substring(1);
    }

    if (clean.startsWith("0")) {
        clean = "254" + clean.substring(1);
    }

    if (clean.startsWith("7")) {
        clean = "254" + clean;
    }

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
// STK PUSH
// ===============================
router.post("/stkpush", async (req, res) => {
    try {
        const { school_id, phone, amount } = req.body;

        const supabase = req.app.locals.supabase;

        // ===============================
        // VALIDATION
        // ===============================
        if (!school_id || !phone || !amount) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        const cleanPhone = formatPhone(phone);

        if (!cleanPhone || cleanPhone.length !== 12) {
            return res.status(400).json({
                error: "Invalid phone number format"
            });
        }

        const safeAmount = Number(amount);

        if (!safeAmount || safeAmount <= 0) {
            return res.status(400).json({
                error: "Invalid amount"
            });
        }

        // ===============================
        // GET SCHOOL
        // ===============================
        const { data: school, error } = await supabase
            .from("schools")
            .select("id, name")
            .eq("id", school_id)
            .single();

        if (error || !school) {
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

        const callbackURL =
            process.env.MPESA_CALLBACK ||
            "https://academix-backend-pe8o.onrender.com/api/mpesa/callback";

        // ===============================
        // DEBUG LOG
        // ===============================
        console.log("🔥 MPESA REQUEST DEBUG:");
        console.log({
            phone: cleanPhone,
            amount: safeAmount,
            school: school.name
        });

        // ===============================
        // PAYLOAD
        // ===============================
        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: safeAmount,
            PartyA: cleanPhone,
            PartyB: shortcode,
            PhoneNumber: cleanPhone,
            CallBackURL: callbackURL,
            AccountReference: school.name,
            TransactionDesc: "AcademiX Payment"
        };

        // ===============================
        // SAVE PAYMENT
        // ===============================
        const { data: payment } = await supabase
            .from("mpesa_payments")
            .insert([
                {
                    school_id,
                    phone: cleanPhone,
                    amount: safeAmount,
                    status: "PENDING"
                }
            ])
            .select()
            .single();

        // ===============================
        // MPESA REQUEST
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

        console.log("🔥 MPESA RESPONSE:");
        console.log(JSON.stringify(response.data, null, 2));

        // ===============================
        // UPDATE PAYMENT
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
            message: "STK Push sent",
            data: response.data
        });

    } catch (err) {
        console.log("🔥 MPESA FULL ERROR START 🔥");

        if (err.response) {
            console.log("STATUS:", err.response.status);
            console.log("DATA:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.log("ERROR:", err.message);
        }

        console.log("🔥 MPESA FULL ERROR END 🔥");

        return res.status(500).json({
            success: false,
            error: err.response?.data?.errorMessage || "STK Push failed",
            details: err.response?.data || err.message
        });
    }
});

// ===============================
// CALLBACK
// ===============================
router.post("/callback", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const stk = req.body?.Body?.stkCallback;

        if (!stk) return res.json({ ResultCode: 0 });

        const checkoutId = stk.CheckoutRequestID;

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
                amount,
                receipt,
                status: "SUCCESS"
            })
            .eq("checkout_request_id", checkoutId)
            .select()
            .single();

        // Activate subscription
        if (payment) {
            await supabase.from("subscriptions").upsert({
                school_id: payment.school_id,
                status: "active",
                plan: "basic",
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