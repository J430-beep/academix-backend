const express = require('express');
const router = express.Router();

// Get all notifications
router.get('/', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get notifications for a specific user
router.get('/user/:user_id', async (req, res) => {
    const { user_id } = req.params;
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add a new notification
router.post('/', async (req, res) => {
    const { user_id, title, message, category } = req.body;
    if (!user_id || !title || !message)
        return res.status(400).json({ error: 'User ID, title, and message are required' });

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('notifications')
            .insert([{ user_id, title, message, category: category || 'General', read: false }])
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json({ message: 'Notification sent', notification: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
    const { id } = req.params;
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Notification marked as read', notification: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .select();

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Notification deleted', notification: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;