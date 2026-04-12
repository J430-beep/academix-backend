// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

//---------- TRUST PROXY (RENDER FIX) ----------
app.set('trust proxy', 1);

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ---------- SUPABASE SETUP ----------
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
app.locals.supabase = supabase;

// ---------- JWT AUTH MIDDLEWARE ----------
function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ---------- ROUTES ----------
app.use('/api/students', require('./routes/students'));       // Students CRUD
app.use('/api/teachers', require('./routes/teachers'));       // Teachers CRUD
app.use('/api/parents', require('./routes/parents'));         // Parents CRUD
app.use('/api/exams', require('./routes/exams'));             // Exams CRUD
app.use('/api/results', require('./routes/results'));         // Exam results CRUD
app.use('/api/fees', require('./routes/fees'));               // Fee payments CRUD
app.use('/api/notifications', require('./routes/notifications')); // Notifications CRUD
app.use('/api/aiTutor', require('./routes/aiTutor'));         // AI Tutor Q&A
app.use('/api/aiAnalytics', require('./routes/aiAnalytics')); // AI analytics & performance

// ---------- HEALTH CHECK ----------
app.get('/', (req, res) => res.send('AcademiX Backend Running ✅'));

// ---------- ERROR HANDLING ----------
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});