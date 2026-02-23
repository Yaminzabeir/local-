
const supabaseUrl = 'https://rjrbzwqrpczmzhkfvyoy.supabase.co'
const supabaseKey = 'sb_publishable_AvB-QuSpf_R5DiiLGSb3Hw_9qaGI6Sj'
const client = supabase.createClient(supabaseUrl, supabaseKey)

// Export the client for use in other modules
export { client as supabase };

export const signUp = async (email, password, fullName, role) => {
    // Use server-side signup to avoid sending verification emails from client.
    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName, role }),
        });
        let data;
        try {
            data = await res.json();
        } catch (e) {
            throw new Error('Invalid JSON response from server');
        }
        if (!res.ok) {
            const message = data && data.error ? data.error : 'Signup failed';
            const details = data && data.details ? data.details : null;
            const err = new Error(message);
            err.details = details;
            throw err;
        }
        return { data, error: null };
    } catch (err) {
        console.error('signUp error:', err);
        return { data: null, error: { message: err.message, details: err.details || null } };
    }
};

export const signIn = async (email, password) => {
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

export const signOut = async () => {
    const { error } = await client.auth.signOut();
    return { error };
};

export const getUserProfile = async (userId) => {
    const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
};

// Helper to get current user
export const getCurrentUser = async () => {
    const { data: { user } } = await client.auth.getUser();
    return user;
};

// Helper query function for opportunities
export const fetchOpportunities = async () => {
    // Assuming 'opportunities' table exists as per schema
    const { data, error } = await client
        .from('opportunities')
        .select(`
            *,
            organizations (
                organization_name
            )
        `)
        .eq('status', 'active')
        .limit(3);

    if (error) {
        console.error('Error fetching opportunities:', error);
        return [];
    }
    return data;
};
