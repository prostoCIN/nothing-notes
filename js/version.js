// js/version.js - Версія додатку NothingNotes та діагностичне логування
export const APP_VERSION = '1.4.0';

let hasLogged = false;

/**
 * Одноразове логування поточної версії в консоль розробника при завантаженні сайту
 */
export function logAppVersion() {
    if (hasLogged) return;
    hasLogged = true;

    // Фірмовий бейдж NothingNotes у консолі DevTools
    console.log(
        `%c NothingNotes %c v${APP_VERSION} `,
        'background: #18181b; color: #f4f4f5; font-weight: 700; font-size: 11px; padding: 3px 6px; border-radius: 4px 0 0 4px; border: 1px solid #27272a; border-right: none;',
        'background: #e11d48; color: #ffffff; font-weight: 700; font-size: 11px; padding: 3px 6px; border-radius: 0 4px 4px 0; border: 1px solid #e11d48;'
    );
}

window.App = window.App || {};
window.App.version = APP_VERSION;
window.App.logAppVersion = logAppVersion;
