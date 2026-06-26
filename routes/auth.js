const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const redis = require("../utils/redis.js");
const nodemailer = require("nodemailer");

const router = express.Router();

// ===============================
// CONFIG
// ===============================
const OTP_EXPIRY = 300; // 5 min
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_TIME = 60; // 1 min

// ===============================
// EMAIL SETUP
// ===============================
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ===============================
// OTP GENERATOR
// ===============================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===============================
// RATE LIMIT CHECK
// ===============================
async function checkRateLimit(email) {
    const key = `otp_rate:${email}`;
    const exists = await redis.get(key);

    if (exists) return false;

    await redis.set(key, "1", "EX", RATE_LIMIT_TIME);
    return true;
}

// ===============================
// STEP 1: REQUEST OTP
// ===============================
router.post("/request-otp", async (req, res) => {

    console.log("========== OTP REQUEST ==========");
    console.log("BODY:", req.body);

    try {

        const supabase = req.app.locals.supabase;

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password required"
            });
        }


        console.log("Checking rate limit...");

        const allowed = await checkRateLimit(email);

        if (!allowed) {
            return res.status(429).json({
                error: "Wait before requesting another OTP"
            });
        }


        console.log("Finding user:", email);


        const { data: user, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();


        console.log("SUPABASE USER:", user);
        console.log("SUPABASE ERROR:", userError);



        if (userError) {
            return res.status(500).json({
                error:"Database error",
                details:userError.message
            });
        }


        if (!user) {
            return res.status(404).json({
                error:"User not found"
            });
        }


        console.log("Checking password");


        const valid = await bcrypt.compare(
            password,
            user.password
        );


        console.log("PASSWORD RESULT:", valid);



        if (!valid) {
            return res.status(401).json({
                error:"Invalid credentials"
            });
        }



        const otp = generateOTP();


        console.log("OTP GENERATED");


        const hashedOtp = await bcrypt.hash(
            otp,
            10
        );


        const temp_token = crypto.randomUUID();



        await redis.set(
            `otp:${temp_token}`,
            JSON.stringify({
                otp: hashedOtp,
                attempts:0,
                user_id:user.id,
                school_id:user.school_id,
                role:user.role,
                email:user.email
            }),
            "EX",
            OTP_EXPIRY
        );


        console.log("REDIS SAVED");


        await transporter.sendMail({

            from:process.env.EMAIL_USER,

            to:email,

            subject:"AcademiX OTP Code",

            text:`Your OTP code is ${otp}`

        });


        console.log("EMAIL SENT");


        return res.json({
            message:"OTP sent successfully",
            temp_token
        });



    } catch(err){

        console.error("🔥 REAL OTP ERROR:",err);


        return res.status(500).json({
            error:err.message,
            stack:err.stack
        });

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

        // CHECK ATTEMPTS
        if (session.attempts >= MAX_ATTEMPTS) {
            await redis.del(`otp:${temp_token}`);
            return res.status(403).json({
                error: "Too many failed attempts. Request new OTP."
            });
        }

        // VERIFY OTP
        const isValid = await bcrypt.compare(otp, session.otp);

        if (!isValid) {

            session.attempts += 1;

            await redis.set(
                `otp:${temp_token}`,
                JSON.stringify(session),
                "EX",
                OTP_EXPIRY
            );

            return res.status(401).json({
                error: "Invalid OTP",
                attempts_left: MAX_ATTEMPTS - session.attempts
            });
        }

        // DELETE OTP ON SUCCESS
        await redis.del(`otp:${temp_token}`);

        // CREATE JWT
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
router.post("/login", (req, res) => {
    res.json({ message: "Use OTP login instead" });
});

module.exports = router;