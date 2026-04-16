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
// REAL AI TUTOR ENGINE
// ===============================
async function generateAIResponse(question) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                   content: `
You are a KCSE examiner and expert tutor.

You MUST answer in KCSE MARKING SCHEME STYLE.

RULES:
- Break answers into POINTS
- Each correct point = 1 mark
- Clearly show MARK ALLOCATION (e.g. (1 mark), (2 marks))
- Use examiner language
- Be strict and structured
- For science/maths show working step-by-step
- End with TOTAL MARKS

FORMAT:

1. POINTS (with marks)
2. EXPLANATION / WORKING
3. FINAL ANSWER
4. TOTAL MARKS
5. EXAM TIP
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
        return "AI service error. Please try again later.";
    }
}


// ===============================
// ASK AI TUTOR
// ===============================
router.post('/ask', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { student_id, question } = req.body;

        if (!student_id || !question) {
            return res.status(400).json({
                error: "student_id and question are required"
            });
        }

        // Generate AI answer
        const answer = await generateAIResponse(question);

        // Save to Supabase
        const { data, error } = await supabase
            .from('ai_questions')
            .insert([{
                student_id,
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
// GET STUDENT CHAT HISTORY
// ===============================
router.get('/student/:student_id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { student_id } = req.params;

        const { data, error } = await supabase
            .from('ai_questions')
            .select('id, question, answer, created_at')
            .eq('student_id', student_id)
            .order('id', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// DELETE CHAT
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('ai_questions')
            .delete()
            .eq('id', id)
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