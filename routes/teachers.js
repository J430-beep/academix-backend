const express = require('express');
const router = express.Router();


// ===============================
// GET ALL TEACHERS (CURRENT SCHOOL)
// ===============================
router.get('/', async (req,res)=>{

try{

const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("teachers")
.select(`
id,
full_name,
phone,
created_at,
subjects(
name
)
`)
.eq("school_id", req.user.school_id)
.order("created_at",{ascending:true});


if(error)
return res.status(400).json({
error:error.message
});


res.json(data);


}catch(err){

res.status(500).json({
error:"Server error"
});

}

});





// ===============================
// GET ONE TEACHER
// ===============================
router.get("/:id",async(req,res)=>{

try{

const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("teachers")
.select(`
id,
user_id,
full_name,
phone,
created_at,
subjects(
name
)
`)
.eq("id",req.params.id)
.eq("school_id",req.user.school_id)
.single();


if(error)
return res.status(404).json({
error:"Teacher not found"
});


res.json(data);


}catch(err){

res.status(500).json({
error:"Server error"
});

}

});





// ===============================
// CREATE TEACHER
// ===============================
router.post("/",async(req,res)=>{


try{

const supabase=req.app.locals.supabase;


const {
user_id,
full_name,
subject_id,
phone
}=req.body;



if(!full_name || !subject_id){

return res.status(400).json({
error:"Name and subject required"
});

}



const {data,error}=await supabase
.from("teachers")
.insert([{

user_id:user_id || null,
full_name,
subject_id,
phone: phone || null,
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
error:"Server error"
});

}

});






// ===============================
// UPDATE TEACHER
// ===============================
router.put("/:id",async(req,res)=>{


try{

const supabase=req.app.locals.supabase;


const {
full_name,
subject_id,
phone
}=req.body;



const {data,error}=await supabase
.from("teachers")
.update({

full_name,
subject_id,
phone

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
// DELETE TEACHER
// ===============================
router.delete("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {error}=await supabase
.from("teachers")
.delete()
.eq("id",req.params.id)
.eq("school_id",req.user.school_id);



if(error)
return res.status(400).json({
error:error.message
});


res.json({
message:"Teacher deleted"
});


}catch(err){

res.status(500).json({
error:"Delete failed"
});

}


});



module.exports=router;