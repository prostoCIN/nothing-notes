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
            titleDiv.autocapitalize = 'sentences';
            titleDiv.autocomplete = 'off';
            titleDiv.dataset.placeholder = isReadOnly ? '' : 'Заголовок...';
            titleDiv.innerText = note.title || '';

            function updateTitlePlaceholder() {
                if (isReadOnly) return;
                const rawText = titleDiv.textContent.replace(/\u200B/g, '').trim();
                if (rawText === '') {
                    titleDiv.setAttribute('data-empty', 'true');
                    // Якщо елемент у фокусі і повністю порожній (0 вузлів), гарантуємо <br> для відмальовки каретки
                    if (document.activeElement === titleDiv && titleDiv.childNodes.length === 0) {
                        titleDiv.innerHTML = '<br>';
                        const sel = window.getSelection();
                        if (sel) {
                            const range = document.createRange();
                            range.setStart(titleDiv, 0);
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                } else {
                    titleDiv.removeAttribute('data-empty');
                }
            }

            updateTitlePlaceholder();

            if (!isReadOnly) {
                let isHeaderAutoCapitalizing = false;
                let lastHeaderAutoCapitalized = null;

                titleDiv.addEventListener('beforeinput', (e) => {
                    if (isHeaderAutoCapitalizing) return;
                    if (e.inputType === 'insertText' && e.data && e.data.length === 1) {
                        const char = e.data;
                        if (/\p{L}/u.test(char)) {
                            const upper = char.toLocaleUpperCase();
                            if (upper !== char) {
                                const sel = window.getSelection();
                                if (sel && sel.isCollapsed && sel.rangeCount > 0) {
                                    const range = sel.getRangeAt(0);
                                    if (titleDiv.contains(range.startContainer)) {
                                        if (lastHeaderAutoCapitalized &&
                                            lastHeaderAutoCapitalized.char === char &&
                                            lastHeaderAutoCapitalized.userDeleted &&
                                            Date.now() - lastHeaderAutoCapitalized.time < 4000) {
                                            lastHeaderAutoCapitalized = null;
                                            return;
                                        }

                                        try {
                                            const preRange = document.createRange();
                                            preRange.setStart(titleDiv, 0);
                                            preRange.setEnd(range.startContainer, range.startOffset);
                                            const textBefore = preRange.toString();

                                            const SENTENCE_START_REGEX = /(?:^[\s\u00A0]*|[\r\n]+[\s\u00A0]*|(?:[.!?…]+|\.\.\.)[\s\u00A0]*(?:[\s\u00A0\r\n]|["'«»“”„(\[—–-])[\s\u00A0]*)$/;
                                            const isAutoCapEnabled = !window.App?.settingsModal || window.App.settingsModal.isAutoCapitalizeEnabled();
                                            if (isAutoCapEnabled && SENTENCE_START_REGEX.test(textBefore)) {
                                                if (e.cancelable) {
                                                    e.preventDefault();
                                                    isHeaderAutoCapitalizing = true;
                                                    lastHeaderAutoCapitalized = { char, upper, time: Date.now(), userDeleted: false };
                                                    try {
                                                        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                                                            document.execCommand('insertText', false, upper);
                                                        } else {
                                                            const textNode = document.createTextNode(upper);
                                                            range.deleteContents();
                                                            range.insertNode(textNode);
                                                            const newRange = document.createRange();
                                                            newRange.setStartAfter(textNode);
                                                            newRange.collapse(true);
                                                            sel.removeAllRanges();
                                                            sel.addRange(newRange);
                                                        }
                                                    } finally {
                                                        isHeaderAutoCapitalizing = false;
                                                    }
                                                }
                                            }
                                        } catch (err) {}
                                    }
                                }
                            }
                        }
                    }
                });

                titleDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && lastHeaderAutoCapitalized && Date.now() - lastHeaderAutoCapitalized.time < 4000) {
                        lastHeaderAutoCapitalized.userDeleted = true;
                    }
                });

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

                // Вставка тільки чистого тексту без форматування з області контенту чи буфера обміну
                titleDiv.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
                    if (!text) return;

                    const cleanText = text.replace(/\r?\n|\r/g, ' ');

                    if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                        document.execCommand('insertText', false, cleanText);
                    } else {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            range.deleteContents();
                            const textNode = document.createTextNode(cleanText);
                            range.insertNode(textNode);
                            range.setStartAfter(textNode);
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        } else {
                            titleDiv.innerText = cleanText;
                        }
                    }

                    titleDiv.dispatchEvent(new Event('input', { bubbles: true }));
                });

                // Перетягування (Drag & Drop) виділеного тексту в заголовок тільки як чистий текст
                titleDiv.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const text = e.dataTransfer?.getData('text/plain') || '';
                    if (!text) return;

                    const cleanText = text.replace(/\r?\n|\r/g, ' ');

                    let range = null;
                    if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(e.clientX, e.clientY);
                    } else if (document.caretPositionFromPoint) {
                        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                        }
                    }

                    const sel = window.getSelection();
                    if (range && sel) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                        range.deleteContents();
                        const textNode = document.createTextNode(cleanText);
                        range.insertNode(textNode);
                        range.setStartAfter(textNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        titleDiv.innerText = cleanText;
                    }

                    titleDiv.dispatchEvent(new Event('input', { bubbles: true }));
                });

                // Натискання Enter у заголовку переводить фокус на область тексту нотатки
                titleDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const contentEl = card.querySelector('.sticker-content');
                        if (contentEl) {
                            contentEl.focus();
                        }
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
