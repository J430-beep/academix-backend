const express = require('express');
const router = express.Router();


// ===============================
// GET ALL STUDENTS (MULTI SCHOOL)
// ===============================
router.get('/', async (req,res)=>{

try{

const supabase = req.app.locals.supabase;

const school_id = req.user.school_id;


const {data,error}=await supabase
.from("students")
.select(`
id,
full_name,
photo_url,
created_at,
classes(
 name
)
`)
.eq("school_id", school_id)
.order("created_at",{ascending:false});


if(error)
return res.status(400).json({error:error.message});


res.json(data);


}catch(err){

res.status(500).json({
error:"Server error"
});

}

});



// ===============================
// GET ONE STUDENT
// ===============================
router.get("/:id",async(req,res)=>{

try{

const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("students")
.select("*")
.eq("id",req.params.id)
.eq("school_id",req.user.school_id)
.single();


if(error)
return res.status(404).json({
error:"Student not found"
});


res.json(data);


}catch(err){

res.status(500).json({
error:"Server error"
});

}

});




// ===============================
// CREATE STUDENT
// ===============================
router.post("/",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
full_name,
class_id,
photo_url,
parent_id
}=req.body;



if(!full_name || !class_id){

return res.status(400).json({
error:"Name and class required"
});

}



const {data,error}=await supabase
.from("students")
.insert([{

full_name,
class_id,
photo_url,
parent_id,

// IMPORTANT
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
// UPDATE
// ===============================
router.put("/:id",async(req,res)=>{


try{

const supabase=req.app.locals.supabase;


const {
full_name,
class_id,
photo_url,
parent_id
}=req.body;



const {data,error}=await supabase
.from("students")
.update({

full_name,
class_id,
photo_url,
parent_id

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
// DELETE
// ===============================
router.delete("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {error}=await supabase
.from("students")
.delete()
.eq("id",req.params.id)
.eq("school_id",req.user.school_id);



if(error)
return res.status(400).json({
error:error.message
});


res.json({
message:"Student deleted"
});



}catch(err){

res.status(500).json({
error:"Delete failed"
});

}


});



module.exports=router;