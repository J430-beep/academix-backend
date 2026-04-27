const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const redis = require('../utils/redis.js');

const router = express.Router();

// ===============================
// EMAIL / SMS SETUP (OPTIONAL)
// ===============================
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ===============================
// GENERATE OTP
// ===============================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===============================
// STEP 1: REQUEST OTP
// ===============================
router.post("/request-otp", async (req, res) => {

    const supabase = req.app.locals.supabase;

    const { email, password, school_code } = req.body;

    if (!email || !password || !school_code) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        // find user
        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // verify password first
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // generate OTP
        const otp = generateOTP();

        // create temp token
        const temp_token = crypto.randomUUID();

        // store in redis (5 min expiry)
        await redis.set(
            `otp:${temp_token}`,
            JSON.stringify({
                otp,
                user_id: user.id,
                school_id: user.school_id,
                role: user.role
            }),
            "EX",
            300
        );

        // ===============================
        // SEND EMAIL OTP
        // ===============================
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "AcademiX OTP Code",
            text: `Your OTP code is: ${otp}`
        });

        res.json({
            message: "OTP sent",
            temp_token
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "OTP request failed" });
    }
});

// ===============================
// STEP 2: VERIFY OTP
// ===============================
router.post("/verify-otp", async (req, res) => {

    const { temp_token, otp } = req.body;

    if (!temp_token || !otp) {
        return res.status(400).json({ error: "Missing OTP data" });
    }

    try {
        const data = await redis.get(`otp:${temp_token}`);

        if (!data) {
            return res.status(400).json({ error: "OTP expired or invalid" });
        }

        const session = JSON.parse(data);

        if (session.otp !== otp) {
            return res.status(401).json({ error: "Invalid OTP" });
        }

        // delete OTP after success
        await redis.del(`otp:${temp_token}`);

        // create JWT
        const token = jwt.sign(
            {
                user_id: session.user_id,
                school_id: session.school_id,
                role: session.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            school_id: session.school_id,
            role: session.role
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "OTP verification failed" });
    }
});

// ===============================
// EXISTING LOGIN (OPTIONAL KEEP)
// ===============================
router.post("/login", async (req, res) => {
    res.status(200).json({
        message: "Use OTP login instead"
    });
});

module.exports = router;