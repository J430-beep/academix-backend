const express = require('express');
const router = express.Router();

// ===============================
// REGISTER SCHOOL
// ===============================
router.post('/register', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const {
            name,
            mpesa_shortcode,
            mpesa_passkey
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: "School name required" });
        }

        const { data, error } = await supabase
            .from('schools')
            .insert([
                {
                    name,
                    mpesa_shortcode,
                    mpesa_passkey
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json({
            message: "School registered successfully",
            school_id: data.id
        });

    } catch (err) {
        console.error("School register error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ===============================
// GET ALL SCHOOLS (TEST)
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('schools')
            .select('*');

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;