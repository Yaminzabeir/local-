
const supabaseUrl = 'https://rjrbzwqrpczmzhkfvyoy.supabase.co'
const supabaseKey = 'sb_publishable_AvB-QuSpf_R5DiiLGSb3Hw_9qaGI6Sj'
const client = supabase.createClient(supabaseUrl, supabaseKey)

// Export the client for use in other modules
export { client as supabase };

export const signUp = async (email, password, fullName, role) => {
    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName, role }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { data: null, error: { message: data.error || 'Signup failed' } };
        }
        // Set the Supabase client session so dashboard queries work
        if (data.session && data.session.access_token && data.session.refresh_token) {
            await client.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
            });
        }
        // Save user profile to localStorage for dashboard
        const user = data.user || data.session?.user;
        const profile = data.profile; // Server returns the resolved database profile
        if (user && profile) {
            localStorage.setItem('user_profile', JSON.stringify(profile));
            // Backend already ensures the profile exists in the users table via service key
        }
        return { data, error: null };
    } catch (err) {
        console.error('signUp error:', err);
        return { data: null, error: { message: err.message } };
    }
};

export const signIn = async (email, password) => {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            return { data: null, error: { message: data.error || 'Login failed' } };
        }
        // Set the Supabase client session so dashboard queries work
        if (data.session && data.session.access_token && data.session.refresh_token) {
            await client.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
            });
        }
        // Save user profile to localStorage for dashboard
        const user = data.user || data.session?.user;
        const profile = data.profile; // Server returns the resolved database profile
        if (user && profile) {
            localStorage.setItem('user_profile', JSON.stringify(profile));
            // Backend already ensures the profile exists in the users table via service key
        }
        return { data, error: null };
    } catch (err) {
        console.error('signIn error:', err);
        return { data: null, error: { message: err.message } };
    }
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
