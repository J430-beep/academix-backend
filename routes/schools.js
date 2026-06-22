const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
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
    if (!name) {  
        return res.status(400).json({  
            error: "School name is required"  
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
    // CREATE SCHOOL (SAFE DEFAULTS)  
    // ===============================  
    const { data: school, error: schoolError } = await supabase

.from("schools")
.insert([{
name: name.trim(),

mpesa_shortcode: mpesa_shortcode || "",  
  mpesa_passkey: mpesa_passkey || "",  
  consumer_key: consumer_key || "",  
  consumer_secret: consumer_secret || "",  

  callback_url: "", // ✅ FIX ADDED  

  plan: "basic",  
  created_at: new Date().toISOString() // ✅ FIX ADDED

}])
.select()
.single();

if (schoolError) {  
console.log("SUPABASE ERROR FULL:", JSON.stringify(schoolError, null, 2));  

return res.status(500).json({  
    error: schoolError.message,  
    details: schoolError  
});

}

// ===============================  
    // SUBSCRIPTION (1000 BASIC)  
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
    let email =
    admin_email ||
    `admin@${name.toLowerCase().replace(/\s/g, "")}.com`;


// CHECK IF EMAIL ALREADY EXISTS
const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();


if(existingUser){

    email =
    `admin${Date.now()}@${name.toLowerCase().replace(/\s/g,"")}.com`;

}  

    const resetToken = crypto.randomBytes(32).toString("hex");  
    const expiry = new Date(Date.now() + 1000 * 60 * 60);  

    const hashedPassword = await bcrypt.hash(
    req.body.admin_password,
    10
);


const { error: userError } = await supabase
    .from("users")
    .insert([{
        name: "Admin",
        email,
        password: hashedPassword,
        school_id: school.id,
        role: "admin",
        reset_token: resetToken,
        reset_token_expiry: expiry
    }]);

    if (userError) {  
        return res.status(500).json({  
            error: userError.message  
        });  
    }  

    // ===============================  
    // RESPONSE  
    // ===============================  
    res.status(201).json({  
        message: "School created successfully",  
        school_id: school.id,  
        admin_email: email,  
        link: `https://reliable-faun-e92214.netlify.app/set-password.html?token=${resetToken}`  
    });  

} catch (err) {  
    console.error(err);  
    res.status(500).json({  
        error: "Server error"  
    });  
}

});

module.exports = router;