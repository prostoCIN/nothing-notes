// js/workspace/stickerBookmarks.js - Модуль стрічок-закладок (Bookmark Ribbons) та вибору пов'язаних нотаток
window.App = window.App || {};

(function() {
    let activeModal = null;

    window.App.stickerBookmarks = {
        /**
         * Створює блок стрічок-закладок для картки стікера (на всю ширину картки)
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
                ribbon.className = 'sticker-bookmark-ribbon';
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
         * Відкриває оверлей вибору закладок: спочатку блокноти, далі нотатки обраного блокнота
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

            // Доступні для закладки нотатки (виключаємо саму себе та вже додані)
            const currentLinked = new Set(Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : []);
            const availableNotes = allNotes.filter(n => n.id !== note.id && !currentLinked.has(n.id) && !n.isDeleted);

            // Отримуємо всі блокноти (власні та спільні)
            const ownBoards = Array.isArray(state.boards) ? state.boards : [];
            const readOnlyBoards = Array.isArray(state.readOnlyBoards) ? state.readOnlyBoards : [];
            const allBoards = [...ownBoards, ...readOnlyBoards];
            const primaryBoardId = ownBoards[0]?.id;

            // Стан оверлею: 'boards' (список блокнотів) або 'notes' (нотатки обраного блокнота)
            let currentView = 'boards';
            let selectedBoard = null;
            let selectedIndex = -1;
            let currentFilteredItems = [];

            // Побудова DOM модалки
            const backdrop = document.createElement('div');
            backdrop.className = 'bookmark-picker-backdrop';

            const modal = document.createElement('div');
            modal.className = 'bookmark-picker-modal';

            const header = document.createElement('div');
            header.className = 'bookmark-picker-header';

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

            const updateHeader = () => {
                header.innerHTML = '';

                const leftWrap = document.createElement('div');
                leftWrap.className = 'bookmark-picker-header-left';

                if (currentView === 'notes' && selectedBoard) {
                    const backBtn = document.createElement('button');
                    backBtn.type = 'button';
                    backBtn.className = 'bookmark-picker-back-btn';
                    backBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        <span>${t('sticker.backToNotebooks') || 'Назад'}</span>
                    `;
                    backBtn.addEventListener('click', () => {
                        currentView = 'boards';
                        selectedBoard = null;
                        inputEl.value = '';
                        inputEl.placeholder = t('sticker.bookmarksSearchPlaceholder') || 'Пошук нотатки для закладки...';
                        updateHeader();
                        renderContent('');
                    });
                    leftWrap.appendChild(backBtn);

                    const titleEl = document.createElement('div');
                    titleEl.className = 'bookmark-picker-title-wrap';
                    titleEl.innerHTML = `<span>📁 ${selectedBoard.name}</span>`;
                    leftWrap.appendChild(titleEl);
                } else {
                    const titleEl = document.createElement('div');
                    titleEl.className = 'bookmark-picker-title-wrap';
                    titleEl.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                        </svg>
                        <span>${t('sticker.selectNotebook') || 'Оберіть блокнот'}</span>
                    `;
                    leftWrap.appendChild(titleEl);
                }

                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'bookmark-picker-close-btn';
                closeBtn.title = t('common.close') || 'Закрити';
                closeBtn.innerHTML = '✕';
                closeBtn.addEventListener('click', () => this.closeBookmarkPicker());

                header.appendChild(leftWrap);
                header.appendChild(closeBtn);
            };

            const renderContent = (query = '') => {
                listEl.innerHTML = '';
                selectedIndex = -1;
                const cleanQuery = query.toLowerCase().trim();

                if (availableNotes.length === 0) {
                    listEl.innerHTML = `<div class="bookmark-picker-empty">${t('sticker.allBookmarked') || 'Всі доступні нотатки вже додані в закладки'}</div>`;
                    currentFilteredItems = [];
                    return;
                }

                // Якщо користувач ввів пошуковий запит — виконуємо прямий пошук нотаток
                if (cleanQuery) {
                    let searchPool = availableNotes;
                    if (currentView === 'notes' && selectedBoard) {
                        searchPool = availableNotes.filter(n => n.boardId === selectedBoard.id || (!n.boardId && selectedBoard.id === primaryBoardId));
                    }

                    const matches = searchPool.filter(n => {
                        const titleMatch = (n.title || '').toLowerCase().includes(cleanQuery);
                        const bName = getBoardName(n.boardId).toLowerCase();
                        const boardMatch = bName.includes(cleanQuery);
                        const contentMatch = (n.content || '').toLowerCase().includes(cleanQuery);
                        return titleMatch || boardMatch || contentMatch;
                    });

                    // Сортуємо за релевантністю
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
                } else if (currentView === 'boards') {
                    // РЕЖИМ 1: Список блокнотів + секція Нещодавніх зверху
                    currentFilteredItems = [];

                    // 1. Секція нещодавніх нотаток для швидкого доступу
                    const recent = [...availableNotes]
                        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
                        .slice(0, 3);

                    if (recent.length > 0) {
                        const secTitle = document.createElement('div');
                        secTitle.className = 'bookmark-picker-section-title';
                        secTitle.textContent = t('sticker.recentNotes') || 'Нещодавні нотатки';
                        listEl.appendChild(secTitle);

                        recent.forEach(n => {
                            currentFilteredItems.push({ type: 'note', data: n });
                            appendNoteItem(n, currentFilteredItems.length - 1);
                        });
                    }

                    // 2. Секція блокнотів
                    const boardsTitle = document.createElement('div');
                    boardsTitle.className = 'bookmark-picker-section-title';
                    boardsTitle.textContent = t('sticker.notebooksSection') || 'Блокноти';
                    listEl.appendChild(boardsTitle);

                    allBoards.forEach(board => {
                        const boardNotes = availableNotes.filter(n => n.boardId === board.id || (!n.boardId && board.id === primaryBoardId));
                        currentFilteredItems.push({ type: 'board', data: board, count: boardNotes.length });
                        appendBoardItem(board, boardNotes.length, currentFilteredItems.length - 1);
                    });
                } else if (currentView === 'notes' && selectedBoard) {
                    // РЕЖИМ 2: Нотатки обраного блокнота
                    const boardNotes = availableNotes.filter(n => n.boardId === selectedBoard.id || (!n.boardId && selectedBoard.id === primaryBoardId));
                    currentFilteredItems = boardNotes;

                    if (boardNotes.length === 0) {
                        listEl.innerHTML = `<div class="bookmark-picker-empty">${t('sticker.emptyNotebook') || 'У цьому блокноті немає доступних нотаток'}</div>`;
                        return;
                    }

                    boardNotes.forEach((n, idx) => appendNoteItem(n, idx));
                }

                if (currentFilteredItems.length > 0) {
                    selectedIndex = 0;
                    updateItemSelection();
                }
            };

            const appendBoardItem = (board, notesCount, index) => {
                const item = document.createElement('div');
                item.className = 'bookmark-picker-board-item';
                item.dataset.index = index;

                item.innerHTML = `
                    <div class="bookmark-picker-board-left">
                        <div class="bookmark-picker-board-icon">${board.icon || '📁'}</div>
                        <div class="bookmark-picker-board-name">${board.name}</div>
                    </div>
                    <div class="bookmark-picker-board-right">
                        <span class="bookmark-picker-board-count">${notesCount}</span>
                        <span class="bookmark-picker-board-arrow">›</span>
                    </div>
                `;

                item.addEventListener('click', () => {
                    currentView = 'notes';
                    selectedBoard = board;
                    inputEl.value = '';
                    inputEl.placeholder = `Пошук у "${board.name}"...`;
                    updateHeader();
                    renderContent('');
                    inputEl.focus();
                });

                listEl.appendChild(item);
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
                const items = listEl.querySelectorAll('.bookmark-picker-item, .bookmark-picker-board-item');
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
                renderContent(e.target.value);
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
                        if (target.type === 'board') {
                            currentView = 'notes';
                            selectedBoard = target.data;
                            inputEl.value = '';
                            inputEl.placeholder = `Пошук у "${selectedBoard.name}"...`;
                            updateHeader();
                            renderContent('');
                        } else {
                            const noteObj = target.data || target;
                            this.addBookmark(note, noteObj.id, card, false);
                            this.closeBookmarkPicker();
                        }
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (currentView === 'notes') {
                        currentView = 'boards';
                        selectedBoard = null;
                        inputEl.value = '';
                        inputEl.placeholder = t('sticker.bookmarksSearchPlaceholder') || 'Пошук нотатки для закладки...';
                        updateHeader();
                        renderContent('');
                    } else {
                        this.closeBookmarkPicker();
                    }
                }
            });

            // Закриття кліком по фону
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.closeBookmarkPicker();
                }
            });

            // Початковий рендер
            updateHeader();
            renderContent('');
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
