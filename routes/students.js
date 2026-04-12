// routes/students.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Get all students with their class and image
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('students')
            .select(`
                id,
                full_name,
                class_id,
                photo_url,
                parent_id,
                created_at
            `)
            .order('created_at', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single student by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return res.status(404).json({ error: 'Student not found' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add new student
router.post('/', async (req, res) => {
    const { full_name, class_id, photo_url, parent_id } = req.body;
    if (!full_name || !class_id)
        return res.status(400).json({ error: 'Full Name and Class are required' });

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('students')
            .insert([{
    full_name,
    class_id,
    photo_url,
    parent_id
}])
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update student
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { full_name, class_id, photo_url, parent_id } = req.body;

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('students')
            .update({ full_name, class_id, photo_url, parent_id })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data[0]);
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message });
    }
});

// Delete student
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('students')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Student deleted successfully', student: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;