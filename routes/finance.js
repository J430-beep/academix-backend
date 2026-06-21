const express = require("express");
const router = express.Router();

// ===============================
// 📊 MONTHLY REVENUE ANALYTICS
// ===============================
router.get("/analytics/revenue", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { school_id } = req.query;

        const { data, error } = await supabase
            .from("mpesa_payments")
            .select("amount, created_at")
            .eq("school_id", school_id)
            .eq("status", "SUCCESS");

        if (error) return res.status(400).json({ error: error.message });

        const monthly = {};

        data.forEach(p => {
            const month = new Date(p.created_at).toISOString().slice(0, 7); // YYYY-MM
            monthly[month] = (monthly[month] || 0) + Number(p.amount);
        });

        res.json(monthly);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// 📉 STUDENT DEBT TRACKING
// ===============================
router.get("/analytics/debts", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { school_id } = req.query;

        const { data } = await supabase
            .from("fees")
            .select(`
                total_fee,
                paid_amount,
                student_id,
                students(full_name)
            `)
            .eq("school_id", school_id);

        const result = data.map(f => {
            const balance = (f.total_fee || 0) - (f.paid_amount || 0);

            return {
                student: f.students?.full_name,
                balance
            };
        });

        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// 🧾 FINANCE SUMMARY DASHBOARD
// ===============================
router.get("/analytics/summary", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { school_id } = req.query;

        const { data: fees } = await supabase
            .from("fees")
            .select("total_fee, paid_amount")
            .eq("school_id", school_id);

        const { data: payments } = await supabase
            .from("mpesa_payments")
            .select("amount")
            .eq("school_id", school_id)
            .eq("status", "SUCCESS");

        let totalExpected = 0;
        let totalPaidFees = 0;
        let totalMpesa = 0;

        fees.forEach(f => {
            totalExpected += Number(f.total_fee || 0);
            totalPaidFees += Number(f.paid_amount || 0);
        });

        payments.forEach(p => {
            totalMpesa += Number(p.amount || 0);
        });

        res.json({
            totalExpected,
            totalPaidFees,
            totalMpesa,
            balance: totalExpected - totalPaidFees
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// 🔔 PAYMENT STATUS UPDATER (CALLBACK FIX)
// ===============================
router.post("/mpesa/callback", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const stk = req.body.Body.stkCallback;
        const checkoutId = stk.CheckoutRequestID;

        if (stk.ResultCode !== 0) {
            await supabase
                .from("mpesa_payments")
                .update({ status: "FAILED" })
                .eq("checkout_request_id", checkoutId);

            return res.json({ ResultCode: 0 });
        }

        const items = stk.CallbackMetadata.Item;

        const amount = items.find(i => i.Name === "Amount")?.Value;
        const phone = items.find(i => i.Name === "PhoneNumber")?.Value;
        const receipt = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;

        await supabase
            .from("mpesa_payments")
            .update({
                amount,
                phone,
                receipt,
                status: "SUCCESS"
            })
            .eq("checkout_request_id", checkoutId);

        res.json({ ResultCode: 0 });

    } catch (err) {
        console.error(err);
        res.json({ ResultCode: 0 });
    }
});


// ===============================
// 🤖 FINANCE INSIGHTS (AI READY)
// ===============================
router.get("/analytics/insights", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { school_id } = req.query;

        const { data } = await supabase
            .from("mpesa_payments")
            .select("amount, status")
            .eq("school_id", school_id);

        const total = data.length;
        const success = data.filter(p => p.status === "SUCCESS").length;
        const failed = data.filter(p => p.status === "FAILED").length;

        res.json({
            totalTransactions: total,
            successRate: total ? (success / total) * 100 : 0,
            failedRate: total ? (failed / total) * 100 : 0
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

