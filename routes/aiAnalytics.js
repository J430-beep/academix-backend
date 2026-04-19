const express = require('express');
const router = express.Router();

function getSchoolId(req) {
    return req.query.school_id || req.body.school_id || req.headers['x-school-id'] || null;
}

// ======================================================
// 1. CLASS PERFORMANCE
// ======================================================
router.get('/class/:class_id', async (req, res) => {
    const { class_id } = req.params;
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                student_id,
                students!inner(id, full_name, class_id, school_id)
            `)
            .eq('school_id', school_id)
            .eq('students.class_id', class_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];

        const analytics = safe.map(r => ({
            student_id: r.student_id,
            student_name: r.students?.full_name || 'N/A',
            percentage: Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0
        }));

        const avg =
            analytics.length > 0
                ? analytics.reduce((a, b) => a + b.percentage, 0) / analytics.length
                : 0;

        res.json({ class_id, school_id, avgPercentage: avg, data: analytics });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================
// 2. CLASS LEADERBOARD
// ======================================================
router.get('/class/:class_id/leaderboard', async (req, res) => {
    const { class_id } = req.params;
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                student_id,
                students!inner(id, full_name, class_id, school_id)
            `)
            .eq('school_id', school_id)
            .eq('students.class_id', class_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];
        const leaderboardMap = {};

        safe.forEach(r => {
            const percent = Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;

            if (!leaderboardMap[r.student_id]) {
                leaderboardMap[r.student_id] = {
                    student_id: r.student_id,
                    student_name: r.students?.full_name || 'N/A',
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
                average: s.count > 0 ? s.total / s.count : 0
            }))
            .sort((a, b) => b.average - a.average);

        res.json({ class_id, school_id, leaderboard });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================
// 3. TOP STUDENTS (SCHOOL WIDE)
// ======================================================
router.get('/top-students', async (req, res) => {
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                student_id,
                students!inner(id, full_name, school_id)
            `)
            .eq('school_id', school_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];
        const map = {};

        safe.forEach(r => {
            const percent = Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;

            if (!map[r.student_id]) {
                map[r.student_id] = {
                    student_id: r.student_id,
                    student_name: r.students?.full_name || 'N/A',
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
                average: s.count > 0 ? s.total / s.count : 0
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 10);

        res.json({ school_id, topStudents: top });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================
// 4. SUBJECT PERFORMANCE
// ======================================================
router.get('/subject/:subject_id', async (req, res) => {
    const { subject_id } = req.params;
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                subject_id,
                subjects!inner(id, name, school_id)
            `)
            .eq('school_id', school_id)
            .eq('subject_id', subject_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];
        const analytics = safe.map(r => ({
            subject_id: r.subject_id,
            subject_name: r.subjects?.name || 'N/A',
            percentage: Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0
        }));

        const avg =
            analytics.length > 0
                ? analytics.reduce((a, b) => a + b.percentage, 0) / analytics.length
                : 0;

        res.json({ subject_id, school_id, avgPercentage: avg, data: analytics });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================
// 5. WEAK SUBJECT DETECTOR
// ======================================================
router.get('/student/:student_id/weak-subjects', async (req, res) => {
    const { student_id } = req.params;
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select(`
                marks,
                total_marks,
                subject_id,
                subjects!inner(id, name, school_id)
            `)
            .eq('school_id', school_id)
            .eq('student_id', student_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];
        const subjectMap = {};

        safe.forEach(r => {
            const percent = Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;
            const subject = r.subjects?.name || 'Unknown';

            if (!subjectMap[subject]) {
                subjectMap[subject] = { total: 0, count: 0 };
            }

            subjectMap[subject].total += percent;
            subjectMap[subject].count += 1;
        });

        const weakSubjects = Object.entries(subjectMap)
            .map(([subject, val]) => ({
                subject,
                average: val.count > 0 ? val.total / val.count : 0
            }))
            .sort((a, b) => a.average - b.average)
            .slice(0, 3);

        res.json({ student_id, school_id, weakSubjects });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================
// 6. DASHBOARD SUMMARY
// ======================================================
router.get('/dashboard', async (req, res) => {
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    try {
        const supabase = req.app.locals.supabase;

        const { data, error } = await supabase
            .from('results')
            .select('marks, total_marks')
            .eq('school_id', school_id);

        if (error) return res.status(400).json({ error: error.message });

        const safe = data || [];

        const avg =
            safe.length > 0
                ? safe.reduce((sum, r) => sum + (Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0), 0) / safe.length
                : 0;

        res.json({
            school_id,
            totalResults: safe.length,
            overallAverage: avg
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================
// 7. AI WEAK SUBJECTS
// ======================================================
router.get('/student/:student_id/weak-ai', async (req, res) => {
    const { student_id } = req.params;
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    const supabase = req.app.locals.supabase;

    const { data, error } = await supabase
        .from('results')
        .select(`
            marks,
            total_marks,
            subject_id,
            subjects!inner(id, name, school_id)
        `)
        .eq('school_id', school_id)
        .eq('student_id', student_id);

    if (error) return res.status(400).json({ error: error.message });

    const stats = {};

    (data || []).forEach(r => {
        const subject = r.subjects?.name || "Unknown";
        const percent = Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;

        if (!stats[subject]) {
            stats[subject] = { total: 0, count: 0 };
        }

        stats[subject].total += percent;
        stats[subject].count += 1;
    });

    const analysis = Object.keys(stats).map(subject => ({
        subject,
        average: stats[subject].count > 0 ? stats[subject].total / stats[subject].count : 0
    }));

    const weakSubjects = analysis
        .sort((a, b) => a.average - b.average)
        .slice(0, 3);

    res.json({
        student_id,
        school_id,
        weakSubjects,
        advice: weakSubjects.map(s =>
            `${s.subject} needs improvement (revise topics and do past papers)`
        )
    });
});

// ======================================================
// 8. AI PERFORMANCE
// ======================================================
router.get('/student/:student_id/performance-ai', async (req, res) => {
    const { student_id } = req.params;
    const school_id = getSchoolId(req);

    if (!school_id) {
        return res.status(400).json({ error: 'school_id required' });
    }

    const supabase = req.app.locals.supabase;

    const { data, error } = await supabase
        .from('results')
        .select(`
            marks,
            total_marks,
            subject_id,
            subjects!inner(id, name, school_id)
        `)
        .eq('school_id', school_id)
        .eq('student_id', student_id);

    if (error) return res.status(400).json({ error: error.message });

    const subjects = {};

    (data || []).forEach(r => {
        const subject = r.subjects?.name || "Unknown";
        const percent = Number(r.total_marks) > 0 ? (Number(r.marks) / Number(r.total_marks)) * 100 : 0;

        if (!subjects[subject]) {
            subjects[subject] = [];
        }

        subjects[subject].push(percent);
    });

    const analysis = Object.entries(subjects).map(([subject, arr]) => {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;

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
        school_id,
        analysis
    });
});

module.exports = router;