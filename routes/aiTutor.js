const express = require('express');
const router = express.Router();
const OpenAI = require("openai");

// ===============================
// OPENAI SETUP
// ===============================
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ===============================
// AI RESPONSE GENERATOR
// ===============================
async function generateAIResponse(question) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
You are a Kenyan KCSE Chief Examiner + Expert Tutor.

RULES:
- Break answers into MARKING POINTS
- Award marks clearly (1 mark per point)
- Show full working
- Use simple KCSE language
- Always include:
  1. Final Answer
  2. Explanation
  3. Marking Scheme
  4. Common mistakes
  5. Exam Tip
`
                },
                {
                    role: "user",
                    content: question
                }
            ],
            temperature: 0.7
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error("OpenAI error:", error);
        return "AI service error. Try again later.";
    }
}

// ===============================
// ASK AI (MULTI-SCHOOL SAFE)
// ===============================
router.post('/ask', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { student_id, question, school_id } = req.body;

        if (!student_id || !question || !school_id) {
            return res.status(400).json({
                error: "student_id, question and school_id are required"
            });
        }

        // ✅ VERIFY student belongs to school
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id')
            .eq('id', student_id)
            .eq('school_id', school_id)
            .single();

        if (studentError || !student) {
            return res.status(403).json({
                error: "Unauthorized student for this school"
            });
        }

        // ✅ Generate AI answer
        const answer = await generateAIResponse(question);

        // ✅ Save with school_id
        const { data, error } = await supabase
            .from('ai_questions')
            .insert([{
                student_id,
                school_id,
                question,
                answer
            }])
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.status(201).json({
            message: "AI Tutor response generated",
            answer,
            saved: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// GET CHAT HISTORY (SECURE)
// ===============================
router.get('/student/:student_id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { student_id } = req.params;
        const { school_id } = req.query;

        if (!school_id) {
            return res.status(400).json({ error: "school_id required" });
        }

        const { data, error } = await supabase
            .from('ai_questions')
            .select('id, question, answer, created_at')
            .eq('student_id', student_id)
            .eq('school_id', school_id)
            .order('id', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// DELETE CHAT (SECURE)
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { id } = req.params;
        const { school_id } = req.query;

        if (!school_id) {
            return res.status(400).json({ error: "school_id required" });
        }

        const { data, error } = await supabase
            .from('ai_questions')
            .delete()
            .eq('id', id)
            .eq('school_id', school_id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: "Chat deleted successfully",
            deleted: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;