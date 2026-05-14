import { supabase, getCurrentUser } from './supabase-client.js';
import { t, i18nReady } from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
    await i18nReady;

    // ---- Navbar Auth State ----
    const stored = localStorage.getItem('user_profile');
    const user = stored ? JSON.parse(stored) : null;
    const loginLink = document.getElementById('nav-login');
    const dashboardLink = document.getElementById('nav-dashboard');

    if (user && user.id) {
        if (loginLink) loginLink.style.display = 'none';
        if (dashboardLink) dashboardLink.style.display = 'inline-block';
    } else {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (dashboardLink) dashboardLink.style.display = 'none';
    }

    // 1. Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const oppId = urlParams.get('id');

    if (!oppId) {
        window.location.href = 'opportunities.html';
        return;
    }

    // 2. Fetch Details
    const { data: opp, error } = await supabase
        .from('opportunities')
        .select(`
            *,
            organizations ( organization_name )
        `)
        .eq('id', oppId)
        .single();

    if (error || !opp) {
        console.error('Error fetching details:', error);
        document.getElementById('loading').innerHTML = `<h1>${t('oppDetail.notFound')}</h1>`;
        return;
    }

    // 3. Render
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    document.title = `${opp.title} - Local Volunteer Hub`;
    document.getElementById('org-name').textContent = opp.organizations?.organization_name || 'Organization';
    document.getElementById('opp-title').textContent = opp.title;
    document.getElementById('opp-desc').textContent = opp.description;

    document.getElementById('opp-location').textContent = opp.location || 'Remote';
    document.getElementById('opp-date').textContent = new Date(opp.date).toLocaleDateString();
    document.getElementById('opp-time').textContent = opp.start_time ? `${opp.start_time.slice(0, 5)} - ${opp.end_time.slice(0, 5)}` : t('oppDetail.flexible');
    document.getElementById('opp-slots').textContent = `${opp.slots_available} ${t('oppDetail.slotsAvailable')}`;

    const applyBtn = document.getElementById('apply-btn');
    applyBtn.onclick = () => {
        document.getElementById('opp-id-input').value = opp.id;
        document.getElementById('modal-opp-title').textContent = opp.title;
        document.getElementById('apply-modal').classList.add('open');
    }

    // 4. Handle Application
    document.getElementById('apply-form').onsubmit = async (e) => {
        e.preventDefault();
        // Auth check — use localStorage (consistent with dashboard.js)
        const stored = localStorage.getItem('user_profile');
        const user = stored ? JSON.parse(stored) : null;

        if (!user || !user.id) {
            alert(t('modal.loginRequired'));
            window.location.href = `login.html?redirect=opportunity.html?id=${oppId}`;
            return;
        }

        const modal = document.getElementById('apply-modal');
        modal.classList.remove('open');

        try {
            const { error: applyError } = await supabase
                .from('applications')
                .insert([{
                    volunteer_id: user.id,
                    opportunity_id: oppId,
                    status: 'pending'
                }]);

            if (applyError) {
                if (applyError.code === '23505') {
                    alert(t('modal.alreadyApplied'));
                } else {
                    console.error(applyError);
                    alert(t('modal.appError') + ': ' + applyError.message);
                }
            } else {
                alert(t('modal.appSuccess'));
            }
        } catch (err) {
            console.error(err);
            alert(t('modal.unexpectedError'));
        }
    };
});
