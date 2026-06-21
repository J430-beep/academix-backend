const express = require('express');
const router = express.Router();


// ===============================
// GET ALL EXAMS (CURRENT SCHOOL)
// ===============================
router.get('/', async(req,res)=>{

try{

const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("exams")
.select(`
id,
name,
exam_date,
syllabus,
classes(
 name
),
subjects(
 name
)
`)
.eq("school_id", req.user.school_id)
.order("exam_date",{ascending:false});



if(error)
return res.status(400).json({
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
// GET ONE EXAM
// ===============================
router.get("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;



const {data,error}=await supabase
.from("exams")
.select("*")
.eq("id",req.params.id)
.eq("school_id",req.user.school_id)
.single();



if(error)
return res.status(404).json({
error:"Exam not found"
});


res.json(data);



}catch(err){

res.status(500).json({
error:"Server error"
});

}


});







// ===============================
// CREATE EXAM
// ===============================
router.post("/",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
name,
class_id,
subject_id,
teacher_id,
exam_date,
syllabus
}=req.body;



if(!name || !class_id || !subject_id || !exam_date){

return res.status(400).json({
error:"Required fields missing"
});

}



// verify class belongs to school

const {data:cls,error:clsError}=await supabase
.from("classes")
.select("id")
.eq("id",class_id)
.eq("school_id",req.user.school_id)
.single();



if(clsError || !cls){

return res.status(403).json({
error:"Invalid class"
});

}





const {data,error}=await supabase
.from("exams")
.insert([{

name,

class_id,

subject_id,

teacher_id,

exam_date,

syllabus:syllabus || null,

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

// verify class belongs to school
const { data: cls, error: clsError } = await supabase
.from("classes")
.select("id")
.eq("id", class_id)
.eq("school_id", req.user.school_id)
.single();

if (clsError || !cls) {
return res.status(403).json({
error: "Invalid class"
});
}

const { data: sub, error: subError } = await supabase
.from("subjects")
.select("id")
.eq("id", subject_id)
.eq("school_id", req.user.school_id)
.single();

if (subError || !sub) {
return res.status(403).json({
error: "Invalid subject"
});
}

const { data: teacher, error: tErr } = await supabase
.from("teachers")
.select("id")
.eq("id", teacher_id)
.eq("school_id", req.user.school_id)
.single();

if (tErr || !teacher) {
return res.status(403).json({
error: "Invalid teacher"
});
}


// ===============================
// UPDATE EXAM
// ===============================
router.put("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {
name,
class_id,
subject_id,
teacher_id,
exam_date,
syllabus
}=req.body;



const {data,error}=await supabase
.from("exams")
.update({

name,
class_id,
subject_id,
teacher_id,
exam_date,
syllabus

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
// DELETE EXAM
// ===============================
router.delete("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {error}=await supabase
.from("exams")
.delete()
.eq("id",req.params.id)
.eq("school_id",req.user.school_id);



if(error)
return res.status(400).json({
error:error.message
});



res.json({
message:"Exam deleted"
});



}catch(err){

res.status(500).json({
error:"Delete failed"
});

}

});



module.exports=router;