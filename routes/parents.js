const express = require('express');
const router = express.Router();

// ===============================
// GET ALL PARENTS
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('parents')
            .select(`
                id,
                user_id,
                full_name,
                phone,
                created_at
            `)
            .order('created_at', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });

        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// GET SINGLE PARENT + CHILDREN
// ===============================
router.get('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        // parent
        const { data: parent, error } = await supabase
            .from('parents')
            .select(`
                id,
                user_id,
                full_name,
                phone,
                created_at
            `)
            .eq('id', id)
            .single();

        if (error) return res.status(404).json({ error: 'Parent not found' });

        // children (students linked by parent_id)
        const { data: children, error: childError } = await supabase
            .from('students')
            .select(`
                id,
                full_name,
                photo_url,
                class_id
            `)
            .eq('parent_id', id);

        if (childError) {
            return res.status(400).json({ error: childError.message });
        }

        res.json({
            parent,
            children: children || []
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ===============================
// CREATE PARENT
// ===============================
router.post('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { user_id, full_name, phone } = req.body;

        if (!full_name || !phone) {
            return res.status(400).json({ error: 'full_name and phone required' });
        }

        const { data, error } = await supabase
            .from('parents')
            .insert([{
                user_id: user_id || null,
                full_name,
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
// UPDATE PARENT
// ===============================
router.put('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { full_name, phone } = req.body;

        const { data, error } = await supabase
            .from('parents')
            .update({
                full_name,
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
// DELETE PARENT
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('parents')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.json({
            message: 'Parent deleted successfully',
            parent: data[0]
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;