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
// GET TOKEN (GLOBAL)
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
// STK PUSH (GLOBAL MULTI-SCHOOL)
// ===============================
router.post("/stkpush", async (req, res) => {
    try {
        const { school_id, phone, amount } = req.body;

        const supabase = req.app.locals.supabase;

        // ===============================
        // VALIDATE INPUT
        // ===============================
        if (!school_id || !phone || !amount) {
            return res.status(400).json({
                error: "Missing required fields"
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
        // CHECK MPESA CONFIG
        // ===============================
        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;

        if (!shortcode || !passkey) {
            return res.status(500).json({
                error: "Missing MPESA config in .env"
            });
        }

        // ===============================
        // TOKEN
        // ===============================
        const token = await getToken();

        // ===============================
        // FORMAT
        // ===============================
        const timestamp = moment().format("YYYYMMDDHHmmss");

        const password = Buffer.from(
            shortcode + passkey + timestamp
        ).toString("base64");

        const cleanPhone = phone
            .replace(/\s/g, "")
            .replace("+", "")
            .replace(/^0/, "254");

        const callbackURL =
            process.env.MPESA_CALLBACK ||
            "https://academix-backend-pe8o.onrender.com/api/mpesa/callback";

        // ===============================
        // DEBUG LOG (IMPORTANT)
        // ===============================
        console.log("🔥 MPESA REQUEST:");
        console.log({
            shortcode,
            phone: cleanPhone,
            amount,
            callbackURL
        });

        // ===============================
        // PAYLOAD
        // ===============================
        const payload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Number(amount),
            PartyA: cleanPhone,
            PartyB: shortcode,
            PhoneNumber: cleanPhone,
            CallBackURL: callbackURL,
            AccountReference: school.name,
            TransactionDesc: "School Payment"
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
                    amount,
                    status: "PENDING"
                }
            ])
            .select()
            .single();

        // ===============================
        // CALL MPESA
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
        console.log(response.data);

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
            message: "STK Push sent",
            data: response.data
        });

    } catch (err) {
        console.log("🔥 MPESA ERROR START 🔥");

        if (err.response) {
            console.log("STATUS:", err.response.status);
            console.log("DATA:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.log("ERROR:", err.message);
        }

        console.log("🔥 MPESA ERROR END 🔥");

        return res.status(500).json({
            success: false,
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

        // ACTIVATE SUBSCRIPTION
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