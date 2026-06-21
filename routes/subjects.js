const express = require('express');
const router = express.Router();



// ===============================
// GET ALL SUBJECTS
// ===============================
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);

    } catch (err) {
        console.error("GET subjects error:", err);
        res.status(500).json({ error: "Server error" });
    }
});


// ===============================
// CREATE SUBJECT
// ===============================
router.post('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Subject name is required" });
        }

        const { data, error } = await supabase
            .from('subjects')
            .insert([{ name }])
            .select();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data[0]);

    } catch (err) {
        console.error("POST subject error:", err);
        res.status(500).json({ error: "Server error" });
    }
});


// ===============================
// UPDATE SUBJECT
// ===============================
router.put('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;
        const { name } = req.body;

        const { data, error } = await supabase
            .from('subjects')
            .update({ name })
            .eq('id', id)
            .select();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data[0]);

    } catch (err) {
        console.error("PUT subject error:", err);
        res.status(500).json({ error: "Server error" });
    }
});


// ===============================
// DELETE SUBJECT
// ===============================
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { id } = req.params;

        const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ message: "Subject deleted successfully" });

    } catch (err) {
        console.error("DELETE subject error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;