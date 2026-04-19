const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const router = express.Router();

// ===============================
// REGISTER USER
// ===============================
router.post("/register", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { name, email, password, school_id, role } = req.body;

        if (!email || !password || !school_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // check if user exists
        const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (existing) {
            return res.status(400).json({ error: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from("users")
            .insert([{
                name,
                email,
                password: hashedPassword,
                school_id,
                role: role || "admin"
            }])
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            message: "User created successfully",
            user_id: data.id
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


// ===============================
// LOGIN USER (SAAS FIXED)
// ===============================
router.post("/login", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        // get user
        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // verify password
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            return res.status(401).json({ error: "Invalid password" });
        }

        // ===============================
        // GET SUBSCRIPTION (CRITICAL SAAS PART)
        // ===============================
        const { data: sub } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("school_id", user.school_id)
            .eq("status", "active")
            .maybeSingle();

        // ===============================
        // CHECK EXPIRY
        // ===============================
        if (sub?.end_date && new Date(sub.end_date) < new Date()) {
            return res.status(403).json({
                error: "Subscription expired. Please renew."
            });
        }

        // ===============================
        // DEFAULT PLAN IF NONE
        // ===============================
        const plan = sub?.plan || "basic";

        // ===============================
        // CREATE JWT TOKEN
        // ===============================
        const token = jwt.sign(
            {
                user_id: user.id,
                school_id: user.school_id,
                role: user.role,
                plan: plan
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                school_id: user.school_id,
                role: user.role,
                plan: plan
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;