import { supabase, getCurrentUser } from './supabase-client.js';
import { t, i18nReady } from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
    await i18nReady;

    // ---- Navbar Auth State ----
    const stored = localStorage.getItem('user_profile');
    const user = stored ? JSON.parse(stored) : null;
    const loginLink = document.querySelector('a[href="login.html"]');
    const dashboardLink = document.querySelector('a[href="dashboard.html"]');

    if (user && user.id) {
        if (loginLink) loginLink.style.display = 'none';
        if (dashboardLink) dashboardLink.style.display = 'inline-block';
    } else {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (dashboardLink) dashboardLink.style.display = 'none';
    }

    loadOpportunities();

    // Search Logic
    document.getElementById('search-btn').addEventListener('click', () => {
        const query = document.getElementById('search-input').value;
        const loc = document.getElementById('location-filter').value;
        loadOpportunities(query, loc);
    });

    // Handle Application Submit
    document.getElementById('apply-form').onsubmit = async (e) => {
        e.preventDefault();
        // Auth check — use localStorage (consistent with dashboard.js)
        const stored = localStorage.getItem('user_profile');
        const user = stored ? JSON.parse(stored) : null;
        if (!user || !user.id) {
            alert(t('modal.loginRequired'));
            window.location.href = 'login.html';
            return;
        }

        const oppId = document.getElementById('opp-id-input').value;

        // Optimistic UI for University Project demo
        const modal = document.getElementById('apply-modal');
        modal.classList.remove('open');

        try {
            const { error } = await supabase
                .from('applications')
                .insert([{
                    volunteer_id: user.id,
                    opportunity_id: oppId,
                    status: 'pending'
                }]);

            if (error) {
                if (error.code === '23505') { // Unique violation
                    alert(t('modal.alreadyApplied'));
                } else {
                    console.error(error);
                    alert(t('modal.appError'));
                }
            } else {
                alert(t('modal.appSuccess'));
            }
        } catch (err) {
            console.error(err);
        }
    };
});

async function loadOpportunities(searchPrefix = '', locationFilter = '') {
    const grid = document.getElementById('opportunities-grid');
    grid.innerHTML = `<div class="loading-state" style="grid-column: 1/-1; text-align: center;">${t('opps.loading')}</div>`;

    let query = supabase
        .from('opportunities')
        .select(`
            id,
            title,
            description,
            location,
            date,
            slots_available,
            organization_id,
            created_at,
            organizations ( organization_name )
        `)
        .eq('status', 'active');

    if (searchPrefix) {
        query = query.ilike('title', `%${searchPrefix}%`);
    }

    // Note: Exact match for location in this simple demo
    if (locationFilter) {
        query = query.eq('location', locationFilter);
    }

    const { data: opportunities, error } = await query;

    if (error) {
        console.error('Error fetching opportunities:', error);
        grid.innerHTML = `<p>${t('opps.error')}</p>`;
        return;
    }

    grid.innerHTML = '';

    if (opportunities.length === 0) {
        grid.innerHTML = `<p>${t('opps.noResults')}</p>`;
        return;
    }

    opportunities.forEach(opp => {
        const card = document.createElement('div');
        card.className = 'glass-card opp-card';
        // Post Date is created_at, Deadline is the event date
        card.innerHTML = `
            <div class="opp-org-name">${opp.organizations?.organization_name || 'Organization'}</div>
            <a href="opportunity.html?id=${opp.id}" style="text-decoration:none; color:inherit;">
                <h3 class="opp-title">${opp.title}</h3>
            </a>
            <p style="color: var(--text-muted); flex-grow: 1;">${opp.description.substring(0, 150)}...</p>
            
            <div class="opp-metadata-extended" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-light); font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted);" data-i18n="opps.postDate">${t('opps.postDate')}</span>
                    <span style="font-weight:600;">${new Date(opp.created_at).toLocaleDateString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted);" data-i18n="opps.eventDate">${t('opps.eventDate')}</span>
                    <span style="font-weight:600; color:#2563eb;">${new Date(opp.date).toLocaleDateString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted);" data-i18n="opps.deadline">${t('opps.deadline')}</span>
                    <span style="font-weight:600; color:#ef4444;">${new Date(opp.deadline || opp.date).toLocaleDateString()}</span>
                </div>
            </div>

            <div class="opp-details">
                <div class="opp-detail-item">
                    <span>📍</span> ${opp.location || 'Remote'}
                </div>
                <div class="opp-detail-item">
                    <span>👥</span> ${opp.slots_available} ${t('opps.slotsLeft')}
                </div>
            </div>

            <div class="action-row">
                <a href="opportunity.html?id=${opp.id}" class="btn btn-secondary" data-i18n="opps.viewDetails">${t('opps.viewDetails')}</a>
                <button class="btn btn-primary btn-apply" data-id="${opp.id}" data-title="${opp.title}" data-i18n="opps.applyNow">${t('opps.applyNow')}</button>
            </div>
        `;
        grid.appendChild(card);
    });

    // Bind Apply Buttons
    document.querySelectorAll('.btn-apply').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.dataset.id;
            const title = e.target.dataset.title;
            openApplyModal(id, title);
        };
    });
}

function openApplyModal(id, title) {
    document.getElementById('opp-id-input').value = id;
    document.getElementById('modal-opp-title').textContent = title;
    document.getElementById('apply-modal').classList.add('open');
}
