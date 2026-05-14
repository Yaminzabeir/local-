/**
 * i18n.js — Lightweight internationalization module
 * Supports English (en) and Arabic (ar).
 * Layout/alignment stays LTR — only text content changes.
 */

let translations = {};
let currentLang = localStorage.getItem('lang') || 'ar';

/**
 * Fetch translations immediately at module load time.
 * Other modules can `await i18nReady` before using t().
 */
const i18nReady = (async () => {
    try {
        const res = await fetch(`/lang/${currentLang}.json`);
        if (!res.ok) throw new Error(`Failed to load ${currentLang}.json`);
        translations = await res.json();
    } catch (err) {
        console.error('i18n load error:', err);
    }
})();

/**
 * Apply translations to DOM once it's ready.
 */
async function initI18n() {
    await i18nReady;
    applyTranslations();
    updateLangSwitcher();
    updateArabicFont();
    
    document.querySelectorAll('.lang-switch-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            await toggleLanguage();
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    initI18n();
}

/**
 * Load translations for the given language and apply to DOM.
 */
async function loadLanguage(lang) {
    try {
        const res = await fetch(`/lang/${lang}.json`);
        if (!res.ok) throw new Error(`Failed to load ${lang}.json`);
        translations = await res.json();
        currentLang = lang;
        localStorage.setItem('lang', lang);
        applyTranslations();
        updateLangSwitcher();
        updateArabicFont();
    } catch (err) {
        console.error('i18n load error:', err);
    }
}

/**
 * Apply translations to all elements with data-i18n attribute.
 */
function applyTranslations() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = translations[key];
        if (val !== undefined) {
            if (val.includes('<br>')) {
                el.innerHTML = val;
            } else {
                el.textContent = val;
            }
        }
    });

    // innerHTML (explicit)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const val = translations[key];
        if (val !== undefined) el.innerHTML = val;
    });

    // Placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = translations[key];
        if (val !== undefined) el.setAttribute('placeholder', val);
    });
}

/**
 * Get a translated string by key. Used in JS for dynamic content.
 */
function t(key, replacements = {}) {
    let val = translations[key] || key;
    Object.keys(replacements).forEach(k => {
        val = val.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), replacements[k]);
    });
    return val;
}

/**
 * Switch language and reload translations.
 */
async function switchLanguage(lang) {
    await loadLanguage(lang);
}

/**
 * Get current language code.
 */
function getCurrentLang() {
    return currentLang;
}

/**
 * Toggle between en and ar.
 */
async function toggleLanguage() {
    const newLang = currentLang === 'en' ? 'ar' : 'en';
    await switchLanguage(newLang);
}

/**
 * Update the language switcher button text.
 */
function updateLangSwitcher() {
    document.querySelectorAll('.lang-switch-btn').forEach(btn => {
        const flagCode = currentLang === 'en' ? 'sa' : 'gb';
        const flagUrl = `https://flagcdn.com/24x18/${flagCode}.png`;
        const flagImg = `<img src="${flagUrl}" width="20" style="border-radius: 2px;" alt="flag">`;
        const label = translations['lang.switch'] || (currentLang === 'en' ? 'العربية' : 'English');
        btn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; gap:0.4rem;">${flagImg} <span>${label}</span></span>`;
    });
}

/**
 * When Arabic is active, add Arabic font for proper glyph rendering and set RTL orientation.
 */
function updateArabicFont() {
    if (currentLang === 'ar') {
        document.documentElement.classList.add('lang-ar');
        document.documentElement.setAttribute('dir', 'rtl');
    } else {
        document.documentElement.classList.remove('lang-ar');
        document.documentElement.setAttribute('dir', 'ltr');
    }
}

export { t, switchLanguage, getCurrentLang, toggleLanguage, loadLanguage, applyTranslations, i18nReady };
