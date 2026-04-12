const express = require('express');
const router = express.Router();

// Get all fees
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('fees')
            .select(`
                id,
                student_id,
                students(full_name, class_id),
                amount,
                status,
                created_at
            `)
            .order('created_at', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get fees for a specific student
router.get('/student/:student_id', async (req, res) => {
    const { student_id } = req.params;
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('fees')
            .select('*')
            .eq('student_id', student_id)
            .order('created_at', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add a fee payment
router.post('/', async (req, res) => {
    const { student_id, amount, status } = req.body;
    if (!student_id || !amount)
        return res.status(400).json({ error: 'Student ID and amount are required' });

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('fees')
            .insert([{ student_id, amount, status: status || 'Pending' }])
            .select();

        if (error) return res.status(400).json({ error: error.message });

        res.status(201).json({ message: 'Fee payment recorded', fee: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update a fee payment
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { amount, status } = req.body;

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('fees')
            .update({ amount, status })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Fee updated', fee: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a fee record
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('fees')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Fee deleted', fee: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Calculate total paid and balance for a student
router.get('/student/:student_id/summary', async (req, res) => {
    const { student_id } = req.params;

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('fees')
            .select('amount')
            .eq('student_id', student_id);

        if (error) return res.status(400).json({ error: error.message });

        const totalPaid = data.reduce((sum, record) => sum + Number(record.amount), 0);
        // For simplicity, assume total fee is 10000 per term (can be dynamic per class)
        const totalFee = 10000;
        const balance = totalFee - totalPaid;

        res.json({ student_id, totalFee, totalPaid, balance });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;