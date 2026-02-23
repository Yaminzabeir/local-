const express = require('express');
const path = require('path');
require('dotenv').config();
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Helper: sign in via Supabase GoTrue (returns session) ---
async function supabaseSignIn(email, password) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
}

// --- POST /api/signup ---
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.SUPABASE_URL;
        if (!serviceKey || !supabaseUrl) return res.status(500).json({ error: 'Server auth not configured.' });

        // 1. Try to create the user (admin API, auto-confirms email)
        const createResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName, role },
            }),
        });
        const createData = await createResp.json();

        if (!createResp.ok) {
            const code = createData.error_code || createData.code;

            // 2. If email already exists, try signing in with provided password
            if (code === 'email_exists') {
                const login = await supabaseSignIn(email, password);
                if (login.ok) {
                    return res.json({ user: login.data.user, session: login.data });
                }
                // Wrong password — don't reveal that the account exists with different creds
                return res.status(409).json({ error: 'An account with this email already exists.' });
            }

            const msg = createData.msg || createData.message || 'Signup failed';
            return res.status(createResp.status).json({ error: msg });
        }

        // 3. User created — now sign them in to get a session
        const login = await supabaseSignIn(email, password);
        if (!login.ok) {
            // User was created but sign-in failed (shouldn't happen)
            return res.status(500).json({ error: 'Account created but auto-login failed. Please log in manually.' });
        }

        // 4. Best-effort: insert profile row into users table
        if (createData.id) {
            try {
                await db`INSERT INTO users (id, email, full_name, role) VALUES (${createData.id}, ${email}, ${fullName || ''}, ${role || 'volunteer'})`;
            } catch (dbErr) {
                console.error('Profile insert failed (non-fatal):', dbErr.message);
            }
        }

        return res.json({ user: login.data.user, session: login.data });
    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- POST /api/login ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

        const login = await supabaseSignIn(email, password);
        if (!login.ok) {
            const msg = login.data.error_description || login.data.msg || 'Invalid email or password.';
            return res.status(login.status).json({ error: msg });
        }

        return res.json({ user: login.data.user, session: login.data });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// Central error-handling middleware (catches thrown errors anywhere)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    const status = err && err.status ? err.status : 500;
    const body = { error: err && err.message ? err.message : 'Internal Server Error' };
    if (err && err.details) body.details = err.details;
    res.status(status).json(body);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for SPA routing if needed (though we are using multi-page for better structure in vanilla)
app.get('*', (req, res) => {
    // If the file exists in public, it handles itself.
    // If not, send index.html or 404. 
    // For this simple MP app, we might check if it's an API call or page.
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
