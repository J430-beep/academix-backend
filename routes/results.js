const express = require('express');
const router = express.Router();

// ===============================
// GET ALL RESULTS
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select(`
                id,
                student_id,
                exam_id,
                subject_id,
                marks,
                total_marks,
                grade,
                rank
            `)
            .order('id', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// GET STUDENT RESULTS
// ===============================
router.get('/student/:student_id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { student_id } = req.params;

        const { data, error } = await supabase
            .from('results')
            .select(`
                id,
                student_id,
                exam_id,
                subject_id,
                marks,
                total_marks,
                grade,
                rank
            `)
            .eq('student_id', student_id)
            .order('id', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// ADD RESULT (AUTO GRADE + AUTO RANK)
// ===============================
router.post('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { student_id, exam_id, subject_id, marks, total_marks } = req.body;

        if (!student_id || !exam_id || !subject_id || marks == null || !total_marks) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // ===========================
        // AUTO PERCENTAGE (NOT STORED)
        // ===========================
        const percentage = (marks / total_marks) * 100;

        // ===========================
        // AUTO GRADE
        // ===========================
        let grade = 'E';
        if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 60) grade = 'C';
        else if (percentage >= 50) grade = 'D';

        // ===========================
        // INSERT RESULT
        // ===========================
        const { data, error } = await supabase
            .from('results')
            .insert([{
                student_id,
                exam_id,
                subject_id,
                marks,
                total_marks,
                grade
            }])
            .select();

        if (error) return res.status(400).json({ error: error.message });

        // ===========================
        // AUTO RANKING (PER EXAM)
        // ===========================
        const { data: allResults } = await supabase
            .from('results')
            .select('id, marks, total_marks')
            .eq('exam_id', exam_id);

        if (allResults && allResults.length > 0) {

            const ranked = allResults
                .map(r => ({
                    id: r.id,
                    score: (r.marks / r.total_marks) * 100
                }))
                .sort((a, b) => b.score - a.score);

            for (let i = 0; i < ranked.length; i++) {
                await supabase
                    .from('results')
                    .update({ rank: i + 1 })
                    .eq('id', ranked[i].id);
            }
        }

        res.status(201).json({
            message: 'Result recorded successfully',
            result: data[0],
            calculated_percentage: percentage,
            grade
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// UPDATE RESULT
// ===============================
router.put('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;
        const { marks, total_marks } = req.body;

        if (marks == null || !total_marks) {
            return res.status(400).json({ error: 'Marks required' });
        }

        const percentage = (marks / total_marks) * 100;

        let grade = 'E';
        if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 60) grade = 'C';
        else if (percentage >= 50) grade = 'D';

        const { data, error } = await supabase
            .from('results')
            .update({
                marks,
                total_marks,
                grade
            })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Result updated',
            result: data[0],
            calculated_percentage: percentage
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// DELETE RESULT
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('results')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Result deleted',
            result: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;