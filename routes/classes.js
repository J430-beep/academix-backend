const express = require('express');
const router = express.Router();

// ===============================
// GET ALL CLASSES
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('classes')
            .select('id, name, stream, level')
            .order('level', { ascending: true });

        if (error) {
            console.error("Fetch classes error:", error);
            return res.status(400).json({ error: error.message });
        }

        res.json(data);

    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ error: 'Server error' });
    }
});


// ===============================
// GET SINGLE CLASS
// ===============================
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ===============================
// CREATE CLASS
// ===============================
router.post('/', async (req, res) => {
    const { name, stream, level } = req.body;

    if (!name || !stream || !level) {
        return res.status(400).json({ error: 'All fields required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('classes')
            .insert([{ name, stream, level }])
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.status(201).json({
            message: 'Class created successfully',
            class: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ===============================
// UPDATE CLASS
// ===============================
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, stream, level } = req.body;

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('classes')
            .update({ name, stream, level })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Class updated',
            class: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ===============================
// DELETE CLASS
// ===============================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('classes')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Class deleted',
            class: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;