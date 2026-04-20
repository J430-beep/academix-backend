const express = require("express");
const axios = require("axios");
const moment = require("moment");
const router = express.Router();

// ===============================
// CONFIG (AUTO SWITCH SANDBOX/PROD)
// ===============================
const BASE_URL = process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ===============================
// GET TOKEN
// ===============================
async function getToken(consumerKey, consumerSecret) {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

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
        const { school_id, phone, amount, student_id } = req.body;

        const supabase = req.app.locals.supabase;

        // ===============================
        // GET SCHOOL
        // ===============================
        const { data: school, error } = await supabase
            .from("schools")
            .select("*")
            .eq("id", school_id)
            .single();

        if (!school || error) {
            return res.status(404).json({ error: "School not found" });
        }

        if (!school.consumer_key || !school.consumer_secret) {
            return res.status(400).json({ error: "Missing MPESA keys" });
        }

        // ===============================
        // GET TOKEN
        // ===============================
        const token = await getToken(
            school.consumer_key,
            school.consumer_secret
        );

        // ===============================
        // FORMAT DATA
        // ===============================
        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            school.mpesa_shortcode + school.mpesa_passkey + timestamp
        ).toString("base64");

        const cleanPhone = phone
            .replace(/\s/g, "")
            .replace(/^\+/, "")
            .replace(/^0/, "254");

        const payload = {
            BusinessShortCode: school.mpesa_shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: cleanPhone,
            PartyB: school.mpesa_shortcode,
            PhoneNumber: cleanPhone,
            CallBackURL: school.callback_url ||
                "https://your-backend.onrender.com/api/mpesa/callback",
            AccountReference: school.name,
            TransactionDesc: "School Fee Payment"
        };

        console.log("STK PAYLOAD:", payload);

        // ===============================
        // SAVE PAYMENT (PENDING)
        // ===============================
        const { data: payment } = await supabase
            .from("mpesa_payments")
            .insert([{
                school_id,
                student_id: student_id || null,
                phone: cleanPhone,
                amount,
                status: "PENDING"
            }])
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

        const stkData = response.data;

        // ===============================
        // UPDATE PAYMENT WITH IDS
        // ===============================
        await supabase
            .from("mpesa_payments")
            .update({
                checkout_request_id: stkData.CheckoutRequestID,
                merchant_request_id: stkData.MerchantRequestID
            })
            .eq("id", payment.id);

        return res.json({
            success: true,
            message: "STK Push sent successfully",
            data: stkData
        });

    } catch (err) {
        console.error("STK ERROR:", err.response?.data || err.message);
        res.status(500).json({
            error: "STK Push failed",
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

        // FAILED
        if (stk.ResultCode !== 0) {
            await supabase
                .from("mpesa_payments")
                .update({ status: "FAILED" })
                .eq("checkout_request_id", checkoutId);

            return res.json({ ResultCode: 0 });
        }

        const items = stk.CallbackMetadata?.Item || [];

        const amount = items.find(i => i.Name === "Amount")?.Value;
        const phone = items.find(i => i.Name === "PhoneNumber")?.Value;
        const receipt = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;

        const { data: payment } = await supabase
            .from("mpesa_payments")
            .update({
                amount,
                phone,
                receipt,
                status: "SUCCESS"
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
                plan: "basic",
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }

        return res.json({ ResultCode: 0 });

    } catch (err) {
        console.error("CALLBACK ERROR:", err.message);
        res.json({ ResultCode: 0 });
    }
});

module.exports = router;