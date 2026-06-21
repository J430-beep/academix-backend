const express = require('express');
const router = express.Router();


// ===============================
// GET ALL RESULTS (CURRENT SCHOOL)
// ===============================
router.get('/', async(req,res)=>{

try{

const supabase=req.app.locals.supabase;


const {data,error}=await supabase
.from("results")
.select(`
id,
marks,
total_marks,
grade,
rank,
students(
 full_name
),
subjects(
 name
)
`)
.eq("school_id",req.user.school_id)
.order("id",{ascending:false});



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
// GET STUDENT RESULTS
// ===============================
router.get("/student/:student_id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;



// verify student belongs to school

const {data:student}=await supabase
.from("students")
.select("id")
.eq("id",req.params.student_id)
.eq("school_id",req.user.school_id)
.single();



if(!student){

return res.status(403).json({
error:"Student not in this school"
});

}





const {data,error}=await supabase
.from("results")
.select(`
id,
exam_id,
marks,
total_marks,
grade,
rank,
subjects(
name
)
`)
.eq("student_id",req.params.student_id)
.eq("school_id",req.user.school_id)
.order("id",{ascending:false});



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
// ADD RESULT
// ===============================
router.post("/",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;



const {
student_id,
exam_id,
subject_id,
marks,
total_marks
}=req.body;



if(!student_id || !exam_id || !subject_id || marks==null || !total_marks){

return res.status(400).json({
error:"Missing fields"
});

}



// check student school

const {data:student}=await supabase
.from("students")
.select("id")
.eq("id",student_id)
.eq("school_id",req.user.school_id)
.single();



if(!student){

return res.status(403).json({
error:"Invalid student"
});

}





const percentage=(marks/total_marks)*100;


let grade="E";

if(percentage>=80) grade="A";
else if(percentage>=70) grade="B";
else if(percentage>=60) grade="C";
else if(percentage>=50) grade="D";





const {data,error}=await supabase
.from("results")
.insert([{

student_id,
exam_id,
subject_id,
marks,
total_marks,
grade,
school_id:req.user.school_id

}])
.select()
.single();



if(error)
return res.status(400).json({
error:error.message
});





// ranking only inside same school exam

const {data:allResults}=await supabase
.from("results")
.select("id,marks,total_marks")
.eq("exam_id",exam_id)
.eq("school_id",req.user.school_id);



if(allResults){


const ranked=allResults
.map(r=>({

id:r.id,

score:(r.marks/r.total_marks)*100

}))
.sort((a,b)=>b.score-a.score);



for(let i=0;i<ranked.length;i++){

await supabase
.from("results")
.update({
rank:i+1
})
.eq("id",ranked[i].id)
.eq("school_id",req.user.school_id);

}


}



res.status(201).json(data);



}catch(err){

res.status(500).json({
error:"Server error"
});

}

});



// ===============================
// UPDATE RESULT
// ===============================
router.put("/:id", async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { marks, total_marks } = req.body;

        if (marks == null || !total_marks) {
            return res.status(400).json({ error: "Missing fields" });
        }

        const percentage = (marks / total_marks) * 100;

        let grade = "E";
        if (percentage >= 80) grade = "A";
        else if (percentage >= 70) grade = "B";
        else if (percentage >= 60) grade = "C";
        else if (percentage >= 50) grade = "D";

        const { data, error } = await supabase
            .from("results")
            .update({ marks, total_marks, grade })
            .eq("id", req.params.id)
            .eq("school_id", req.user.school_id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: "Result updated",
            result: data,
            percentage
        });

    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});









// ===============================
// DELETE RESULT
// ===============================
router.delete("/:id",async(req,res)=>{


try{


const supabase=req.app.locals.supabase;


const {error}=await supabase
.from("results")
.delete()
.eq("id",req.params.id)
.eq("school_id",req.user.school_id);



if(error)
return res.status(400).json({
error:error.message
});


res.json({
message:"Result deleted"
});



}catch(err){

res.status(500).json({
error:"Delete failed"
});

}

});



module.exports=router;