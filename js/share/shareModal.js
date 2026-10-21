// js/share/shareModal.js - Модальне вікно налаштувань шерингу, публічних посилань та Raw Markdown перегляду
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
         * Відображає оновлене модальне вікно шерингу з вкладками:
         * 1. NothingNotes (спільне посилання для користувачів)
         * 2. ШІ & Raw (посилання ?format=md для читання ChatGPT, Claude тощо)
         * 3. Експорт в .md (копіювання або завантаження файлу)
         */
        showShareModal(boardId, noteIds = null, defaultTab = 'nothingnotes') {
            const state = window.App.state;
            const targetBoard = (state.boards || []).find(b => b.id === boardId) || { name: 'Блокнот', id: boardId };

            // Отримуємо відповідні об'єкти нотаток
            let targetNotes = [];
            const allAvailableNotes = [...(state.notes || []), ...(state.readOnlyNotes || [])];

            if (Array.isArray(noteIds) && noteIds.length > 0) {
                const noteSet = new Set(noteIds);
                targetNotes = allAvailableNotes.filter(n => noteSet.has(n.id));
            } else {
                targetNotes = allAvailableNotes.filter(n => n.boardId === boardId);
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

            const titleText = singleNote 
                ? `Поділитись: ${singleNote.title || 'Нотатка'}` 
                : (isSpecificNotes ? `Поділитись ${targetNotes.length} нотатками` : `Поділитись блокнотом "${targetBoard.name}"`);

            const exportDocName = singleNote 
                ? (singleNote.title || 'note') 
                : (targetBoard.name || 'notes_export');

            const docTitle = isSpecificNotes ? '' : targetBoard.name;
            const getEffectiveNotes = () => {
                return (isSpecificNotes && includeSubnotes && hasSubnotes) 
                    ? [...targetNotes, ...subnotes] 
                    : [...targetNotes];
            };

            // Формуємо Markdown вміст для вкладки експорту
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
                        <button class="share-modal-close-btn" id="share-modal-close" title="Закрити (Esc)">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
                            <span class="share-tab-text">NothingNotes</span>
                        </button>
                        <button type="button" class="share-modal-tab-btn ${defaultTab === 'ai' ? 'active' : ''}" data-tab="ai" title="ШІ & Raw">
                            <span class="share-tab-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                                    <circle cx="12" cy="5" r="2"></circle>
                                    <path d="M12 7v4"></path>
                                    <line x1="8" y1="16" x2="8.01" y2="16"></line>
                                    <line x1="16" y1="16" x2="16.01" y2="16"></line>
                                </svg>
                            </span>
                            <span class="share-tab-text">ШІ & Raw</span>
                        </button>
                        <button type="button" class="share-modal-tab-btn ${defaultTab === 'export' ? 'active' : ''}" data-tab="export" title="Експорт .md">
                            <span class="share-tab-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </span>
                            <span class="share-tab-text">Експорт .md</span>
                        </button>
                    </div>

                    <div class="share-modal-body">
                        <!-- Вкладка 1: Для користувачів у додатку NothingNotes -->
                        <div class="share-tab-pane ${defaultTab === 'nothingnotes' ? 'active' : ''}" id="share-pane-nothingnotes">
                            <p class="share-modal-desc">
                                ${isSpecificNotes 
                                    ? 'Створіть спільне посилання для користувачів NothingNotes. Нотатка відкриється у повноцінному веб-інтерфейсі блокнота.' 
                                    : 'Будь-хто з цим посиланням зможе додати ваш блокнот для перегляду у NothingNotes.'}
                            </p>

                            ${isSpecificNotes ? `
                            <div class="share-modal-option-row share-subnotes-row">
                                <div class="share-option-info">
                                    <span class="share-option-title">Включати піднотатки</span>
                                    <span class="share-option-hint">${hasSubnotes ? `Поділитися також усіма вкладеними піднотатками (${subnotes.length})` : 'У цієї нотатки немає вкладених піднотаток'}</span>
                                </div>
                                <label class="share-toggle-switch ${!hasSubnotes ? 'disabled' : ''}">
                                    <input type="checkbox" class="share-subnotes-toggle" ${hasSubnotes ? 'checked' : 'disabled'}>
                                    <span class="share-toggle-slider"></span>
                                </label>
                            </div>
                            ` : ''}

                            <div class="share-modal-option-row">
                                <div class="share-option-info">
                                    <span class="share-option-title">Дозволити копіювання</span>
                                    <span class="share-option-hint">Дозволити іншим зберегти копію у свої блокноти</span>
                                </div>
                                <label class="share-toggle-switch">
                                    <input type="checkbox" id="share-allow-clone-toggle">
                                    <span class="share-toggle-slider"></span>
                                </label>
                            </div>

                            <div class="share-link-box">
                                <input type="text" class="share-link-input" id="share-nn-link-input" readonly placeholder="Генерація посилання...">
                                <button class="share-copy-btn" id="share-nn-copy-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    <span>Скопіювати</span>
                                </button>
                            </div>

                            <div class="share-modal-status" id="share-nn-status"></div>
                        </div>

                        <!-- Вкладка 2: Спеціальне посилання для ШІ-агентів (?format=md) -->
                        <div class="share-tab-pane ${defaultTab === 'ai' ? 'active' : ''}" id="share-pane-ai">
                            <p class="share-modal-desc">
                                Спеціальне посилання з параметром <code>?format=md</code>. Ідеально для <b>ChatGPT</b>, <b>Claude</b>, <b>Perplexity</b>, <b>Gemini</b> або скриптів: за цим URL віддається чистий структурований текст нотатки без важкого інтерфейсу SPA.
                            </p>

                            ${isSpecificNotes ? `
                            <div class="share-modal-option-row share-subnotes-row">
                                <div class="share-option-info">
                                    <span class="share-option-title">Включати піднотатки</span>
                                    <span class="share-option-hint">${hasSubnotes ? `ШІ отримає доступ також до вкладених піднотаток (${subnotes.length})` : 'У цієї нотатки немає вкладених піднотаток'}</span>
                                </div>
                                <label class="share-toggle-switch ${!hasSubnotes ? 'disabled' : ''}">
                                    <input type="checkbox" class="share-subnotes-toggle" ${hasSubnotes ? 'checked' : 'disabled'}>
                                    <span class="share-toggle-slider"></span>
                                </label>
                            </div>
                            ` : ''}

                            <div class="share-link-box">
                                <input type="text" class="share-link-input" id="share-ai-link-input" readonly placeholder="Генерація посилання для ШІ...">
                                <button class="share-copy-btn" id="share-ai-copy-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    <span>Скопіювати для ШІ</span>
                                </button>
                            </div>

                            <div class="share-btn-group">
                                <a href="#" target="_blank" class="share-secondary-btn" id="share-ai-preview-link" style="display: none;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    <span>Відкрити перегляд як бачить ШІ</span>
                                </a>
                            </div>

                            <div class="share-modal-status" id="share-ai-status"></div>
                        </div>

                        <!-- Вкладка 3: Експорт у форматі Markdown (.md) -->
                        <div class="share-tab-pane ${defaultTab === 'export' ? 'active' : ''}" id="share-pane-export">
                            <p class="share-modal-desc">
                                Вміст нотатки у чистому <b>Markdown</b>-форматі. Можна скопіювати для швидкої вставки в чат з нейромережею або завантажити на пристрій у файлі <code>.md</code>.
                            </p>

                            ${isSpecificNotes ? `
                            <div class="share-modal-option-row share-subnotes-row" style="margin-bottom: 12px;">
                                <div class="share-option-info">
                                    <span class="share-option-title">Включати піднотатки</span>
                                    <span class="share-option-hint">${hasSubnotes ? `Експортувати разом з усіма вкладеними піднотатками (${subnotes.length})` : 'У цієї нотатки немає вкладених піднотаток'}</span>
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
                                    <span>Скопіювати Markdown</span>
                                </button>

                                <button type="button" class="share-secondary-btn" id="share-md-download-btn">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span>Завантажити .md</span>
                                </button>
                            </div>

                            <div class="share-modal-status" id="share-md-status"></div>
                        </div>
                    </div>
                </div>
            `;

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

            // Логіка генерації посилань (Tabs 1 & 2)
            const cloneToggle = modalEl.querySelector('#share-allow-clone-toggle');
            const nnInput = modalEl.querySelector('#share-nn-link-input');
            const nnCopyBtn = modalEl.querySelector('#share-nn-copy-btn');
            const nnStatus = modalEl.querySelector('#share-nn-status');

            const aiInput = modalEl.querySelector('#share-ai-link-input');
            const aiCopyBtn = modalEl.querySelector('#share-ai-copy-btn');
            const aiPreviewLink = modalEl.querySelector('#share-ai-preview-link');
            const aiStatus = modalEl.querySelector('#share-ai-status');

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
                const aiUrl = `${baseShareUrl}&format=md${subnotesSuffix}`;

                if (nnInput) nnInput.value = nnUrl;
                if (aiInput) aiInput.value = aiUrl;
                if (aiPreviewLink) aiPreviewLink.href = aiUrl;
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

            const generateLinks = async () => {
                if (isGenerating) return;
                isGenerating = true;

                nnInput.value = 'Створення безпечного посилання...';
                aiInput.value = 'Створення безпечного посилання...';
                nnCopyBtn.disabled = true;
                aiCopyBtn.disabled = true;
                setStatusMessage(nnStatus, '');
                setStatusMessage(aiStatus, '');
                aiPreviewLink.style.display = 'none';

                try {
                    const allowClone = cloneToggle ? cloneToggle.checked : false;
                    const res = await this.createShareLink(boardId, noteIds, allowClone);
                    baseShareUrl = res.shareUrl;

                    updateShareLinks();

                    nnCopyBtn.disabled = false;
                    aiCopyBtn.disabled = false;
                    aiPreviewLink.style.display = 'inline-flex';
                } catch (err) {
                    const errMsg = err.message || 'Не вдалося створити посилання. Перевірте авторизацію.';
                    nnInput.value = 'Потрібен вхід в акаунт';
                    aiInput.value = 'Потрібен вхід в акаунт';
                    setStatusMessage(nnStatus, errMsg, true);
                    setStatusMessage(aiStatus, errMsg, true);
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

            // Копіювання посилання NothingNotes
            nnCopyBtn.addEventListener('click', async () => {
                if (!nnInput.value || nnInput.value.startsWith('Створення')) return;
                try {
                    await navigator.clipboard.writeText(nnInput.value);
                    setStatusMessage(nnStatus, 'Посилання NothingNotes скопійовано!');
                } catch (e) {
                    nnInput.select();
                    document.execCommand('copy');
                }
            });

            // Копіювання посилання для ШІ
            aiCopyBtn.addEventListener('click', async () => {
                if (!aiInput.value || aiInput.value.startsWith('Створення')) return;
                try {
                    await navigator.clipboard.writeText(aiInput.value);
                    setStatusMessage(aiStatus, 'AI / Raw посилання скопійовано! Надішліть його ChatGPT або Claude.');
                } catch (e) {
                    aiInput.select();
                    document.execCommand('copy');
                }
            });

            // Логіка вкладки 3: Експорт Markdown
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
                    setStatusMessage(mdStatus, 'Markdown тексту скопійовано в буфер обміну!');

                    setTimeout(() => {
                        mdCopyBtn.innerHTML = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Скопіювати Markdown</span>
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
        },

        /**
         * Відображає чистий AI / Raw Markdown екран, коли користувач або бот відкриває URL з ?format=md
         */
        renderRawMarkdownView(shareInfo) {
            const notes = shareInfo.notes || [];
            const boardName = shareInfo.board ? shareInfo.board.name : 'Нотатки';
            const markdownContent = this.generateMarkdownForNotes(notes, boardName);

            // Ховаємо інтерфейс робочого простору
            const mainApp = document.getElementById('app-container') || document.body;
            document.title = `${boardName} — Raw Markdown`;

            let rawPage = document.getElementById('raw-markdown-page');
            if (!rawPage) {
                rawPage = document.createElement('div');
                rawPage.id = 'raw-markdown-page';
                rawPage.className = 'raw-markdown-page-wrap';
                document.body.appendChild(rawPage);
            }

            const urlParams = new URLSearchParams(window.location.search);
            const hasSubnotesParam = urlParams.get('subnotes') === '0';
            const cleanNnUrl = window.location.origin + window.location.pathname + `?share_board=${shareInfo.share.share_token}` + (hasSubnotesParam ? '&subnotes=0' : '');

            rawPage.innerHTML = `
                <div class="raw-markdown-page-card">
                    <div class="raw-markdown-top-bar">
                        <div class="raw-markdown-logo-group">
                            <img src="img/Logo.svg" alt="Logo" style="width: 24px; height: 24px;">
                            <strong>NothingNotes</strong>
                            <span class="raw-markdown-badge">AI / Raw View</span>
                        </div>
                        <div class="raw-markdown-actions">
                            <button type="button" class="share-copy-btn" id="raw-copy-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Скопіювати Markdown</span>
                            </button>
                            <button type="button" class="share-secondary-btn" id="raw-download-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Завантажити .md</span>
                            </button>
                            <a href="${cleanNnUrl}" class="share-secondary-btn raw-open-app-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                                <span>Відкрити в NothingNotes</span>
                            </a>
                        </div>
                    </div>
                    <pre class="raw-markdown-content-box" id="raw-pre-content">${escapeHtml(markdownContent)}</pre>
                </div>
            `;

            function escapeHtml(str) {
                return String(str || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            const rawCopyBtn = rawPage.querySelector('#raw-copy-btn');
            const rawDownloadBtn = rawPage.querySelector('#raw-download-btn');

            rawCopyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(markdownContent);
                    rawCopyBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Скопійовано!</span>
                    `;
                    setTimeout(() => {
                        rawCopyBtn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Скопіювати Markdown</span>
                        `;
                    }, 2000);
                } catch(e) {}
            });

            rawDownloadBtn.addEventListener('click', () => {
                this.downloadMarkdownFile(boardName, markdownContent);
            });
        }
    };
})();
