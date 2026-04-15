const express = require("express");
const axios = require("axios");
const moment = require("moment");
const router = express.Router();

// ===============================
// GET TOKEN (per school)
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
// STK PUSH (MULTI SCHOOL)
// ===============================
router.post("/stkpush", async (req, res) => {
    try {
        const { school_id, phone, amount } = req.body;

        const supabase = req.app.locals.supabase;

        // 1. Get school config
        const { data: school } = await supabase
            .from("schools")
            .select("*")
            .eq("id", school_id)
            .single();

        if (!school) {
            return res.status(404).json({ error: "School not found" });
        }

        // 2. Get token
        const token = await getToken(
            school.consumer_key,
            school.consumer_secret
        );

        // 3. Prepare STK data
        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            school.mpesa_shortcode + school.mpesa_passkey + timestamp
        ).toString("base64");

        const payload = {
            BusinessShortCode: school.mpesa_shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone.replace(/^0/, "254"),
            PartyB: school.mpesa_shortcode,
            PhoneNumber: phone.replace(/^0/, "254"),
            CallBackURL: school.callback_url,
            AccountReference: school.name,
            TransactionDesc: "School Fee Payment"
        };

        // 4. Send request
        const response = await axios.post(
            "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        res.json(response.data);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: "STK Push failed" });
    }
});

// ===============================
// CALLBACK (ALL SCHOOLS)
// ===============================
router.post("/callback", async (req, res) => {
    try {
        const data = req.body;

        const result = data.Body.stkCallback;

        if (result.ResultCode === 0) {

            const items = result.CallbackMetadata.item;

            const amount = items.find(i => i.Name === "Amount").Value;
            const phone = items.find(i => i.Name === "PhoneNumber").Value;
            const receipt = items.find(i => i.Name === "MpesaReceiptNumber").Value;

            const supabase = req.app.locals.supabase;

            // Save payment
            await supabase.from("mpesa_payments").insert([
                {
                    phone,
                    amount,
                    receipt,
                    status: "SUCCESS"
                }
            ]);
        }

        res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (err) {
        console.error(err);
        res.json({ received: true });
    }
});

module.exports = router;