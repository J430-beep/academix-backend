const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const redis = require("../utils/redis.js");
const nodemailer = require("nodemailer");

const router = express.Router();

const OTP_EXPIRY = 300;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_TIME = 60;


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
    },
    tls: {
        rejectUnauthorized: false
    }
});


// TEST EMAIL CONNECTION
transporter.verify((error) => {

    if(error){
        console.log("❌ EMAIL CONNECTION FAILED");
        console.log(error.message);
    }else{
        console.log("✅ EMAIL SERVER READY");
    }

});



// ===============================
// OTP GENERATOR
// ===============================
function generateOTP(){

    return Math.floor(
        100000 + Math.random() * 900000
    ).toString();

}



// ===============================
// RATE LIMIT
// ===============================
async function checkRateLimit(email){

    const key = `otp_rate:${email}`;

    const exists = await redis.get(key);


    if(exists){
        return false;
    }


    await redis.set(
        key,
        "1",
        "EX",
        RATE_LIMIT_TIME
    );


    return true;

}



// ===============================
// REQUEST OTP
// ===============================
router.post("/request-otp", async(req,res)=>{


try{


console.log("========== OTP REQUEST ==========");
console.log(req.body);



const supabase = req.app.locals.supabase;


const {email,password}=req.body;



if(!email || !password){

return res.status(400).json({
error:"Email and password required"
});

}



// RATE LIMIT

const allowed = await checkRateLimit(email);


if(!allowed){

return res.status(429).json({
error:"Wait before requesting another OTP"
});

}




// FIND USER

const {data:user,error:userError}=await supabase
.from("users")
.select("*")
.eq("email",email)
.maybeSingle();



console.log("USER:",user);
console.log("USER ERROR:",userError);



if(userError){

return res.status(500).json({
error:userError.message
});

}



if(!user){

return res.status(404).json({
error:"User not found"
});

}




// PASSWORD CHECK

const passwordOK =
await bcrypt.compare(
password,
user.password
);



console.log("PASSWORD:",passwordOK);



if(!passwordOK){

return res.status(401).json({
error:"Invalid credentials"
});

}




// CREATE OTP

const otp = generateOTP();

console.log("OTP:",otp);



const hashedOtp =
await bcrypt.hash(otp,10);



const temp_token =
crypto.randomUUID();




// SAVE REDIS

await redis.set(
`otp:${temp_token}`,
JSON.stringify({

otp:hashedOtp,
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




// SEND EMAIL

console.log("SENDING EMAIL...");



await transporter.sendMail({

from:process.env.EMAIL_USER,

to:email,

subject:"AcademiX OTP Code",

text:
`Your AcademiX OTP code is ${otp}`

});



console.log("EMAIL SENT");




return res.json({

message:"OTP sent successfully",

temp_token

});



}catch(error){


console.log("🔥 OTP ERROR");

console.log(error);



return res.status(500).json({

error:error.message

});

}


});




// ===============================
// VERIFY OTP
// ===============================

router.post("/verify-otp",async(req,res)=>{


try{


const {
temp_token,
otp
}=req.body;



if(!temp_token || !otp){

return res.status(400).json({
error:"Missing OTP data"
});

}



const saved =
await redis.get(
`otp:${temp_token}`
);



if(!saved){

return res.status(400).json({
error:"OTP expired"
});

}



const session =
JSON.parse(saved);




if(session.attempts >= MAX_ATTEMPTS){

await redis.del(
`otp:${temp_token}`
);


return res.status(403).json({
error:"Too many attempts"
});

}





const valid =
await bcrypt.compare(
otp,
session.otp
);




if(!valid){


session.attempts++;


await redis.set(
`otp:${temp_token}`,
JSON.stringify(session),
"EX",
OTP_EXPIRY
);



return res.status(401).json({
error:"Invalid OTP"
});


}





await redis.del(
`otp:${temp_token}`
);




const token =
jwt.sign(

{
user_id:session.user_id,
school_id:session.school_id,
role:session.role
},

process.env.JWT_SECRET,

{
expiresIn:"7d"
}

);





return res.json({

message:"Login successful",

token,

school_id:session.school_id,

role:session.role

});



}catch(error){

console.log(error);

return res.status(500).json({
error:"OTP verification failed"
});

}



});





router.post("/login",(req,res)=>{

res.json({
message:"Use OTP login"
});

});




module.exports = router;