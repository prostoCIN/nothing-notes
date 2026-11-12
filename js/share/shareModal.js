// js/share/shareModal.js - Модальне вікно налаштувань шерингу та Markdown-експорту для людей і ШІ
import './shareMarkdown.js';

window.App = window.App || {};

(function() {
    window.App.shareModal = {
        downloadMarkdownFile(filename, content) {
            if (window.App.shareMarkdown) return window.App.shareMarkdown.downloadMarkdownFile(filename, content);
        },
        generateMarkdownForNotes(notes, boardTitle = "") {
            return window.App.shareMarkdown ? window.App.shareMarkdown.generateMarkdownForNotes(notes, boardTitle) : "";
        },
        createShareLink(boardId, noteIds = null, allowClone = false) {
            if (window.App.shareManager) return window.App.shareManager.createShareLink(boardId, noteIds, allowClone);
        },

        /**
         * Відображає оновлене модальне вікно шерингу:
         * 1. NothingNotes (спільне посилання для користувачів)
         * 2. Markdown (для ШІ) (копіювання тексту для вставки в ChatGPT/Claude або завантаження файлу)
         */
        showShareModal(boardId, noteIds = null, defaultTab = 'nothingnotes') {
            if (defaultTab === 'ai') defaultTab = 'export';

            const state = window.App.state;
            const isMultiBoard = Array.isArray(boardId) && boardId.length > 1;
            const boardIds = isMultiBoard ? boardId : (Array.isArray(boardId) ? boardId : [boardId]);
            const allBoards = [...(state.boards || []), ...(state.readOnlyBoards || [])];
            const targetBoards = boardIds.map(id => allBoards.find(b => b.id === id) || { name: 'Блокнот', id }).filter(Boolean);
            const targetBoard = targetBoards[0] || (state.boards || [])[0] || { name: 'Блокнот', id: 'default' };

            // Отримуємо відповідні об'єкти нотаток
            let targetNotes = [];
            const allAvailableNotes = [...(state.notes || []), ...(state.readOnlyNotes || [])];

            if (Array.isArray(noteIds) && noteIds.length > 0) {
                const noteSet = new Set(noteIds);
                targetNotes = allAvailableNotes.filter(n => noteSet.has(n.id));
            } else {
                targetNotes = allAvailableNotes.filter(n => boardIds.includes(n.boardId));
            }

            const isSpecificNotes = Array.isArray(noteIds) && noteIds.length > 0;
            const singleNote = isSpecificNotes && targetNotes.length === 1 ? targetNotes[0] : null;

            // Збираємо всі дочірні піднотатки (якщо вибрано конкретні нотатки)
            let subnotes = [];
            if (isSpecificNotes) {
                const targetSet = new Set(targetNotes.map(n => n.id));
                const currentParentIds = new Set(targetSet);
                let foundMore = true;
                while (foundMore) {
                    foundMore = false;
                    const nextParentIds = new Set();
                    allAvailableNotes.forEach(n => {
                        if (n.parentId && currentParentIds.has(n.parentId) && !targetSet.has(n.id) && !subnotes.some(s => s.id === n.id)) {
                            subnotes.push(n);
                            nextParentIds.add(n.id);
                            foundMore = true;
                        }
                    });
                    nextParentIds.forEach(id => currentParentIds.add(id));
                }
            }
            const hasSubnotes = subnotes.length > 0;
            let includeSubnotes = hasSubnotes; // За замовчуванням увімкнено, якщо є піднотатки

            const getEffectiveNotes = () => {
                if (!isSpecificNotes) return targetNotes;
                return includeSubnotes ? [...targetNotes, ...subnotes] : targetNotes;
            };

            const t = (k, p) => (window.App && window.App.i18n) ? window.App.i18n.t(k, p) : k;

            const docTitle = isMultiBoard
                ? targetBoards.map(b => b.name).join(', ')
                : (singleNote ? (singleNote.title || t('common.untitled')) : (targetBoard ? targetBoard.name : t('common.defaultBoard')));
            const exportDocName = docTitle.replace(/[/\\?%*:|"<>]/g, '-').trim();

            let titleText = t('share.shareTitle') || 'Спільний доступ';
            if (isMultiBoard) {
                titleText = `Шеринг блокнотів (${targetBoards.length})`;
            } else if (isSpecificNotes) {
                if (singleNote) {
                    titleText = t('share.shareNoteTitle', { title: singleNote.title || t('common.untitled') }) || `Шеринг нотатки: «${singleNote.title || 'Без назви'}»`;
                } else {
                    titleText = t('share.shareNotesTitle', { count: targetNotes.length }) || `Шеринг виділених нотаток (${targetNotes.length})`;
                }
            } else {
                titleText = t('share.shareBoardTitle', { name: targetBoard.name }) || `Шеринг блокнота: «${targetBoard.name}»`;
            }

            let markdownContent = this.generateMarkdownForNotes(getEffectiveNotes(), docTitle);

            // Видаляємо старе вікно, якщо було відкрите
            const existing = document.getElementById('share-modal-backdrop');
            if (existing) existing.remove();

            const modalEl = document.createElement('div');
            modalEl.id = 'share-modal-backdrop';
            modalEl.className = 'share-modal-backdrop';

            modalEl.innerHTML = `
                <div class="share-modal-card">
                    <div class="share-modal-header">
                        <div class="share-modal-title-wrap">
                            <span class="share-modal-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="18" cy="5" r="3"></circle>
                                    <circle cx="6" cy="12" r="3"></circle>
                                    <circle cx="18" cy="19" r="3"></circle>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                </svg>
                            </span>
                            <h3 class="share-modal-title">${titleText}</h3>
                        </div>
                        <button class="share-modal-close-btn" id="share-modal-close" title="${t('settings.closeTitle') || 'Закрити (Esc)'}" data-i18n-title="settings.closeTitle">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <!-- Вкладки режимів шерингу -->
                    <div class="share-modal-tabs">
                        <button type="button" class="share-modal-tab-btn ${defaultTab === 'nothingnotes' ? 'active' : ''}" data-tab="nothingnotes" title="NothingNotes">
                            <span class="share-tab-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </span>
                            <span class="share-tab-text" data-i18n="share.tabNothingNotes">NothingNotes</span>
                        </button>
                        <button type="button" class="share-modal-tab-btn ${defaultTab === 'export' ? 'active' : ''}" data-tab="export" title="${t('share.tabMarkdownAI') || 'Markdown (для ШІ)'}" data-i18n-title="share.tabMarkdownAI">
                            <span class="share-tab-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </span>
                            <span class="share-tab-text" data-i18n="share.tabMarkdownAI">Markdown (для ШІ)</span>
                        </button>
                    </div>

                    <div class="share-modal-body">
                        <!-- Вкладка 1: Для користувачів у додатку NothingNotes -->
                        <div class="share-tab-pane ${defaultTab === 'nothingnotes' ? 'active' : ''}" id="share-pane-nothingnotes">
                            <p class="share-modal-desc">
                                ${isMultiBoard
                                    ? `Спільні посилання для виділених блокнотів (${targetBoards.length}). Користувачі зможуть відкрити їх у режимі читання.`
                                    : (isSpecificNotes 
                                        ? (t('share.descNothingNotesSingle') || 'Створіть спільне посилання для користувачів NothingNotes. Нотатка відкриється у повноцінному веб-інтерфейсі блокнота.') 
                                        : (t('share.descNothingNotesBoard') || 'Будь-хто з цим посиланням зможе додати ваш блокнот для перегляду у NothingNotes.'))}
                            </p>

                            ${isSpecificNotes ? `
                            <div class="share-modal-option-row share-subnotes-row">
                                <div class="share-option-info">
                                    <span class="share-option-title" data-i18n="share.includeSubnotes">Включати піднотатки</span>
                                    <span class="share-option-hint">${hasSubnotes ? (t('share.includeSubnotesHint', { count: subnotes.length }) || `Поділитися також усіма вкладеними піднотатками (${subnotes.length})`) : (t('share.noSubnotesHint') || 'У цієї нотатки немає вкладених піднотаток')}</span>
                                </div>
                                <label class="share-toggle-switch ${!hasSubnotes ? 'disabled' : ''}">
                                    <input type="checkbox" class="share-subnotes-toggle" ${hasSubnotes ? 'checked' : 'disabled'}>
                                    <span class="share-toggle-slider"></span>
                                </label>
                            </div>
                            ` : ''}

                            <div class="share-modal-option-row">
                                <div class="share-option-info">
                                    <span class="share-option-title" data-i18n="share.allowClone">Дозволити копіювання</span>
                                    <span class="share-option-hint" data-i18n="share.allowCloneHint">Дозволити іншим зберегти копію у свої блокноти</span>
                                </div>
                                <label class="share-toggle-switch">
                                    <input type="checkbox" id="share-allow-clone-toggle">
                                    <span class="share-toggle-slider"></span>
                                </label>
                            </div>

                            ${isMultiBoard ? `
                            <div class="share-multi-boards-container" id="share-multi-boards-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; margin-bottom: 12px;"></div>
                            <button type="button" class="share-copy-btn" id="share-multi-copy-all-btn" style="width: 100%; margin-bottom: 8px;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Скопіювати всі посилання</span>
                            </button>
                            ` : `
                            <div class="share-link-box">
                                <input type="text" class="share-link-input" id="share-nn-link-input" readonly placeholder="${t('share.generatingLink') || 'Генерація посилання...'}" data-i18n-placeholder="share.generatingLink">
                                <button class="share-copy-btn" id="share-nn-copy-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    <span data-i18n="common.copy">Скопіювати</span>
                                </button>
                            </div>
                            `}

                            <div class="share-modal-status" id="share-nn-status"></div>
                        </div>

                        <!-- Вкладка 2: Експорт у форматі Markdown (.md) для ШІ та резервних копій -->
                        <div class="share-tab-pane ${defaultTab === 'export' ? 'active' : ''}" id="share-pane-export">
                            <p class="share-modal-desc">
                                ${t('share.descMarkdown') || 'Вміст нотатки у чистому <b>Markdown</b>-форматі. Ідеально для швидкої вставки в діалог із <b>ChatGPT</b>, <b>Claude</b> чи іншими ШІ або збереження у файл <code>.md</code>.'}
                            </p>

                            ${isSpecificNotes ? `
                            <div class="share-modal-option-row share-subnotes-row" style="margin-bottom: 12px;">
                                <div class="share-option-info">
                                    <span class="share-option-title" data-i18n="share.includeSubnotes">Включати піднотатки</span>
                                    <span class="share-option-hint">${hasSubnotes ? (t('share.includeSubnotesExportHint', { count: subnotes.length }) || `Експортувати разом з усіма вкладеними піднотатками (${subnotes.length})`) : (t('share.noSubnotesHint') || 'У цієї нотатки немає вкладених піднотаток')}</span>
                                </div>
                                <label class="share-toggle-switch ${!hasSubnotes ? 'disabled' : ''}">
                                    <input type="checkbox" class="share-subnotes-toggle" ${hasSubnotes ? 'checked' : 'disabled'}>
                                    <span class="share-toggle-slider"></span>
                                </label>
                            </div>
                            ` : ''}

                            <div class="share-markdown-preview-box">
                                <pre id="share-markdown-pre">${escapeHtml(markdownContent)}</pre>
                            </div>

                            <div class="share-btn-group">
                                <button type="button" class="share-copy-btn" id="share-md-copy-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    <span data-i18n="share.copyForAI">Скопіювати для ШІ</span>
                                </button>

                                <button type="button" class="share-secondary-btn" id="share-md-download-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span data-i18n="share.downloadMd">Завантажити .md</span>
                                </button>
                            </div>

                            <div class="share-modal-status" id="share-md-status"></div>
                        </div>
                    </div>
                </div>
            `;

            if (window.App && window.App.i18n && window.App.i18n.updateDOM) {
                window.App.i18n.updateDOM(modalEl);
            }

            document.body.appendChild(modalEl);

            function escapeHtml(str) {
                return String(str || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            // Закриття модального вікна
            const closeBtn = modalEl.querySelector('#share-modal-close');
            const closeModal = () => {
                modalEl.remove();
                document.removeEventListener('keydown', handleEsc);
            };

            const handleEsc = (e) => {
                if (e.key === 'Escape') closeModal();
            };
            document.addEventListener('keydown', handleEsc);

            closeBtn.addEventListener('click', closeModal);
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) closeModal();
            });

            // Перемикання вкладок
            const tabBtns = modalEl.querySelectorAll('.share-modal-tab-btn');
            const tabPanes = modalEl.querySelectorAll('.share-tab-pane');

            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabKey = btn.dataset.tab;
                    tabBtns.forEach(b => b.classList.toggle('active', b === btn));
                    tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `share-pane-${tabKey}`));
                });
            });

            // Логіка генерації посилання NothingNotes
            const cloneToggle = modalEl.querySelector('#share-allow-clone-toggle');
            const nnInput = modalEl.querySelector('#share-nn-link-input');
            const nnCopyBtn = modalEl.querySelector('#share-nn-copy-btn');
            const nnStatus = modalEl.querySelector('#share-nn-status');

            let baseShareUrl = '';
            let isGenerating = false;

            const updateMarkdownView = () => {
                markdownContent = this.generateMarkdownForNotes(getEffectiveNotes(), docTitle);
                const preEl = modalEl.querySelector('#share-markdown-pre');
                if (preEl) {
                    preEl.textContent = markdownContent;
                }
            };

            const updateShareLinks = () => {
                if (!baseShareUrl) return;
                const subnotesSuffix = (isSpecificNotes && hasSubnotes && !includeSubnotes) ? '&subnotes=0' : '';
                const nnUrl = `${baseShareUrl}${subnotesSuffix}`;
                if (nnInput) nnInput.value = nnUrl;
            };

            // Обробники чекбоксів включення піднотаток
            const subnotesToggles = modalEl.querySelectorAll('.share-subnotes-toggle');
            subnotesToggles.forEach(toggle => {
                toggle.addEventListener('change', (e) => {
                    includeSubnotes = e.target.checked;
                    subnotesToggles.forEach(t => {
                        if (t !== e.target) t.checked = includeSubnotes;
                    });
                    updateMarkdownView();
                    updateShareLinks();
                });
            });

            let multiBoardResults = [];
            const generateLinks = async () => {
                if (isGenerating) return;
                isGenerating = true;

                if (nnInput) {
                    nnInput.value = 'Створення безпечного посилання...';
                    if (nnCopyBtn) nnCopyBtn.disabled = true;
                }
                setStatusMessage(nnStatus, '');

                try {
                    const allowClone = cloneToggle ? cloneToggle.checked : false;
                    if (isMultiBoard) {
                        const container = modalEl.querySelector('#share-multi-boards-list');
                        if (container) container.innerHTML = '<div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">Генерація посилань...</div>';

                        const results = [];
                        for (const b of targetBoards) {
                            try {
                                if (b.shareToken) {
                                    const origin = window.location.origin + window.location.pathname;
                                    results.push({ board: b, url: `${origin}?share_board=${b.shareToken}` });
                                } else {
                                    const res = await this.createShareLink(b.id, null, allowClone);
                                    results.push({ board: b, url: res.shareUrl });
                                }
                            } catch (e) {
                                console.warn('[ShareModal] Failed to share board:', b.name, e);
                            }
                        }

                        multiBoardResults = results;
                        if (container) {
                            container.innerHTML = '';
                            results.forEach(({ board, url }) => {
                                const row = document.createElement('div');
                                row.style.cssText = 'display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px;';
                                row.innerHTML = `
                                    <span style="font-size: 14px; flex-shrink: 0;">${board.icon || '📋'}</span>
                                    <span style="font-size: 13px; font-weight: 500; min-width: 70px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(board.name)}</span>
                                    <input type="text" readonly value="${url}" style="flex: 1; min-width: 60px; font-size: 11px; background: transparent; border: none; color: var(--text-muted); outline: none;">
                                    <button type="button" class="share-copy-btn" style="padding: 4px 8px; font-size: 11px; height: 26px; flex-shrink: 0;" title="Скопіювати">
                                        <span>Скопіювати</span>
                                    </button>
                                `;
                                const rowBtn = row.querySelector('button');
                                rowBtn.addEventListener('click', async () => {
                                    try {
                                        await navigator.clipboard.writeText(url);
                                        setStatusMessage(nnStatus, `Посилання на «${board.name}» скопійовано!`);
                                    } catch (err) {
                                        row.querySelector('input').select();
                                        document.execCommand('copy');
                                    }
                                });
                                container.appendChild(row);
                            });
                        }
                    } else {
                        const targetId = boardIds[0] || boardId;
                        const res = await this.createShareLink(targetId, noteIds, allowClone);
                        baseShareUrl = res.shareUrl;

                        updateShareLinks();
                        if (nnCopyBtn) nnCopyBtn.disabled = false;
                    }
                } catch (err) {
                    const errMsg = err.message || 'Не вдалося створити посилання. Перевірте авторизацію.';
                    if (nnInput) nnInput.value = 'Потрібен вхід в акаунт';
                    setStatusMessage(nnStatus, errMsg, true);
                } finally {
                    isGenerating = false;
                }
            };

            const setStatusMessage = (el, message, isError = false) => {
                if (!el) return;
                el.className = `share-modal-status ${isError ? 'error' : 'success'}`;
                if (!message) {
                    el.innerHTML = '';
                    return;
                }
                const iconSvg = isError
                    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
                    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                el.innerHTML = `${iconSvg}<span>${message}</span>`;
            };

            if (cloneToggle) {
                cloneToggle.addEventListener('change', generateLinks);
            }
            generateLinks();

            // Копіювання посилання NothingNotes для одиночного блокнота
            if (nnCopyBtn) {
                nnCopyBtn.addEventListener('click', async () => {
                    if (!nnInput || !nnInput.value || nnInput.value.startsWith('Створення')) return;
                    try {
                        await navigator.clipboard.writeText(nnInput.value);
                        setStatusMessage(nnStatus, 'Посилання NothingNotes скопійовано!');
                    } catch (e) {
                        nnInput.select();
                        document.execCommand('copy');
                    }
                });
            }

            // Копіювання всіх посилань для групи блокнотів
            const copyAllBtn = modalEl.querySelector('#share-multi-copy-all-btn');
            if (copyAllBtn) {
                copyAllBtn.addEventListener('click', async () => {
                    if (!multiBoardResults || multiBoardResults.length === 0) return;
                    const text = multiBoardResults.map(r => `${r.board.name}: ${r.url}`).join('\n');
                    try {
                        await navigator.clipboard.writeText(text);
                        setStatusMessage(nnStatus, `Скопійовано посилання для ${multiBoardResults.length} блокнотів!`);
                    } catch (e) {}
                });
            }

            // Логіка вкладки Markdown
            const mdCopyBtn = modalEl.querySelector('#share-md-copy-btn');
            const mdDownloadBtn = modalEl.querySelector('#share-md-download-btn');
            const mdStatus = modalEl.querySelector('#share-md-status');

            mdCopyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(markdownContent);
                    mdCopyBtn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Скопійовано!</span>
                    `;
                    setStatusMessage(mdStatus, 'Markdown для ШІ скопійовано в буфер обміну! Вставте його в чат із ChatGPT або Claude.');

                    setTimeout(() => {
                        mdCopyBtn.innerHTML = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Скопіювати для ШІ</span>
                        `;
                    }, 2500);
                } catch (e) {
                    setStatusMessage(mdStatus, 'Не вдалося скопіювати автоматично', true);
                }
            });

            mdDownloadBtn.addEventListener('click', () => {
                try {
                    this.downloadMarkdownFile(exportDocName, markdownContent);
                    setStatusMessage(mdStatus, `Файл "${exportDocName}.md" успішно завантажено!`);
                } catch (e) {
                    setStatusMessage(mdStatus, 'Помилка при збереженні файлу', true);
                }
            });
        }
    };
})();
