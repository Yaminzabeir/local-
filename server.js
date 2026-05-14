const express = require('express');
const path = require('path');
require('dotenv').config();
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

// --- Helper: upsert user profile via Supabase REST API (service role key bypasses RLS) ---
async function supabaseUpsertUser(id, email, fullName, role) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
                id,
                email,
                full_name: fullName,
                role,
                password_hash: 'SUPABASE_AUTH' // Placeholder to satisfy NOT NULL constraint
            }),
        });
        if (!resp.ok) {
            const errBody = await resp.text();
            console.error('User upsert HTTP error:', resp.status, errBody);
        }
    } catch (err) {
        console.error('User upsert failed (non-fatal):', err.message);
    }
}

// --- Helper: fetch user profile via Supabase REST API ---
async function supabaseFetchUser(id) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${id}&select=*`, {
            method: 'GET',
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            },
        });
        if (resp.ok) {
            const data = await resp.json();
            return data && data.length > 0 ? data[0] : null;
        }
    } catch (err) {
        console.error('Fetch user error:', err.message);
    }
    return null;
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
                    // Ensure user row exists in users table
                    const u = login.data.user;
                    let finalProfile = null;
                    if (u) {
                        finalProfile = await supabaseFetchUser(u.id);
                        if (!finalProfile) {
                            finalProfile = {
                                id: u.id,
                                email: u.email,
                                full_name: u.user_metadata?.full_name || fullName || '',
                                role: u.user_metadata?.role || role || 'volunteer'
                            };
                            await supabaseUpsertUser(finalProfile.id, finalProfile.email, finalProfile.full_name, finalProfile.role);
                        }
                    }
                    return res.json({ user: login.data.user, session: login.data, profile: finalProfile });
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
        let finalProfile = null;
        if (createData.id) {
            finalProfile = {
                id: createData.id,
                email,
                full_name: fullName || '',
                role: role || 'volunteer'
            };
            await supabaseUpsertUser(finalProfile.id, finalProfile.email, finalProfile.full_name, finalProfile.role);
        }

        return res.json({ user: login.data.user, session: login.data, profile: finalProfile });
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

        // Best-effort: ensure user row exists in users table
        const u = login.data.user;
        let finalProfile = null;
        if (u) {
            finalProfile = await supabaseFetchUser(u.id);
            if (!finalProfile) {
                finalProfile = {
                    id: u.id,
                    email: u.email,
                    full_name: u.user_metadata?.full_name || '',
                    role: u.user_metadata?.role || 'volunteer'
                };
                await supabaseUpsertUser(finalProfile.id, finalProfile.email, finalProfile.full_name, finalProfile.role);
            }
        }

        return res.json({ user: login.data.user, session: login.data, profile: finalProfile });
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
