require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// SECURITY LAYER
// ===============================
app.set('trust proxy', 1);
app.use(helmet());

app.use(cors({
    origin: '*'
}));

app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300
});
app.use(limiter);

// ===============================
// SUPABASE
// ===============================
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

app.locals.supabase = supabase;

// ===============================
// AUTH MIDDLEWARE
// ===============================
function authMiddleware(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = header.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.user_id || !decoded.school_id || !decoded.role) {
            return res.status(401).json({ error: "Invalid token payload" });
        }

        req.user = {
            user_id: decoded.user_id,
            school_id: decoded.school_id,
            role: decoded.role,
            plan: decoded.plan || "basic"
        };

        next();

    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

// ===============================
// SUBSCRIPTION MIDDLEWARE
// ===============================
async function subscriptionMiddleware(req, res, next) {
    const supabase = req.app.locals.supabase;

    try {
        const { school_id } = req.user;

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('school_id', school_id)
            .eq('status', 'active')
            .maybeSingle();

        if (error) {
            return res.status(500).json({ error: 'Subscription check failed' });
        }

        if (!data) {
            return res.status(403).json({
                error: 'Subscription inactive. Please pay to continue.'
            });
        }

        if (data.end_date && new Date(data.end_date) < new Date()) {
            return res.status(403).json({
                error: 'Subscription expired. Please renew.'
            });
        }

        req.user.plan = data.plan || "basic";

        next();

    } catch (err) {
        return res.status(500).json({ error: 'Subscription error' });
    }
}

// ===============================
// PLAN ACCESS CONTROL
// ===============================
function requirePlan(minPlan) {

    const hierarchy = {
        basic: 1,
        pro: 2,
        premium: 3
    };

    return (req, res, next) => {

        const userPlan = req.user?.plan || "basic";

        if (!hierarchy[userPlan]) {
            return res.status(403).json({ error: "Invalid plan" });
        }

        if (hierarchy[userPlan] < hierarchy[minPlan]) {
            return res.status(403).json({
                error: `Upgrade required: ${minPlan} plan needed`
            });
        }

        next();
    };
}

// ===============================
// ROUTES
// ===============================

// PUBLIC
app.use('/api/schools', require('./routes/schools'));
app.use('/api/auth', require('./routes/auth'));

// AUTH + SUBSCRIPTION
const protected = (route) =>
    [authMiddleware, subscriptionMiddleware, require(route)];

app.use('/api/students', authMiddleware, subscriptionMiddleware, require('./routes/students'));
app.use('/api/teachers', authMiddleware, subscriptionMiddleware, require('./routes/teachers'));
app.use('/api/parents', authMiddleware, subscriptionMiddleware, require('./routes/parents'));
app.use('/api/fees', authMiddleware, subscriptionMiddleware, require('./routes/fees'));
app.use('/api/notifications', authMiddleware, subscriptionMiddleware, require('./routes/notifications'));
app.use('/api/subjects', authMiddleware, subscriptionMiddleware, require('./routes/subjects'));
app.use('/api/classes', authMiddleware, subscriptionMiddleware, require('./routes/classes'));
app.use('/api/finance', authMiddleware, subscriptionMiddleware, require('./routes/finance'));

// PRO FEATURES
app.use('/api/results',
    authMiddleware,
    subscriptionMiddleware,
    requirePlan("pro"),
    require('./routes/results')
);

app.use('/api/exams',
    authMiddleware,
    subscriptionMiddleware,
    requirePlan("pro"),
    require('./routes/exams')
);

// PREMIUM FEATURES
app.use('/api/aiTutor',
    authMiddleware,
    subscriptionMiddleware,
    requirePlan("premium"),
    require('./routes/aiTutor')
);

app.use('/api/aiAnalytics',
    authMiddleware,
    subscriptionMiddleware,
    requirePlan("premium"),
    require('./routes/aiAnalytics')
);

// MPESA (payment only, no subscription block)
app.use('/api/mpesa',
    authMiddleware,
    require('./routes/mpesa')
);

// ===============================
// ADMIN (SECURED)
// ===============================
app.get('/api/admin/revenue', authMiddleware, async (req, res) => {

    if (req.user.role !== "super_admin") {
        return res.status(403).json({ error: "Access denied" });
    }

    const { data, error } = await supabase
        .from('subscriptions')
        .select('status, amount');

    if (error) {
        return res.status(500).json({ error: "Failed to fetch revenue" });
    }

    const total_schools = data.length;
    const active = data.filter(s => s.status === 'active').length;
    const inactive = data.filter(s => s.status !== 'active').length;

    const revenue = data
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);

    res.json({
        total_schools,
        active,
        inactive,
        revenue
    });
});

// ===============================
// HEALTH CHECK
// ===============================
app.get('/', (req, res) => {
    res.send('🚀 AcademiX SaaS Running');
});

// ===============================
// ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});