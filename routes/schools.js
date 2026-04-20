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
        // CHECK DUPLICATE SCHOOL
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
        // CREATE SUBSCRIPTION
        // ===============================
        await supabase.from("subscriptions").insert([{
            school_id: school.id,
            status: "inactive",
            plan: "basic",
            amount: 1000
        }]);

        // ===============================
        // GENERATE ADMIN LOGIN (SECURE)
        // ===============================

        const email =
            admin_email ||
            `admin@${name.toLowerCase().replace(/\s/g, "")}.com`;

        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

        // ===============================
        // CREATE USER (NO PASSWORD YET)
        // ===============================
        const { data: user, error: userError } = await supabase
            .from("users")
            .insert([{
                name: "Admin",
                email,
                password: null,
                school_id: school.id,
                role: "admin",
                reset_token: resetToken,
                reset_token_expiry: expiry
            }])
            .select()
            .single();

        if (userError) {
            return res.status(500).json({
                error: userError.message
            });
        }

        // ===============================
        // PASSWORD SET LINK
        // ===============================
        const link = `https://academix-backend-pe8o.onrender.com/set-password.html?token=${resetToken}`;

        console.log("📧 SEND THIS LINK TO SCHOOL:", link);

        // ===============================
        // RESPONSE
        // ===============================
        res.status(201).json({
            message: "School created successfully",

            school_id: school.id,

            message_to_user: "Check email to set password",

            link: link
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;