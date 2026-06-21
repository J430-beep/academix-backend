const express = require('express');
const router = express.Router();


// ===============================
// GET ALL FEES (CURRENT SCHOOL)
// ===============================
router.get('/', async (req,res)=>{

try{

const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("fees")
.select(`
id,
student_id,
total_fee,
paid_amount,
created_at,
students(
full_name
)
`)
.eq("school_id", req.user.school_id)
.order("created_at",{ascending:false});


if(error)
return res.status(500).json({
error:error.message
});


res.json(data || []);



}catch(err){

res.status(500).json({
error:"Server error"
});

}

});





// ===============================
// GET ONE STUDENT FEES
// ===============================
router.get("/:id",async(req,res)=>{

try{


const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("fees")
.select("*")
.eq("id",req.params.id)
.eq("school_id",req.user.school_id)
.single();



if(error)
return res.status(404).json({
error:"Fee not found"
});


res.json(data);



}catch(err){

res.status(500).json({
error:"Server error"
});

}


});







// ===============================
// ADD FEE
// ===============================
router.post("/",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
student_id,
total_fee,
paid_amount
}=req.body;



if(!student_id || !total_fee){

return res.status(400).json({
error:"Student and total fee required"
});

}



// verify student belongs to this school

const {data:student,error:studentError}=await supabase
.from("students")
.select("id")
.eq("id",student_id)
.eq("school_id",req.user.school_id)
.single();



if(studentError || !student){

return res.status(403).json({
error:"Student not in this school"
});

}




const {data,error}=await supabase
.from("fees")
.insert([{

student_id,

total_fee:Number(total_fee),

paid_amount:Number(paid_amount || 0),

school_id:req.user.school_id

}])
.select()
.single();



if(error)
return res.status(400).json({
error:error.message
});


res.status(201).json(data);



}catch(err){

res.status(500).json({
error:"Insert failed"
});

}

});







// ===============================
// UPDATE FEE
// ===============================
router.put("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
total_fee,
paid_amount
}=req.body;



const {data,error}=await supabase
.from("fees")
.update({

total_fee:Number(total_fee),
paid_amount:Number(paid_amount)

})
.eq("id",req.params.id)
.eq("school_id",req.user.school_id)
.select()
.single();



if(error)
return res.status(400).json({
error:error.message
});


res.json(data);



}catch(err){

res.status(500).json({
error:"Update failed"
});

}

});







// ===============================
// DELETE FEE
// ===============================
router.delete("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {error}=await supabase
.from("fees")
.delete()
.eq("id",req.params.id)
.eq("school_id",req.user.school_id);



if(error)
return res.status(400).json({
error:error.message
});


res.json({
message:"Fee deleted"
});



}catch(err){

res.status(500).json({
error:"Delete failed"
});

}

});



module.exports=router;