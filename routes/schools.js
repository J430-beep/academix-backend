const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const {
            name,
            mpesa_shortcode,
            mpesa_passkey,
            admin_email
        } = req.body;

        // ===============================
        // VALIDATION
        // ===============================
        if (!name || !mpesa_shortcode || !mpesa_passkey) {
            return res.status(400).json({ error: "Missing fields" });
        }

        // ===============================
        // CHECK DUPLICATE
        // ===============================
        const { data: existing } = await supabase
            .from("schools")
            .select("id")
            .eq("name", name)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: "School already exists" });
        }

        // ===============================
        // CREATE SCHOOL
        // ===============================
        const { data: school, error: schoolError } = await supabase
            .from("schools")
            .insert([{
                name,
                mpesa_shortcode,
                mpesa_passkey,
                plan: "basic"
            }])
            .select()
            .single();

        if (schoolError) {
            return res.status(500).json({ error: schoolError.message });
        }

        // ===============================
        // CREATE SUBSCRIPTION (LOCKED)
        // ===============================
        await supabase.from("subscriptions").insert([{
            school_id: school.id,
            status: "inactive",
            plan: "basic",
            amount: 1000
        }]);

        // ===============================
        // GENERATE SECURE ADMIN LOGIN
        // ===============================
        const tempPassword = crypto.randomBytes(4).toString("hex"); // e.g. a3f9b2c1
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const email = admin_email ||
            `admin@${name.toLowerCase().replace(/\s/g, "")}.com`;

        const { data: user, error: userError } = await supabase
            .from("users")
            .insert([{
                name: "Admin",
                email,
                password: hashedPassword,
                school_id: school.id,
                role: "admin",
                must_change_password: true
            }])
            .select()
            .single();

        if (userError) {
           console.log("❌ USER ERROR FULL:", userError);

return res.status(500).json({
    error: userError.message,
    full: userError
});
        }

        // ===============================
        // RESPONSE (THIS IS WHAT YOU WERE MISSING)
        // ===============================
        res.status(201).json({
            message: "School created successfully",

            school_id: school.id,

            login: {
                email: user.email,
                password: tempPassword
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;