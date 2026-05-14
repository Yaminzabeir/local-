import { getCurrentUser, fetchOpportunities } from './supabase-client.js';
import { t, i18nReady } from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
    await i18nReady;

    // Check Auth State to update UI
    const user = await getCurrentUser();
    const navLinks = document.querySelector('.nav-links');

    if (user) {
        // Replace Login/Register with dashboard link
        const loginBtn = document.querySelector('a[href="login.html"]');
        const registerBtn = document.querySelector('a[href="register.html"]');

        if (loginBtn) loginBtn.remove();
        if (registerBtn) registerBtn.remove();

        const dashboardBtn = document.createElement('a');
        dashboardBtn.href = 'dashboard.html';
        dashboardBtn.className = 'btn btn-primary';
        dashboardBtn.textContent = t('nav.dashboard');
        // Insert before the lang switch button
        const langBtn = navLinks.querySelector('.lang-switch-btn');
        if (langBtn) {
            navLinks.insertBefore(dashboardBtn, langBtn);
        } else {
            navLinks.appendChild(dashboardBtn);
        }
    }

    // Load Featured Opportunities
    const featuredContainer = document.getElementById('featured-opportunities');
    if (featuredContainer) {
        const opps = await fetchOpportunities();

        if (opps && opps.length > 0) {
            featuredContainer.innerHTML = ''; // Clear loading
            opps.forEach(opp => {
                const card = document.createElement('div');
                card.className = 'glass-card opportunity-card';
                card.innerHTML = `
                    <h3>${opp.title}</h3>
                    <p class="org-name">${opp.organizations ? opp.organizations.organization_name : 'Local Org'}</p>
                    <p class="desc">${opp.description.substring(0, 100)}...</p>
                    <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-light, #e5e7eb); font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">${t('opps.postDate')}</span>
                            <span style="font-weight:600;">${new Date(opp.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">${t('opps.eventDate')}</span>
                            <span style="font-weight:600; color:#2563eb;">${new Date(opp.date).toLocaleDateString()}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">${t('opps.deadline')}</span>
                            <span style="font-weight:600; color:#ef4444;">${new Date(opp.deadline || opp.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="meta">
                        <span>📍 ${opp.location || 'Remote'}</span>
                    </div>
                    <a href="opportunity.html?id=${opp.id}" class="btn btn-sm btn-outline" style="margin-top: 1rem;">${t('featured.viewDetails')}</a>
                `;
                featuredContainer.appendChild(card);
            });
        } else {
            featuredContainer.innerHTML = `<p class="text-center" style="grid-column: 1/-1;">${t('featured.noResults')}</p>`;
        }
    }
});
