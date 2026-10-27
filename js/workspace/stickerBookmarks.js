// js/workspace/stickerBookmarks.js - Модуль стрічок-закладок (Bookmark Ribbons) та вибору пов'язаних нотаток
window.App = window.App || {};

(function() {
    let activeModal = null;

    window.App.stickerBookmarks = {
        /**
         * Створює блок стрічок-закладок для картки стікера
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - DOM-елемент картки
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @returns {HTMLElement|null} - Контейнер закладок або null якщо закладок немає
         */
        createBookmarksBlock(note, card, isReadOnly) {
            const linkedIds = Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : [];
            if (linkedIds.length === 0) return null;

            const noteManager = window.App.noteManager;
            if (!noteManager) return null;

            // Фільтруємо валідні цільові нотатки
            const validTargetNotes = linkedIds
                .map(id => noteManager.getNoteById(id))
                .filter(n => n && n.id !== note.id);

            if (validTargetNotes.length === 0) return null;

            const container = document.createElement('div');
            container.className = 'sticker-bookmarks-container';

            const i18n = window.App.i18n;
            const t = (key) => i18n ? i18n.t(key) : '';
            const untitledText = t('sticker.untitled') || 'Без назви';

            validTargetNotes.forEach(targetNote => {
                const ribbon = document.createElement('div');
                const noteColor = targetNote.color || 'yellow';
                ribbon.className = `sticker-bookmark-ribbon color-${noteColor}`;
                ribbon.dataset.targetNoteId = targetNote.id;

                const displayTitle = (targetNote.title && targetNote.title.trim()) ? targetNote.title.trim() : untitledText;
                ribbon.title = displayTitle;

                const icon = targetNote.icon || '📄';
                ribbon.innerHTML = `
                    <span class="sticker-bookmark-icon">${icon}</span>
                    <span class="sticker-bookmark-title">${displayTitle}</span>
                `;

                // Кнопка видалення закладки (якщо не в режимі тільки читання)
                if (!isReadOnly) {
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'sticker-bookmark-remove';
                    removeBtn.title = t('sticker.removeBookmark') || 'Видалити закладку';
                    removeBtn.innerHTML = '✕';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.removeBookmark(note, targetNote.id, card, isReadOnly);
                    });
                    ribbon.appendChild(removeBtn);
                }

                // Клік по закладці — перехід до нотатки
                ribbon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target.closest('.sticker-bookmark-remove')) return;

                    // Якщо ми в режимі дошки чи графа — перемикаємось на колонки для переходу
                    if (window.App.store && window.App.state && window.App.state.viewMode !== 'columns') {
                        window.App.store.setViewMode('columns');
                    }
                    if (window.App.workspaceView && window.App.workspaceView.scrollToNote) {
                        window.App.workspaceView.scrollToNote(targetNote.id);
                    }
                });

                container.appendChild(ribbon);
            });

            return container;
        },

        /**
         * Видаляє посилання на цільову нотатку та оновлює картку
         */
        removeBookmark(note, targetNoteId, card, isReadOnly) {
            const noteManager = window.App.noteManager;
            if (!noteManager) return;

            const currentIds = Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : [];
            const updated = currentIds.filter(id => id !== targetNoteId);
            note.linkedNoteIds = updated;

            noteManager.updateNote(note.id, { linkedNoteIds: updated });
            this.refreshCardBookmarks(note, card, isReadOnly);
        },

        /**
         * Додає посилання на цільову нотатку та оновлює картку
         */
        addBookmark(note, targetNoteId, card, isReadOnly) {
            const noteManager = window.App.noteManager;
            if (!noteManager) return;

            const currentIds = Array.isArray(note.linkedNoteIds) ? [...note.linkedNoteIds] : [];
            if (!currentIds.includes(targetNoteId)) {
                currentIds.push(targetNoteId);
                note.linkedNoteIds = currentIds;
                noteManager.updateNote(note.id, { linkedNoteIds: currentIds });
                this.refreshCardBookmarks(note, card, isReadOnly);
            }
        },

        /**
         * Перерендерить блок закладок на картці без перезавантаження всієї колонки
         */
        refreshCardBookmarks(note, card, isReadOnly) {
            if (!card) return;
            const existingBlock = card.querySelector('.sticker-bookmarks-container');
            if (existingBlock) {
                existingBlock.remove();
            }

            const newBlock = this.createBookmarksBlock(note, card, isReadOnly);
            if (newBlock) {
                // Вставляємо перед блоком піднотаток, якщо він є, або додаємо в кінець
                const subnotes = card.querySelector('.sticker-subnotes-container');
                if (subnotes) {
                    card.insertBefore(newBlock, subnotes);
                } else {
                    card.appendChild(newBlock);
                }
            }
        },

        /**
         * Відкриває модальний поповер для пошуку та вибору нотатки
         * @param {Object} note - Поточна нотатка
         * @param {HTMLElement} card - DOM-елемент картки
         */
        openBookmarkPicker(note, card) {
            this.closeBookmarkPicker();

            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const boardManager = window.App.boardManager;
            if (!state || !noteManager) return;

            const i18n = window.App.i18n;
            const t = (key) => i18n ? i18n.t(key) : '';
            const allNotes = state.notes || [];

            // Доступні для закладки нотатки: виключаємо саму себе та вже додані
            const currentLinked = new Set(Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : []);
            const availableNotes = allNotes.filter(n => n.id !== note.id && !currentLinked.has(n.id) && !n.isDeleted);

            // Побудова DOM модалки
            const backdrop = document.createElement('div');
            backdrop.className = 'bookmark-picker-backdrop';

            const modal = document.createElement('div');
            modal.className = 'bookmark-picker-modal';

            const header = document.createElement('div');
            header.className = 'bookmark-picker-header';
            header.innerHTML = `
                <div class="bookmark-picker-title-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                    </svg>
                    <span>${t('sticker.addBookmark') || 'Додати закладку'}</span>
                </div>
                <button type="button" class="bookmark-picker-close-btn" title="${t('common.close') || 'Закрити'}">✕</button>
            `;

            const searchWrap = document.createElement('div');
            searchWrap.className = 'bookmark-picker-search-wrap';
            searchWrap.innerHTML = `
                <span class="bookmark-picker-search-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </span>
                <input type="text" class="bookmark-picker-input" placeholder="${t('sticker.bookmarksSearchPlaceholder') || 'Пошук нотатки для закладки...'}" autocomplete="off">
            `;

            const listEl = document.createElement('div');
            listEl.className = 'bookmark-picker-list';

            modal.appendChild(header);
            modal.appendChild(searchWrap);
            modal.appendChild(listEl);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);
            activeModal = backdrop;

            const inputEl = searchWrap.querySelector('.bookmark-picker-input');
            const closeBtn = header.querySelector('.bookmark-picker-close-btn');

            let selectedIndex = -1;
            let currentFilteredItems = [];

            const getBoardName = (boardId) => {
                if (!boardManager || !boardManager.getBoardById) return '';
                const b = boardManager.getBoardById(boardId);
                return b ? b.name : '';
            };

            const getBreadcrumbPath = (n) => {
                const parts = [];
                const bName = getBoardName(n.boardId);
                if (bName) parts.push(`📁 ${bName}`);
                if (n.parentId) {
                    const p = noteManager.getNoteById(n.parentId);
                    if (p && p.title) parts.push(`📄 ${p.title.trim()}`);
                }
                return parts.join(' › ');
            };

            const renderList = (query = '') => {
                listEl.innerHTML = '';
                selectedIndex = -1;
                const cleanQuery = query.toLowerCase().trim();

                if (availableNotes.length === 0) {
                    listEl.innerHTML = `<div class="bookmark-picker-empty">${t('sticker.allBookmarked') || 'Всі доступні нотатки вже додані в закладки'}</div>`;
                    currentFilteredItems = [];
                    return;
                }

                if (!cleanQuery) {
                    // Zero-state: показуємо Нещодавні (до 5) та Нотатки цього ж блокнота
                    const recent = [...availableNotes].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 5);
                    const currentBoardNotes = availableNotes.filter(n => n.boardId === note.boardId && !recent.some(r => r.id === n.id)).slice(0, 5);

                    currentFilteredItems = [];

                    if (recent.length > 0) {
                        const secTitle = document.createElement('div');
                        secTitle.className = 'bookmark-picker-section-title';
                        secTitle.textContent = t('sticker.recentNotes') || 'Нещодавні нотатки';
                        listEl.appendChild(secTitle);

                        recent.forEach(n => {
                            currentFilteredItems.push(n);
                            appendNoteItem(n, currentFilteredItems.length - 1);
                        });
                    }

                    if (currentBoardNotes.length > 0) {
                        const secTitle = document.createElement('div');
                        secTitle.className = 'bookmark-picker-section-title';
                        secTitle.textContent = t('sticker.currentNotebookNotes') || 'З цього блокнота';
                        listEl.appendChild(secTitle);

                        currentBoardNotes.forEach(n => {
                            currentFilteredItems.push(n);
                            appendNoteItem(n, currentFilteredItems.length - 1);
                        });
                    }
                } else {
                    // Фільтрація за назвою, назвою блокнота або текстом
                    const matches = availableNotes.filter(n => {
                        const titleMatch = (n.title || '').toLowerCase().includes(cleanQuery);
                        const bName = getBoardName(n.boardId).toLowerCase();
                        const boardMatch = bName.includes(cleanQuery);
                        const contentMatch = (n.content || '').toLowerCase().includes(cleanQuery);
                        return titleMatch || boardMatch || contentMatch;
                    });

                    // Сортуємо: збіг на початку назви > збіг всередині назви > збіг у блокноті
                    matches.sort((a, b) => {
                        const aTitle = (a.title || '').toLowerCase();
                        const bTitle = (b.title || '').toLowerCase();
                        const aStarts = aTitle.startsWith(cleanQuery);
                        const bStarts = bTitle.startsWith(cleanQuery);
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                        return 0;
                    });

                    currentFilteredItems = matches;

                    if (matches.length === 0) {
                        listEl.innerHTML = `<div class="bookmark-picker-empty">${t('sticker.noNotesFound') || 'Нотаток не знайдено'}</div>`;
                        return;
                    }

                    matches.forEach((n, idx) => appendNoteItem(n, idx, cleanQuery));
                }

                if (currentFilteredItems.length > 0) {
                    selectedIndex = 0;
                    updateItemSelection();
                }
            };

            const appendNoteItem = (targetNote, index, highlightQuery = '') => {
                const item = document.createElement('div');
                item.className = 'bookmark-picker-item';
                item.dataset.index = index;

                const defaultUntitled = t('sticker.untitled') || 'Без назви';
                const rawTitle = (targetNote.title && targetNote.title.trim()) ? targetNote.title.trim() : defaultUntitled;

                let titleHtml = rawTitle;
                if (highlightQuery && rawTitle.toLowerCase().includes(highlightQuery)) {
                    const idx = rawTitle.toLowerCase().indexOf(highlightQuery);
                    titleHtml = rawTitle.substring(0, idx) +
                        `<span class="bookmark-picker-match">${rawTitle.substring(idx, idx + highlightQuery.length)}</span>` +
                        rawTitle.substring(idx + highlightQuery.length);
                }

                const path = getBreadcrumbPath(targetNote);

                item.innerHTML = `
                    <div class="bookmark-picker-item-icon">${targetNote.icon || '📄'}</div>
                    <div class="bookmark-picker-item-info">
                        <div class="bookmark-picker-item-title">${titleHtml}</div>
                        ${path ? `<div class="bookmark-picker-item-path">${path}</div>` : ''}
                    </div>
                `;

                item.addEventListener('click', () => {
                    this.addBookmark(note, targetNote.id, card, false);
                    this.closeBookmarkPicker();
                });

                listEl.appendChild(item);
            };

            const updateItemSelection = () => {
                const items = listEl.querySelectorAll('.bookmark-picker-item');
                items.forEach((it, idx) => {
                    const isSel = idx === selectedIndex;
                    it.classList.toggle('is-selected', isSel);
                    if (isSel) {
                        it.scrollIntoView({ block: 'nearest' });
                    }
                });
            };

            // Обробка пошукового вводу
            inputEl.addEventListener('input', (e) => {
                renderList(e.target.value);
            });

            // Навігація клавіатурою
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (currentFilteredItems.length > 0) {
                        selectedIndex = (selectedIndex + 1) % currentFilteredItems.length;
                        updateItemSelection();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (currentFilteredItems.length > 0) {
                        selectedIndex = (selectedIndex - 1 + currentFilteredItems.length) % currentFilteredItems.length;
                        updateItemSelection();
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && selectedIndex < currentFilteredItems.length) {
                        const target = currentFilteredItems[selectedIndex];
                        this.addBookmark(note, target.id, card, false);
                        this.closeBookmarkPicker();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeBookmarkPicker();
                }
            });

            // Закриття
            closeBtn.addEventListener('click', () => this.closeBookmarkPicker());
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.closeBookmarkPicker();
                }
            });

            // Початковий рендер та фокус
            renderList('');
            setTimeout(() => inputEl.focus(), 50);
        },

        closeBookmarkPicker() {
            if (activeModal) {
                activeModal.remove();
                activeModal = null;
            }
        }
    };
})();
