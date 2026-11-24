// js/settings/settingsDataTab.js - Вкладка резервного копіювання та експорту/імпорту даних
window.App = window.App || {};

(function() {
    function t(key, params) {
        if (window.App && window.App.i18n && window.App.i18n.t) {
            return window.App.i18n.t(key, params);
        }
        return key;
    }

    const settingsDataTab = {
        renderSectionHTML() {
            const state = window.App?.state || {};
            const boardsCount = state.boards ? state.boards.length : 0;
            const notesCount = state.notes ? state.notes.length : 0;

            return `
                <div class="settings-data-section">
                    <div class="settings-data-header">
                        <div class="settings-section-title" data-i18n="settings.data.backupTitle">${t('settings.data.backupTitle')}</div>
                        <div class="settings-section-desc" data-i18n="settings.data.backupDesc">${t('settings.data.backupDesc')}</div>
                    </div>

                    <div class="settings-data-actions-grid">
                        <!-- JSON Backup Box -->
                        <div class="settings-data-card">
                            <div class="settings-data-card-icon json">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            <div class="settings-data-card-info">
                                <h4 class="settings-data-card-title" data-i18n="settings.data.jsonTitle">${t('settings.data.jsonTitle')}</h4>
                                <p class="settings-data-card-desc" data-i18n="settings.data.jsonDesc">${t('settings.data.jsonDesc')}</p>
                            </div>
                            <div class="settings-data-card-btns">
                                <button type="button" class="settings-action-btn primary" id="btn-export-json">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span data-i18n="settings.data.exportJsonBtn">${t('settings.data.exportJsonBtn')}</span>
                                </button>

                                <button type="button" class="settings-action-btn secondary" id="btn-import-json-trigger">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    <span data-i18n="settings.data.importJsonBtn">${t('settings.data.importJsonBtn')}</span>
                                </button>
                                <input type="file" id="input-import-json" accept=".json,application/json" style="display: none;" />
                            </div>
                        </div>

                        <!-- Markdown ZIP Box -->
                        <div class="settings-data-card">
                            <div class="settings-data-card-icon md">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="7 15 10 9 13 15"></polyline>
                                    <line x1="8.5" y1="12" x2="11.5" y2="12"></line>
                                    <line x1="17" y1="9" x2="17" y2="15"></line>
                                </svg>
                            </div>
                            <div class="settings-data-card-info">
                                <h4 class="settings-data-card-title" data-i18n="settings.data.markdownTitle">${t('settings.data.markdownTitle')}</h4>
                                <p class="settings-data-card-desc" data-i18n="settings.data.markdownDesc">${t('settings.data.markdownDesc')}</p>
                            </div>
                            <div class="settings-data-card-btns">
                                <button type="button" class="settings-action-btn primary" id="btn-export-markdown">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span data-i18n="settings.data.exportMarkdownBtn">${t('settings.data.exportMarkdownBtn')}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Data Status Box -->
                    <div class="settings-data-status">
                        <div class="settings-stat-box">
                            <div class="settings-stat-num" id="settings-data-boards-count">${boardsCount}</div>
                            <div class="settings-stat-label" data-i18n="settings.account.boardsStat">${t('settings.account.boardsStat')}</div>
                        </div>
                        <div class="settings-stat-box">
                            <div class="settings-stat-num" id="settings-data-notes-count">${notesCount}</div>
                            <div class="settings-stat-label" data-i18n="settings.account.notesStat">${t('settings.account.notesStat')}</div>
                        </div>
                    </div>

                    <div id="data-status-message" class="settings-data-message" style="display: none;"></div>
                </div>
            `;
        },

        renderHTML(isVisible) {
            return this.renderSectionHTML();
        },

        updateStats(modalOverlayEl) {
            if (!modalOverlayEl) return;
            const state = window.App?.state || {};
            const boardsCount = state.boards ? state.boards.length : 0;
            const notesCount = state.notes ? state.notes.length : 0;
            const boardsStatEl = modalOverlayEl.querySelector('#settings-data-boards-count');
            const notesStatEl = modalOverlayEl.querySelector('#settings-data-notes-count');
            if (boardsStatEl) boardsStatEl.textContent = boardsCount;
            if (notesStatEl) notesStatEl.textContent = notesCount;
        },

        bindEvents(modalOverlayEl, onRerender) {
            if (!modalOverlayEl) return;

            const btnExportJson = modalOverlayEl.querySelector('#btn-export-json');
            const btnImportTrigger = modalOverlayEl.querySelector('#btn-import-json-trigger');
            const inputImport = modalOverlayEl.querySelector('#input-import-json');
            const btnExportMarkdown = modalOverlayEl.querySelector('#btn-export-markdown');
            const msgEl = modalOverlayEl.querySelector('#data-status-message');

            const showMessage = (text, type = 'success') => {
                if (!msgEl) return;
                msgEl.textContent = text;
                msgEl.className = `settings-data-message ${type}`;
                msgEl.style.display = 'block';
                setTimeout(() => {
                    if (msgEl) msgEl.style.display = 'none';
                }, 4000);
            };

            // 1. JSON Export
            if (btnExportJson) {
                btnExportJson.addEventListener('click', () => {
                    try {
                        const mgr = window.App?.backupManager;
                        if (!mgr) throw new Error('Модуль резервного копіювання не знайдено.');
                        const res = mgr.exportJsonBackup();
                        showMessage(`✅ Резервну копію (${res.countBoards} блокнотів, ${res.countNotes} нотаток) збережено!`, 'success');
                    } catch (err) {
                        showMessage(`❌ Помилка експорту: ${err.message}`, 'error');
                    }
                });
            }

            // 2. JSON Import Trigger
            if (btnImportTrigger && inputImport) {
                btnImportTrigger.addEventListener('click', () => {
                    inputImport.value = '';
                    inputImport.click();
                });

                inputImport.addEventListener('change', (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const jsonContent = event.target.result;
                            const mgr = window.App?.backupManager;
                            if (!mgr) throw new Error('Модуль резервного копіювання не знайдено.');

                            const confirmMsg = t('settings.data.importConfirm') || 
                                'Об\'єднати нотатки з резервної копії з поточними?\n\n[OK] — Об\'єднати (безпечно)\n[Cancel] — Скасувати';

                            if (window.confirm(confirmMsg)) {
                                const res = mgr.importJsonBackup(jsonContent, { mode: 'merge' });
                                showMessage(`✅ Успішно імпортовано ${res.importedBoards} блокнотів та ${res.importedNotes} нотаток!`, 'success');
                                if (onRerender) onRerender();
                            }
                        } catch (err) {
                            showMessage(`❌ Помилка імпорту: ${err.message}`, 'error');
                        }
                    };
                    reader.readAsText(file);
                });
            }

            // 3. Markdown ZIP Export
            if (btnExportMarkdown) {
                btnExportMarkdown.addEventListener('click', () => {
                    try {
                        const mgr = window.App?.backupManager;
                        if (!mgr) throw new Error('Модуль резервного копіювання не знайдено.');
                        const res = mgr.exportMarkdownZip();
                        showMessage(`✅ Створено архів із ${res.totalFiles} файлів Markdown!`, 'success');
                    } catch (err) {
                        showMessage(`❌ Помилка експорту Markdown: ${err.message}`, 'error');
                    }
                });
            }
        }
    };

    window.App.settingsDataTab = settingsDataTab;
})();
