const express = require('express');
const axios = require('axios');
const moment = require('moment');

const router = express.Router();

// ====== CONFIG ======
const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = "174379"; // sandbox
const passkey = process.env.MPESA_PASSKEY;

// ====== GET ACCESS TOKEN ======
async function getAccessToken() {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const res = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
            headers: {
                Authorization: `Basic ${auth}`
            }
        }
    );

    return res.data.access_token;
}

// ====== STK PUSH ======
router.post('/stkpush', async (req, res) => {
    try {
        const { phone, amount } = req.body;

        const token = await getAccessToken();

        const timestamp = moment().format('YYYYMMDDHHmmss');

        const password = Buffer.from(
            shortcode + passkey + timestamp
        ).toString('base64');

        const data = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: "https://your-backend-url.onrender.com/api/mpesa/callback",
            AccountReference: "School Fees",
            TransactionDesc: "Fee Payment"
        };

        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            data,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        res.json(response.data);

    } catch (error) {
        console.log(error.response?.data || error.message);
        res.status(500).json({ error: "STK Push failed" });
    }
});

// ====== CALLBACK ======
router.post('/callback', (req, res) => {
    console.log("M-PESA CALLBACK:", JSON.stringify(req.body, null, 2));

    res.json({ message: "Callback received" });
});

module.exports = router;