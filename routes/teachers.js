const express = require('express');
const router = express.Router();

// ===============================
// GET ALL TEACHERS
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('teachers')
            .select(`
    id,
    full_name,
    phone,
    created_at,
    subjects (
        name
    )
`)
            .order('created_at', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// GET SINGLE TEACHER
// ===============================
router.get('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('teachers')
            .select(`
                id,
                user_id,
                full_name,
                subjects (
    name
),
                phone,
                created_at
            `)
            .eq('id', id)
            .single();

        if (error) return res.status(404).json({ error: 'Teacher not found' });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// ADD TEACHER
// ===============================
router.post('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { user_id, full_name, subject_id, phone } = req.body;

        if (!full_name || !subject_id || !phone) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('teachers')
            .insert([{
                user_id: user_id || null,
                full_name,
                subject_id,
                phone
            }])
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.status(201).json(data[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// UPDATE TEACHER
// ===============================
router.put('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { full_name, subject_id, phone } = req.body;

        const { data, error } = await supabase
            .from('teachers')
            .update({
                full_name,
                subject_id,
                phone
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
// DELETE TEACHER
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('teachers')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Teacher deleted',
            teacher: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;