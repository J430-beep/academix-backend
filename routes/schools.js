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
            consumer_key,
            consumer_secret,
            admin_email
        } = req.body;

        // ===============================
        // VALIDATION
        // ===============================
        if (
            !name ||
            !mpesa_shortcode ||
            !mpesa_passkey ||
            !consumer_key ||
            !consumer_secret
        ) {
            return res.status(400).json({
                error: "Missing required fields"
            });
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
            return res.status(409).json({
                error: "School already exists"
            });
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
                consumer_key,
                consumer_secret,
                plan: "basic"
            }])
            .select()
            .single();

        if (schoolError) {
            return res.status(500).json({
                error: schoolError.message
            });
        }

        // ===============================
        // CREATE SUBSCRIPTION (DEFAULT LOCKED)
        // ===============================
        await supabase.from("subscriptions").insert([{
            school_id: school.id,
            status: "inactive",
            plan: "basic",
            amount: 1000
        }]);

        // ===============================
        // CREATE ADMIN USER
        // ===============================
        const email =
            admin_email ||
            `admin@${name.toLowerCase().replace(/\s/g, "")}.com`;

        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

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
        const link = `https://reliable-faun-e92214.netlify.app/set-password.html?token=${resetToken}`;

        // ===============================
        // RESPONSE
        // ===============================
        res.status(201).json({
            message: "School created successfully",
            school_id: school.id,
            admin_email: email,
            link: link
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "Server error"
        });
    }
});

module.exports = router;