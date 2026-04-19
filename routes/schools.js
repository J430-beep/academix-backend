const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// ===============================
// REGISTER SCHOOL (PRODUCTION SAAS)
// ===============================
router.post('/register', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const {
            name,
            mpesa_shortcode,
            mpesa_passkey,
            admin_email
        } = req.body;

        // ===============================
        // 1. VALIDATION
        // ===============================
        if (!name || !mpesa_shortcode || !mpesa_passkey) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // ===============================
        // 2. CHECK DUPLICATE
        // ===============================
        const { data: existing } = await supabase
            .from('schools')
            .select('id')
            .eq('name', name)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: "School already exists" });
        }

        // ===============================
        // 3. CREATE SCHOOL (NO PLAN FROM USER)
        // ===============================
        const { data: school, error } = await supabase
            .from('schools')
            .insert([{
                name,
                mpesa_shortcode,
                mpesa_passkey,
                plan: "basic" // default only (controlled by system)
            }])
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // ===============================
        // 4. CREATE SUBSCRIPTION (LOCKED)
        // ===============================
        await supabase.from('subscriptions').insert([{
            school_id: school.id,
            status: "inactive",
            plan: "basic",
            amount: 1000,
            start_date: null,
            end_date: null
        }]);

        // ===============================
        // 5. AUTO CREATE ADMIN USER (IMPORTANT FIX)
        // ===============================
        const hashedPassword = await bcrypt.hash("1234", 10);

        await supabase.from('users').insert([{
            name: "Admin",
            email: admin_email || `admin@${name.toLowerCase()}.com`,
            password: hashedPassword,
            school_id: school.id,
            role: "admin"
        }]);

        // ===============================
        // 6. RESPONSE (LOGIN READY)
        // ===============================
        res.status(201).json({
            message: "School registered successfully",
            school_id: school.id,
            login: {
                email: admin_email || `admin@${name.toLowerCase()}.com`,
                password: "1234"
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ===============================
// GET SCHOOLS
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('schools')
            .select('id, name, plan, created_at');

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