const express = require('express');
const router = express.Router();



// ======================================================
// 1. CLASS PERFORMANCE (IMPROVED)
// ======================================================
router.get('/class/:class_id', async (req, res) => {
    const { class_id } = req.params;

    try {
        const supabase = req.app.locals.supabase;
        const { data: results, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                student_id,
                students!inner(id, full_name, class_id)
            `)
            .eq('students.class_id', class_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = results || [];

        const analytics = safe.map(r => ({
            student_id: r.student_id,
            student_name: r.students.full_name,
            percentage: (r.marks / r.total_marks) * 100
        }));

        const avg =
            analytics.length > 0
                ? analytics.reduce((a, b) => a + b.percentage, 0) / analytics.length
                : 0;

        res.json({ class_id, avgPercentage: avg, data: analytics });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ======================================================
// 2. CLASS LEADERBOARD (NEW 🔥)
// ======================================================
router.get('/class/:class_id/leaderboard', async (req, res) => {
    const { class_id } = req.params;

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                student_id,
                students!inner(id, full_name, class_id)
            `)
            .eq('students.class_id', class_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];

        const leaderboardMap = {};

        safe.forEach(r => {
            const percent = (r.marks / r.total_marks) * 100;

            if (!leaderboardMap[r.student_id]) {
                leaderboardMap[r.student_id] = {
                    student_id: r.student_id,
                    student_name: r.students.name,
                    total: 0,
                    count: 0
                };
            }

            leaderboardMap[r.student_id].total += percent;
            leaderboardMap[r.student_id].count += 1;
        });

        const leaderboard = Object.values(leaderboardMap)
            .map(s => ({
                student_id: s.student_id,
                student_name: s.student_name,
                average: s.total / s.count
            }))
            .sort((a, b) => b.average - a.average);

        res.json({ class_id, leaderboard });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ======================================================
// 3. TOP STUDENTS (SCHOOL WIDE 🔥)
// ======================================================
router.get('/top-students', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                student_id,
                students!inner(id, full_name)
            `);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];

        const map = {};

        safe.forEach(r => {
            const percent = (r.marks / r.total_marks) * 100;

            if (!map[r.student_id]) {
                map[r.student_id] = {
                    student_id: r.student_id,
                    student_name: r.students.name,
                    total: 0,
                    count: 0
                };
            }

            map[r.student_id].total += percent;
            map[r.student_id].count += 1;
        });

        const top = Object.values(map)
            .map(s => ({
                student_id: s.student_id,
                student_name: s.student_name,
                average: s.total / s.count
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 10);

        res.json({ topStudents: top });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ======================================================
// 4. WEAK SUBJECT DETECTOR (NEW 🔥 AI INSIGHT)
// ======================================================
router.get('/student/:student_id/weak-subjects', async (req, res) => {
    const { student_id } = req.params;

    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                exams!inner(subject)
            `)
            .eq('student_id', student_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];

        const subjectMap = {};

        safe.forEach(r => {
            const percent = (r.marks / r.total_marks) * 100;
            const subject = r.exams.subject;

            if (!subjectMap[subject]) {
                subjectMap[subject] = { total: 0, count: 0 };
            }

            subjectMap[subject].total += percent;
            subjectMap[subject].count += 1;
        });

        const subjects = Object.entries(subjectMap).map(([subject, val]) => ({
            subject,
            average: val.total / val.count
        }));

        const weakSubjects = subjects
            .sort((a, b) => a.average - b.average)
            .slice(0, 3);

        res.json({ student_id, weakSubjects });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


// ======================================================
// 5. DASHBOARD SUMMARY (SUPER IMPORTANT 🔥)
// ======================================================
router.get('/dashboard', async (req, res) => {
    try {
        const supabase = req.app.locals.supabase;
        const { data, error } = await supabase
            .from('results')
            .select('marks, total_marks');

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];

        const avg =
            safe.length > 0
                ? safe.reduce((sum, r) => sum + (r.marks / r.total_marks) * 100, 0) / safe.length
                : 0;

        res.json({
            totalResults: safe.length,
            overallAverage: avg
        });

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/student/:student_id/weak-ai', async (req, res) => {
    const { student_id } = req.params;

    const supabase = req.app.locals.supabase;

    const { data, error } = await supabase
        .from('results')
        .select(`
            marks,
            total_marks,
            subjects(name)
        `)
        .eq('student_id', student_id);

    if (error) return res.status(400).json({ error: error.message });

    const stats = {};

    data.forEach(r => {
        const subject = r.subjects?.name || "Unknown";
        const percent = (r.marks / r.total_marks) * 100;

        if (!stats[subject]) {
            stats[subject] = { total: 0, count: 0 };
        }

        stats[subject].total += percent;
        stats[subject].count += 1;
    });

    const analysis = Object.keys(stats).map(subject => ({
        subject,
        average: stats[subject].total / stats[subject].count
    }));

    const weakSubjects = analysis
        .sort((a, b) => a.average - b.average)
        .slice(0, 3);

    res.json({
        student_id,
        weakSubjects,
        advice: weakSubjects.map(s =>
            `${s.subject} needs improvement (revise topics and do past papers)`
        )
    });
});

router.get('/student/:student_id/performance-ai', async (req, res) => {
    const { student_id } = req.params;

    const supabase = req.app.locals.supabase;

    const { data, error } = await supabase
        .from('results')
        .select(`
            marks,
            total_marks,
            subjects(name),
            exams(name)
        `)
        .eq('student_id', student_id);

    if (error) return res.status(400).json({ error: error.message });

    const subjects = {};

    data.forEach(r => {
        const subject = r.subjects?.name || "Unknown";
        const percent = (r.marks / r.total_marks) * 100;

        if (!subjects[subject]) {
            subjects[subject] = [];
        }

        subjects[subject].push(percent);
    });

    const analysis = Object.entries(subjects).map(([subject, arr]) => {
        const avg = arr.reduce((a,b)=>a+b,0)/arr.length;

        return {
            subject,
            average: avg,
            status:
                avg >= 70 ? "Excellent" :
                avg >= 50 ? "Average" :
                "Weak"
        };
    });

    res.json({
        student_id,
        analysis
    });
});

module.exports = router;