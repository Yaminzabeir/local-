const express = require('express');
const path = require('path');
require('dotenv').config();
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Server-side signup endpoint that uses the Supabase service_role key
app.post('/api/signup', async (req, res) => {
    // Use explicit throws so the centralized error handler can provide details.
    class HttpError extends Error {
        constructor(status, message, details) {
            super(message);
            this.status = status;
            this.details = details;
        }
    }

    try {
        const { email, password, fullName, role } = req.body || {};
        if (!email || !password) throw new HttpError(400, 'Missing required fields', { required: ['email','password'] });

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.SUPABASE_URL || 'https://rjrbzwqrpczmzhkfvyoy.supabase.co';

        if (!serviceKey) throw new HttpError(500, 'Service role key not configured on server. Set SUPABASE_SERVICE_ROLE_KEY in .env');

        const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
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
                user_metadata: { full_name: fullName, role }
            }),
        });

        let data;
        try {
            data = await resp.json();
        } catch (parseErr) {
            throw new HttpError(502, 'Invalid JSON from Supabase admin API', { originalError: parseErr.message });
        }

        if (!resp.ok) {
            // Include Supabase returned body for debugging
            throw new HttpError(resp.status, 'Supabase admin API error', { supabase: data });
        }

        // Best-effort: insert profile row, but don't fail signup if this fails
        if (data && data.id) {
            try {
                await db`INSERT INTO users (id, email, full_name, role) VALUES (${data.id}, ${email}, ${fullName}, ${role})`;
            } catch (dbErr) {
                console.error('Profile insert failed:', dbErr);
                // Attach non-fatal DB error details to response
                data._profileInsertError = dbErr.message || String(dbErr);
            }
        }

        return res.json(data);
    } catch (err) {
        // If it's an HttpError, use its status, otherwise 500
        console.error('Signup error:', err);
        const status = err.status || 500;
        const payload = { error: err.message };
        if (err.details) payload.details = err.details;
        return res.status(status).json(payload);
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
