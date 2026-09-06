// js/workspace/stickerHeader.js - Модуль побудови хедера картки стікера (заголовок, емодзі, меню, кнопки)
window.App = window.App || {};

(function() {
    window.App.stickerHeader = {
        /**
         * Створює блок хедера для стікера
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - Кореневий DOM-елемент картки
         * @param {number} colIndex - Індекс колонки
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @param {boolean} isChainOpen - Прапорець чи розгорнута колонка піднотаток
         * @returns {{ header: HTMLElement, titleDiv: HTMLElement, dragHandle: HTMLElement|null }}
         */
        createHeader(note, card, colIndex, isReadOnly, isChainOpen) {
            const noteManager = window.App.noteManager;
            const sidebarView = window.App.sidebarView;

            const header = document.createElement('div');
            header.className = 'sticker-header';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'sticker-title-wrap';

            // 1. Notion-емодзі пікер (тільки для редагованих нотаток)
            let emojiWrap;
            if (!isReadOnly && window.App.emojiPicker) {
                emojiWrap = window.App.emojiPicker.createEmojiPicker(note, (newIcon) => {
                    if (sidebarView && sidebarView.updateNoteListItem) {
                        sidebarView.updateNoteListItem(note.id, note.title, newIcon);
                    }
                });
            } else {
                emojiWrap = document.createElement('span');
                emojiWrap.className = 'sticker-header-icon';
                emojiWrap.textContent = note.icon || '📄';
                emojiWrap.style.marginRight = '6px';
                emojiWrap.style.fontSize = '15px';
            }

            // 2. Заголовок нотатки
            const titleDiv = document.createElement('div');
            titleDiv.className = 'sticker-title';
            titleDiv.contentEditable = isReadOnly ? 'false' : 'true';
            titleDiv.spellcheck = false;
            titleDiv.autocapitalize = 'off';
            titleDiv.autocomplete = 'off';
            titleDiv.dataset.placeholder = isReadOnly ? '' : 'Заголовок...';
            titleDiv.innerText = note.title || '';

            function updateTitlePlaceholder() {
                if (isReadOnly) return;
                if (titleDiv.textContent.trim() === '') {
                    titleDiv.setAttribute('data-empty', 'true');
                } else {
                    titleDiv.removeAttribute('data-empty');
                }
            }

            updateTitlePlaceholder();

            if (!isReadOnly) {
                titleDiv.addEventListener('input', () => {
                    updateTitlePlaceholder();
                    const text = titleDiv.innerText.replace(/\r?\n|\r/g, ' ').trim();
                    if (noteManager && noteManager.updateNote) {
                        noteManager.updateNote(note.id, { title: text });
                    }
                    if (sidebarView && sidebarView.updateNoteListItem) {
                        sidebarView.updateNoteListItem(note.id, text, note.icon);
                    }
                });

                titleDiv.addEventListener('focus', updateTitlePlaceholder);
                titleDiv.addEventListener('blur', updateTitlePlaceholder);
            }

            titleWrap.appendChild(emojiWrap);
            titleWrap.appendChild(titleDiv);

            // 3. Меню та кнопки дій
            const actions = document.createElement('div');
            actions.className = 'sticker-actions';

            let menuDropdownWrap = null;
            if (!isReadOnly && window.App.stickerMenu) {
                menuDropdownWrap = window.App.stickerMenu.createMenu(note, card, colIndex, isChainOpen);
            }

            let dragHandle = null;
            if (!isReadOnly) {
                // Ручка перетягування (Drag Handle)
                dragHandle = document.createElement('div');
                dragHandle.className = 'sticker-drag-handle';
                dragHandle.title = 'Перетягніть для зміни порядку або між колонками';
                dragHandle.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="8" cy="4" r="2"></circle>
                        <circle cx="8" cy="12" r="2"></circle>
                        <circle cx="8" cy="20" r="2"></circle>
                        <circle cx="16" cy="4" r="2"></circle>
                        <circle cx="16" cy="12" r="2"></circle>
                        <circle cx="16" cy="20" r="2"></circle>
                    </svg>
                `;

                // Кнопка швидкого видалення
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'sticker-delete-btn';
                deleteBtn.title = 'Видалити нотатку';
                deleteBtn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                `;
                deleteBtn.addEventListener('click', (e) => {
                    if (noteManager && noteManager.deleteNote) {
                        noteManager.deleteNote(note.id, e);
                    }
                });

                if (menuDropdownWrap) actions.appendChild(menuDropdownWrap);
                actions.appendChild(dragHandle);
                actions.appendChild(deleteBtn);
            } else if (menuDropdownWrap) {
                actions.appendChild(menuDropdownWrap);
            }

            header.appendChild(titleWrap);
            header.appendChild(actions);

            return {
                header,
                titleDiv,
                dragHandle
            };
        }
    };
})();
