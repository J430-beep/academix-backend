const express = require('express');
const router = express.Router();

// ===============================
// GET ALL EXAMS
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('exams')
            .select(`
                id,
                name,
                class_id,
                subject_id,
                teacher_id,
                exam_date,
                syllabus
            `)
            .order('exam_date', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// GET SINGLE EXAM
// ===============================
router.get('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('exams')
            .select(`
                id,
                name,
                class_id,
                subject_id,
                teacher_id,
                exam_date,
                syllabus
            `)
            .eq('id', id)
            .single();

        if (error) return res.status(404).json({ error: 'Exam not found' });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// CREATE EXAM
// ===============================
router.post('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const {
            name,
            class_id,
            subject_id,
            teacher_id,
            exam_date,
            syllabus
        } = req.body;

        if (!name || !class_id || !subject_id || !exam_date) {
            return res.status(400).json({
                error: 'name, class_id, subject_id, exam_date required'
            });
        }

        const { data, error } = await supabase
            .from('exams')
            .insert([{
                name,
                class_id,
                subject_id,
                teacher_id,
                exam_date,
                syllabus: syllabus || null
            }])
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.status(201).json(data[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// UPDATE EXAM
// ===============================
router.put('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const {
            name,
            class_id,
            subject_id,
            teacher_id,
            exam_date,
            syllabus
        } = req.body;

        const { data, error } = await supabase
            .from('exams')
            .update({
                name,
                class_id,
                subject_id,
                teacher_id,
                exam_date,
                syllabus
            })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json(data[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// DELETE EXAM
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('exams')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Exam deleted successfully',
            exam: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;