const express = require('express');
const router = express.Router();


// ===============================
// GET ALL CLASSES (CURRENT SCHOOL)
// ===============================
router.get('/', async(req,res)=>{

try{

const supabase = req.app.locals.supabase;


const {data,error}=await supabase
.from("classes")
.select(`
id,
name,
stream,
level
`)
.eq("school_id", req.user.school_id)
.order("level",{ascending:true});


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
// GET ONE CLASS
// ===============================
router.get("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("classes")
.select("*")
.eq("id",req.params.id)
.eq("school_id",req.user.school_id)
.single();



if(error)
return res.status(404).json({
error:"Class not found"
});


res.json(data);



}catch(err){

res.status(500).json({
error:"Server error"
});

}


});







// ===============================
// CREATE CLASS
// ===============================
router.post("/",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
name,
stream,
level
}=req.body;



if(!name || !stream || !level){

return res.status(400).json({
error:"All fields required"
});

}



const {data,error}=await supabase
.from("classes")
.insert([{

name,
stream,
level,

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
// UPDATE CLASS
// ===============================
router.put("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
name,
stream,
level
}=req.body;



const {data,error}=await supabase
.from("classes")
.update({
name,
stream,
level
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
error:"Server error"
});

}


});








// ===============================
// DELETE CLASS
// ===============================
router.delete("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {error}=await supabase
.from("classes")
.delete()
.eq("id",req.params.id)
.eq("school_id",req.user.school_id);



if(error)
return res.status(400).json({
error:error.message
});



res.json({
message:"Class deleted"
});



}catch(err){

res.status(500).json({
error:"Delete failed"
});

}


});



module.exports = router;