const express = require("express");
const axios = require("axios");
const moment = require("moment");
const router = express.Router();

// ===============================
// GET TOKEN
// ===============================
async function getToken(consumerKey, consumerSecret) {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const res = await axios.get(
        "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
            headers: {
                Authorization: `Basic ${auth}`
            }
        }
    );

    return res.data.access_token;
}

// ===============================
// STK PUSH (FULL FIXED)
// ===============================
router.post("/stkpush", async (req, res) => {
    try {
        const { school_id, phone, amount, student_id } = req.body;

        const supabase = req.app.locals.supabase;

        // ===============================
        // 1. GET SCHOOL
        // ===============================
        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .select("*")
            .eq("id", school_id)
            .single();

        if (!school || schoolError) {
            return res.status(404).json({ error: "School not found" });
        }

        // ===============================
        // 2. GET TOKEN
        // ===============================
        const token = await getToken(
            school.consumer_key,
            school.consumer_secret
        );

        // ===============================
        // 3. FORMAT DATA
        // ===============================
        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            school.mpesa_shortcode + school.mpesa_passkey + timestamp
        ).toString("base64");

        const cleanPhone = phone.replace(/^0/, "254");

        const payload = {
            BusinessShortCode: school.mpesa_shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: cleanPhone,
            PartyB: school.mpesa_shortcode,
            PhoneNumber: cleanPhone,
            CallBackURL: school.callback_url,
            AccountReference: school.name,
            TransactionDesc: "School Fee Payment"
        };

        // ===============================
        // 4. SAVE PENDING PAYMENT
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
        // 5. SEND STK PUSH
        // ===============================
        const response = await axios.post(
            "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const stkData = response.data;

        // ===============================
        // 6. SAVE STK IDS (IMPORTANT FIX)
        // ===============================
        await supabase
            .from("mpesa_payments")
            .update({
                checkout_request_id: stkData.CheckoutRequestID,
                merchant_request_id: stkData.MerchantRequestID
            })
            .eq("id", payment.id);

        // ===============================
        // 7. RETURN RESPONSE
        // ===============================
        return res.json({
            success: true,
            message: "STK Push sent",
            data: stkData
        });

    } catch (err) {
        console.error("STK ERROR:", err.response?.data || err.message);
        res.status(500).json({ error: "STK Push failed" });
    }
});

// ===============================
// CALLBACK (FULL FIXED)
// ===============================
router.post("/callback", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const stk = req.body?.Body?.stkCallback;

        if (!stk) return res.json({ ResultCode: 0 });

        const checkoutId = stk.CheckoutRequestID;

        // ===============================
        // 1. AVOID DUPLICATE PROCESSING
        // ===============================
        const { data: existing } = await supabase
            .from("mpesa_payments")
            .select("id, status")
            .eq("checkout_request_id", checkoutId)
            .single();

        if (existing?.status === "SUCCESS") {
            return res.json({ ResultCode: 0, ResultDesc: "Already processed" });
        }

        // ===============================
        // 2. FAILED PAYMENT
        // ===============================
        if (stk.ResultCode !== 0) {
            await supabase
                .from("mpesa_payments")
                .update({ status: "FAILED" })
                .eq("checkout_request_id", checkoutId);

            return res.json({ ResultCode: 0, ResultDesc: "Failed" });
        }

        // ===============================
        // 3. EXTRACT DATA SAFELY
        // ===============================
        const items = stk.CallbackMetadata?.Item || [];

        const amount = items.find(i => i.Name === "Amount")?.Value || 0;
        const phone = items.find(i => i.Name === "PhoneNumber")?.Value;
        const receipt = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;

        // ===============================
        // 4. UPDATE PAYMENT
        // ===============================
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
            if (payment) {

    await supabase
        .from("subscriptions")
        .upsert({
            school_id: payment.school_id,   // link school
            status: "active",              // unlock system
            plan: "basic",                 // default plan
            start_date: new Date(),        // now
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });
}

        // ===============================
        // 5. FEES LOGIC (SAFE)
        // ===============================
        if (payment?.student_id) {

            const { data: fee } = await supabase
                .from("fees")
                .select("paid_amount")
                .eq("student_id", payment.student_id)
                .single();

            const newPaid = (fee?.paid_amount || 0) + Number(amount);

            await supabase
                .from("fees")
                .update({ paid_amount: newPaid })
                .eq("student_id", payment.student_id);
        }

        // ===============================
        // 6. SUBSCRIPTION ACTIVATION (KEY SAAS LOGIC)
        // ===============================
        const { data: school } = await supabase
            .from("schools")
            .select("id, plan")
            .eq("id", payment.school_id)
            .single();

        if (school) {
            await supabase
                .from("subscriptions")
                .upsert({
                    school_id: school.id,
                    status: "active",
                    start_date: new Date(),
                    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    plan: school.plan
                });
        }

        return res.json({ ResultCode: 0, ResultDesc: "Success" });

    } catch (err) {
        console.error("CALLBACK ERROR:", err);
        res.json({ ResultCode: 0 });
    }
});

module.exports = router;