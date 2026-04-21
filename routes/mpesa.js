const express = require("express");
const axios = require("axios");
const moment = require("moment");
const router = express.Router();

const BASE_URL = process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ===============================
// GET TOKEN (GLOBAL)
// ===============================
async function getToken() {
    const auth = Buffer.from(
        process.env.MPESA_CONSUMER_KEY + ":" +
        process.env.MPESA_CONSUMER_SECRET
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

        // ✅ CHECK SCHOOL EXISTS ONLY
        const { data: school } = await supabase
            .from("schools")
            .select("id, name")
            .eq("id", school_id)
            .single();

        if (!school) {
            return res.status(404).json({ error: "School not found" });
        }

        // ✅ GET TOKEN (GLOBAL)
        const token = await getToken();

        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            process.env.MPESA_SHORTCODE +
            process.env.MPESA_PASSKEY +
            timestamp
        ).toString("base64");

        const cleanPhone = phone
            .replace(/\s/g, "")
            .replace(/^\+/, "")
            .replace(/^0/, "254");

        const payload = {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: cleanPhone,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: cleanPhone,
            CallBackURL: process.env.MPESA_CALLBACK,
            AccountReference: school.name,
            TransactionDesc: "AcademiX Subscription"
        };

        console.log("STK PAYLOAD:", payload);

        // SAVE PAYMENT
        const { data: payment } = await supabase
            .from("mpesa_payments")
            .insert([{
                school_id,
                phone: cleanPhone,
                amount,
                status: "PENDING"
            }])
            .select()
            .single();

        // SEND STK
        const response = await axios.post(
            `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const stk = response.data;

        // SAVE IDS
        await supabase
            .from("mpesa_payments")
            .update({
                checkout_request_id: stk.CheckoutRequestID,
                merchant_request_id: stk.MerchantRequestID
            })
            .eq("id", payment.id);

        return res.json({
            success: true,
            message: "STK Push sent",
            data: stk
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

        // ✅ ACTIVATE SUBSCRIPTION
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