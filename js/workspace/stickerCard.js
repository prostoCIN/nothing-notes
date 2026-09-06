// js/workspace/stickerCard.js - Головний оркестратор побудови DOM-картки стікера
window.App = window.App || {};

(function() {
    window.App.stickerCard = {
        /**
         * Створює повний DOM-елемент стікера нотатки
         * @param {Object} note - Об'єкт нотатки
         * @param {number} colIndex - Порядковий номер колонки
         * @returns {HTMLElement} - DOM елемент card
         */
        createCard(note, colIndex) {
            const state = window.App.state;

            const card = document.createElement('div');
            card.className = 'note-sticker';
            card.dataset.noteId = note.id;
            card.dataset.parentId = note.parentId || 'root';

            // Перевіряємо чи нотатка належить до спільного (тільки для читання) блокнота
            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            const isReadOnly = !!note.isReadOnly || !!(currentBoard && currentBoard.isReadOnly) || (note.boardId && note.boardId.startsWith('shared_'));

            if (isReadOnly) {
                card.classList.add('is-readonly');
            }

            // Застосовуємо збережений або дефолтний колір стікера
            const noteColor = note.color || 'yellow';
            card.classList.add(`color-${noteColor}`);

            // Застосовуємо збережений або дефолтний розмір шрифту
            const rawFontSize = note.fontSize;
            if (typeof rawFontSize === 'number') {
                const stepIdx = rawFontSize <= 12 ? 0 : rawFontSize <= 16 ? 1 : rawFontSize <= 24 ? 2 : 3;
                card.dataset.fontStep = stepIdx;
                card.style.setProperty('--custom-content-font-size', `${rawFontSize}px`);
                card.style.setProperty('--custom-title-font-size', `${Math.round(rawFontSize * 1.85)}px`);
                card.style.setProperty('--custom-line-height', `${Math.round(rawFontSize * 1.9)}px`);
                card.classList.add('has-custom-font-size');
            } else if (rawFontSize === 'small' || rawFontSize === 'medium' || rawFontSize === 'large') {
                card.classList.add(`font-size-${rawFontSize}`);
            }

            // Чекбокс вибору у стилі iOS Галереї (круглий з галочкою)
            const selectCheckbox = document.createElement('div');
            selectCheckbox.className = 'sticker-select-checkbox';
            selectCheckbox.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            card.appendChild(selectCheckbox);

            if (state && state.isWorkspaceSelectMode) {
                card.classList.add('in-select-mode');
                if (state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.has(note.id)) {
                    card.classList.add('is-ws-selected');
                }
            }

            // Клік по картці в режимі вибору перемикає виділення (як в iOS галереї)
            card.addEventListener('click', (e) => {
                if (window.App.state && window.App.state.isWorkspaceSelectMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.App.workspaceSelectionBar) {
                        window.App.workspaceSelectionBar.toggleNoteSelection(note.id);
                    }
                }
            }, true);

            // Смужка перфорації з дірочками по лівому краю (ручка перетягування)
            const perforationHandle = document.createElement('div');
            perforationHandle.className = 'sticker-perforation-handle';
            perforationHandle.title = 'Перетягніть для зміни порядку';
            card.appendChild(perforationHandle);

            const isChainOpen = state && state.activeChain && state.activeChain[colIndex + 1] === note.id;
            if (isChainOpen) {
                card.classList.add('active-parent-note');
            }

            // 1. Хедер стікера (емодзі, заголовок, меню, кнопки)
            let headerResult = { header: null, titleDiv: null, dragHandle: null };
            if (window.App.stickerHeader) {
                headerResult = window.App.stickerHeader.createHeader(note, card, colIndex, isReadOnly, isChainOpen);
                if (headerResult.header) {
                    card.appendChild(headerResult.header);
                }
            }

            // 2. Текстовий вміст стікера
            if (window.App.stickerContent) {
                const contentDiv = window.App.stickerContent.createContent(note, card, isReadOnly, headerResult.titleDiv);
                if (contentDiv) {
                    card.appendChild(contentDiv);
                }
            }

            // 3. Polaroid-галерея фотографій
            if (window.App.stickerGallery) {
                const galleryContainer = window.App.stickerGallery.createGallery(note, card, isReadOnly);
                if (galleryContainer) {
                    card.appendChild(galleryContainer);
                }
            }

            // 4. Washi Tape теги
            if (window.App.stickerTags) {
                const tagsContainer = window.App.stickerTags.createTagsContainer(note, card, isReadOnly);
                if (tagsContainer) {
                    card.appendChild(tagsContainer);
                }
            }

            // 5. Блок списку піднотаток (якщо є)
            if (window.App.stickerSubnotes) {
                const subnotesBlock = window.App.stickerSubnotes.createSubnotesBlock(note, colIndex, isChainOpen);
                if (subnotesBlock) {
                    card.appendChild(subnotesBlock);
                }
            }

            // 6. Виклик тулбоксу/меню нотатки на ПКМ (тільки для власних редагованих нотаток)
            if (!isReadOnly) {
                card.addEventListener('contextmenu', (e) => {
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();

                    const moreBtn = card.querySelector('.sticker-more-btn');
                    const menuDropdown = card.querySelector('.sticker-menu-dropdown');

                    // Закриваємо всі інші відкриті меню
                    document.querySelectorAll('.sticker-menu-dropdown.active, .sticker-emoji-picker-dropdown.active, .sticker-tag-dropdown.active, .column-filter-dropdown.active, .sidebar-context-menu').forEach(d => {
                        if (d !== menuDropdown) d.classList.remove('active', 'open-upward');
                    });

                    if (menuDropdown && moreBtn) {
                        if (window.App.smartPositionDropdown) {
                            window.App.smartPositionDropdown(moreBtn, menuDropdown, 160);
                        }
                        menuDropdown.classList.add('active');
                    }
                });
            }

            // 7. Ініціалізація перетягування (Drag & Drop) стікера
            if (!isReadOnly && window.App.initStickerDrag) {
                const dragHandles = [perforationHandle];
                if (headerResult.dragHandle) {
                    dragHandles.push(headerResult.dragHandle);
                }
                window.App.initStickerDrag(card, dragHandles, note.parentId || null);
            }

            return card;
        }
    };
})();
