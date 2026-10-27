// js/workspace/stickerBookmarks.js - Модуль стрічок-закладок (Bookmark Ribbons) та вибору пов'язаних нотаток
window.App = window.App || {};

(function() {
    let activeModal = null;

    window.App.stickerBookmarks = {
        /**
         * Отримує збережені ID закладок для нотатки з резервного персистентного сховища LocalStorage
         * @param {string} noteId
         * @returns {string[]}
         */
        getSavedBookmarks(noteId) {
            if (!noteId) return [];
            try {
                const map = JSON.parse(localStorage.getItem('minimal_note_bookmarks') || '{}');
                return Array.isArray(map[noteId]) ? map[noteId] : [];
            } catch {
                return [];
            }
        },

        /**
         * Зберігає зв'язки закладок нотатки у персистентне резервне сховище
         * @param {string} noteId
         * @param {string[]} linkedIds
         */
        saveLocalBookmarks(noteId, linkedIds) {
            if (!noteId) return;
            try {
                const map = JSON.parse(localStorage.getItem('minimal_note_bookmarks') || '{}');
                if (Array.isArray(linkedIds) && linkedIds.length > 0) {
                    map[noteId] = linkedIds;
                } else {
                    delete map[noteId];
                }
                localStorage.setItem('minimal_note_bookmarks', JSON.stringify(map));
            } catch (e) {
                console.warn('[Bookmarks] Failed to persist bookmark map:', e);
            }
        },

        /**
         * Очищує посилання на видалені нотатки зі сховища закладок
         * @param {Set<string>|string[]} deletedIds
         */
        cleanBookmarksForDeletedNotes(deletedIds) {
            const delSet = deletedIds instanceof Set ? deletedIds : new Set(deletedIds);
            if (delSet.size === 0) return;
            try {
                const map = JSON.parse(localStorage.getItem('minimal_note_bookmarks') || '{}');
                let changed = false;
                for (const key of Object.keys(map)) {
                    if (delSet.has(key)) {
                        delete map[key];
                        changed = true;
                    } else if (Array.isArray(map[key])) {
                        const filtered = map[key].filter(id => !delSet.has(id));
                        if (filtered.length !== map[key].length) {
                            map[key] = filtered;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    localStorage.setItem('minimal_note_bookmarks', JSON.stringify(map));
                }
            } catch {}
        },

        /**
         * Створює блок стрічок-закладок для картки стікера (на всю ширину картки)
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - DOM-елемент картки
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @returns {HTMLElement|null} - Контейнер закладок або null якщо закладок немає
         */
        createBookmarksBlock(note, card, isReadOnly) {
            let linkedIds = Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : [];
            if (linkedIds.length === 0) {
                // Відновлюємо з персистентного сховища закладок якщо на об'єкті нотатки не збереглося
                const stored = this.getSavedBookmarks(note.id);
                if (stored.length > 0) {
                    note.linkedNoteIds = [...stored];
                    linkedIds = note.linkedNoteIds;
                }
            }
            if (linkedIds.length === 0) return null;

            const noteManager = window.App.noteManager;
            if (!noteManager) return null;

            // Фільтруємо валідні цільові нотатки (виключно в межах поточного блокнота)
            const currentBoardId = note.boardId || (window.App.state && window.App.state.activeBoardId);
            const validTargetNotes = linkedIds
                .map(id => noteManager.getNoteById(id))
                .filter(n => n && n.id !== note.id && (!currentBoardId || !n.boardId || n.boardId === currentBoardId));

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

            this.saveLocalBookmarks(note.id, updated);
            noteManager.updateNote(note.id, { linkedNoteIds: updated });
            if (window.App.storage) {
                if (window.App.state && window.App.state.notes) {
                    window.App.storage.saveNotes(window.App.state.notes, true);
                }
                if (window.App.storage.flushNotes) {
                    window.App.storage.flushNotes();
                }
            }
            this.refreshCardBookmarks(note, card, isReadOnly);
        },

        /**
         * Додає посилання на цільову нотатку та оновлює картку (виключно в межах поточного блокнота)
         */
        addBookmark(note, targetNoteId, card, isReadOnly) {
            const noteManager = window.App.noteManager;
            if (!noteManager) return;

            const targetNote = noteManager.getNoteById(targetNoteId);
            if (!targetNote) return;

            // Забороняємо закладки з інших блокнотів
            const currentBoardId = note.boardId || (window.App.state && window.App.state.activeBoardId);
            const targetBoardId = targetNote.boardId || currentBoardId;
            if (currentBoardId && targetBoardId && currentBoardId !== targetBoardId) {
                return;
            }

            const currentIds = Array.isArray(note.linkedNoteIds) ? [...note.linkedNoteIds] : [];
            if (!currentIds.includes(targetNoteId)) {
                currentIds.push(targetNoteId);
                note.linkedNoteIds = currentIds;

                this.saveLocalBookmarks(note.id, currentIds);
                noteManager.updateNote(note.id, { linkedNoteIds: currentIds });
                if (window.App.storage) {
                    if (window.App.state && window.App.state.notes) {
                        window.App.storage.saveNotes(window.App.state.notes, true);
                    }
                    if (window.App.storage.flushNotes) {
                        window.App.storage.flushNotes();
                    }
                }
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
         * Відкриває оверлей вибору закладок виключно в межах поточного блокнота
         * @param {Object} note - Поточна нотатка
         * @param {HTMLElement} card - DOM-елемент картки
         */
        openBookmarkPicker(note, card) {
            this.closeBookmarkPicker();

            const state = window.App.state;
            const noteManager = window.App.noteManager;
            if (!state || !noteManager) return;

            const i18n = window.App.i18n;
            const t = (key) => i18n ? i18n.t(key) : '';
            const allNotes = state.notes || [];

            // Визначаємо ID поточного блокнота
            const currentBoardId = note.boardId || state.activeBoardId;
            const ownBoards = Array.isArray(state.boards) ? state.boards : [];
            const primaryBoardId = ownBoards[0]?.id;

            // Доступні для закладки нотатки виключно з ЦЬОГО Ж блокнота
            const currentLinked = new Set(Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : []);
            const availableNotes = allNotes.filter(n => {
                if (n.id === note.id || currentLinked.has(n.id) || n.isDeleted) return false;
                const noteBoard = n.boardId || primaryBoardId;
                const currentBoard = currentBoardId || primaryBoardId;
                return noteBoard === currentBoard;
            });

            // Сортуємо нотатки за датою останнього оновлення/створення
            availableNotes.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

            let selectedIndex = -1;
            let currentFilteredItems = [];

            // Побудова DOM модалки
            const backdrop = document.createElement('div');
            backdrop.className = 'bookmark-picker-backdrop';

            const modal = document.createElement('div');
            modal.className = 'bookmark-picker-modal';

            const header = document.createElement('div');
            header.className = 'bookmark-picker-header';

            const leftWrap = document.createElement('div');
            leftWrap.className = 'bookmark-picker-header-left';
            leftWrap.innerHTML = `
                <div class="bookmark-picker-title-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                    </svg>
                    <span>${t('sticker.addBookmark') || 'Додати закладку'}</span>
                </div>
            `;

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'bookmark-picker-close-btn';
            closeBtn.title = t('common.close') || 'Закрити';
            closeBtn.innerHTML = '✕';
            closeBtn.addEventListener('click', () => this.closeBookmarkPicker());

            header.appendChild(leftWrap);
            header.appendChild(closeBtn);

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

            const getBreadcrumbPath = (n) => {
                if (n.parentId) {
                    const p = noteManager.getNoteById(n.parentId);
                    if (p && p.title) return `📄 ${p.title.trim()}`;
                }
                return '';
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

            const renderContent = (query = '') => {
                listEl.innerHTML = '';
                selectedIndex = -1;
                const cleanQuery = query.toLowerCase().trim();

                if (availableNotes.length === 0) {
                    listEl.innerHTML = `<div class="bookmark-picker-empty">${t('sticker.emptyNotebook') || 'У цьому блокноті немає інших нотаток для закладки'}</div>`;
                    currentFilteredItems = [];
                    return;
                }

                let matches = availableNotes;
                if (cleanQuery) {
                    matches = availableNotes.filter(n => {
                        const titleMatch = (n.title || '').toLowerCase().includes(cleanQuery);
                        const contentMatch = (n.content || '').toLowerCase().includes(cleanQuery);
                        return titleMatch || contentMatch;
                    });

                    matches.sort((a, b) => {
                        const aTitle = (a.title || '').toLowerCase();
                        const bTitle = (b.title || '').toLowerCase();
                        const aStarts = aTitle.startsWith(cleanQuery);
                        const bStarts = bTitle.startsWith(cleanQuery);
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                        return 0;
                    });
                }

                currentFilteredItems = matches;

                if (matches.length === 0) {
                    listEl.innerHTML = `<div class="bookmark-picker-empty">${t('sticker.noNotesFound') || 'Нотаток не знайдено'}</div>`;
                    return;
                }

                matches.forEach((n, idx) => appendNoteItem(n, idx, cleanQuery));

                if (currentFilteredItems.length > 0) {
                    selectedIndex = 0;
                    updateItemSelection();
                }
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
                        const targetNote = currentFilteredItems[selectedIndex];
                        this.addBookmark(note, targetNote.id, card, false);
                        this.closeBookmarkPicker();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeBookmarkPicker();
                }
            });

            // Закриття кліком по фону
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.closeBookmarkPicker();
                }
            });

            // Початковий рендер
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
