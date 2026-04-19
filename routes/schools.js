const express = require('express');
const router = express.Router();

// ===============================
// REGISTER SCHOOL (SAAS SAFE VERSION)
// ===============================
router.post('/register', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const {
            name,
            mpesa_shortcode,
            mpesa_passkey,
            plan = "basic" // default plan
        } = req.body;

        // ===============================
        // 1. VALIDATION
        // ===============================
        if (!name) {
            return res.status(400).json({ error: "School name required" });
        }

        if (!mpesa_shortcode || !mpesa_passkey) {
            return res.status(400).json({ error: "MPESA credentials required" });
        }

        // ===============================
        // 2. PREVENT DUPLICATE SCHOOLS
        // ===============================
        const { data: existing } = await supabase
            .from('schools')
            .select('id')
            .eq('name', name)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({
                error: "School already exists"
            });
        }

        // ===============================
        // 3. CREATE SCHOOL
        // ===============================
        const { data: school, error } = await supabase
            .from('schools')
            .insert([
                {
                    name,
                    mpesa_shortcode,
                    mpesa_passkey,
                    plan
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // ===============================
        // 4. CREATE SUBSCRIPTION (IMPORTANT FOR MONEY)
        // ===============================
        await supabase.from('subscriptions').insert([
            {
                school_id: school.id,
                status: "inactive",
                plan: plan,
                amount: plan === "basic" ? 1000 : plan === "pro" ? 3000 : 5000,
                start_date: null,
                end_date: null
            }
        ]);

        // ===============================
        // 5. RESPONSE
        // ===============================
        res.status(201).json({
            message: "School registered successfully",
            school_id: school.id,
            plan,
            subscription: "created (inactive)"
        });

    } catch (err) {
        console.error("School register error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ===============================
// GET ALL SCHOOLS (ADMIN ONLY SAFE VERSION)
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('schools')
            .select(`
                id,
                name,
                plan,
                created_at
            `);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            total: data.length,
            schools: data
        });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;