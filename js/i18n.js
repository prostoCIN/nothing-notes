// js/i18n.js - Власний легкий модуль інтернаціоналізації (i18n)
import { ua } from './i18n/ua.js';
import { en } from './i18n/en.js';

const STORAGE_KEY = 'nothing_notes_language';
const translations = { ua, en };
const SUPPORTED_LANGS = ['ua', 'en'];

function detectInitialLanguage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGS.includes(saved)) {
            return saved;
        }
        const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (navLang.startsWith('uk') || navLang.startsWith('ua')) {
            return 'ua';
        }
        // За замовчуванням залишаємо українську, якщо користувач з України або дефолт
        return 'ua';
    } catch {
        return 'ua';
    }
}

let currentLang = detectInitialLanguage();

/**
 * Отримати переклад за ключем (напр. 'common.save' або 'confirm.delete_count')
 * @param {string} key 
 * @param {Record<string, any>} [params] 
 * @returns {string}
 */
export function t(key, params = {}) {
    if (!key) return '';

    const getNested = (obj, path) => {
        return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
    };

    let val = getNested(translations[currentLang], key);
    if (val === undefined) {
        // Fallback до української
        val = getNested(translations['ua'], key);
    }
    if (val === undefined) {
        // Fallback до англійської
        val = getNested(translations['en'], key);
    }
    if (val === undefined) {
        return key;
    }

    if (typeof val === 'string' && params && typeof params === 'object') {
        return val.replace(/\{(\w+)\}/g, (match, paramName) => {
            return params[paramName] !== undefined ? params[paramName] : match;
        });
    }

    return val;
}

export function getLanguage() {
    return currentLang;
}

export function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
        console.warn('[i18n] Failed to save language to localStorage:', e);
    }

    document.documentElement.lang = lang === 'ua' ? 'uk' : 'en';

    updateDOM();

    if (window.App && window.App.events) {
        window.App.events.emit('language:changed', { lang });
    }
}

/**
 * Оновлення статичних атрибутів у DOM дереві
 * @param {HTMLElement|Document} root 
 */
export function updateDOM(root = document) {
    if (!root) return;

    // data-i18n для textContent
    const textEls = root.querySelectorAll('[data-i18n]');
    textEls.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            el.textContent = t(key);
        }
    });

    // data-i18n-html для безпечного HTML-вмісту якщо потрібно
    const htmlEls = root.querySelectorAll('[data-i18n-html]');
    htmlEls.forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key) {
            el.innerHTML = t(key);
        }
    });

    // data-i18n-title
    const titleEls = root.querySelectorAll('[data-i18n-title]');
    titleEls.forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
            el.setAttribute('title', t(key));
        }
    });

    // data-i18n-placeholder
    const phEls = root.querySelectorAll('[data-i18n-placeholder]');
    phEls.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.setAttribute('placeholder', t(key));
        }
    });

    // data-i18n-aria-label
    const ariaEls = root.querySelectorAll('[data-i18n-aria-label]');
    ariaEls.forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        if (key) {
            el.setAttribute('aria-label', t(key));
        }
    });
}

// Ініціалізація глобального об'єкта
if (!window.App) window.App = {};
window.App.i18n = {
    t,
    getLanguage,
    setLanguage,
    updateDOM,
    supported: SUPPORTED_LANGS
};

// Встановлюємо атрибут lang для <html>
document.documentElement.lang = currentLang === 'ua' ? 'uk' : 'en';
