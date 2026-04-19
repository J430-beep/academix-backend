const express = require('express');
const router = express.Router();

// GET ALL FEES (SAFE VERSION)
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('fees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("FEES ERROR:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data || []);

    } catch (err) {
        console.error("FEES CRASH:", err);
        res.status(500).json({ error: 'Server crash in fees route' });
    }
});

// ADD FEE (MATCH FRONTEND)
router.post('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { student_id, total_fee, paid_amount } = req.body;

        const { data, error } = await supabase
            .from('fees')
            .insert([{
                student_id,
                total_fee: Number(total_fee),
                paid_amount: Number(paid_amount)
            }])
            .select();

        if (error) {
            console.error(error);
            return res.status(400).json({ error: error.message });
        }

        res.json(data[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Insert failed' });
    }
});

// DELETE FEE
router.delete('/:id', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('fees')
            .delete()
            .eq('id', req.params.id);

        if (error) return res.status(400).json({ error: error.message });

        res.json({ message: 'Deleted', data });

    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;