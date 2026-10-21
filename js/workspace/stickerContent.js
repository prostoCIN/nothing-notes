// js/workspace/stickerContent.js - Модуль текстового вмісту стікера та обробки форматування/вводу
window.App = window.App || {};

(function() {
    function isClipboardFromTitle(clipboardData, rawHtml, plainText) {
        return window.App.stickerPasteHandler ? window.App.stickerPasteHandler.isClipboardFromTitle(clipboardData, rawHtml, plainText) : false;
    }
    function handleContentPaste(e, note, contentDiv, card) {
        if (window.App.stickerPasteHandler) {
            return window.App.stickerPasteHandler.handleContentPaste(e, note, contentDiv, card);
        }
    }

    window.App.stickerContent = {
        /**
         * Створює блок контенту для стікера та прив'язує необхідні обробники подій
         * @param {Object} note - Об'єкт нотатки
         * @param {HTMLElement} card - Кореневий DOM-елемент картки
         * @param {boolean} isReadOnly - Прапорець тільки для читання
         * @param {HTMLElement|null} titleDiv - Елемент заголовка для зв'язування подій клавіатури та вставки
         * @returns {HTMLElement} - DOM-елемент .sticker-content
         */
        createContent(note, card, isReadOnly, titleDiv = null) {
            const noteManager = window.App.noteManager;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'sticker-content';
            contentDiv.contentEditable = isReadOnly ? 'false' : 'true';
            contentDiv.spellcheck = false;
            contentDiv.autocapitalize = 'sentences';
            contentDiv.autocomplete = 'off';
            contentDiv.dataset.placeholder = isReadOnly ? '' : ((window.App && window.App.i18n) ? window.App.i18n.t('sticker.contentPlaceholder') : 'Напишіть текст нотатки...');

            // Очищаємо контент від старих вбудованих зображень (щоб вони жили ТІЛЬКИ в галереї)
            let initialContent = note.content || '';
            if (initialContent.includes('sticker-image-wrapper')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = initialContent;
                const legacyImgs = tempDiv.querySelectorAll('.sticker-image-wrapper');
                if (legacyImgs.length > 0) {
                    note.images = note.images || [];
                    legacyImgs.forEach(w => {
                        const img = w.querySelector('img');
                        if (img && img.src) {
                            note.images.push({
                                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                                url: img.src,
                                size: w.classList.contains('size-m') ? 'm' : (w.classList.contains('size-l') ? 'l' : 's')
                            });
                        }
                        w.remove();
                    });
                    initialContent = tempDiv.innerHTML;
                    note.content = initialContent;
                    if (noteManager && noteManager.updateNote) {
                        noteManager.updateNote(note.id, { content: initialContent, images: note.images });
                    }
                }
            }

            contentDiv.innerHTML = initialContent;

            function updateContentPlaceholder() {
                if (isReadOnly) return;
                const text = contentDiv.innerText.replace(/\u200B/g, '').trim();
                const hasImg = contentDiv.querySelector('img');
                if (!text && !hasImg) {
                    contentDiv.setAttribute('data-empty', 'true');
                } else {
                    contentDiv.removeAttribute('data-empty');
                }
            }

            updateContentPlaceholder();

            if (!isReadOnly) {
                contentDiv.addEventListener('input', () => {
                    const text = contentDiv.innerText.replace(/\u200B/g, '').trim();
                    if (!text) {
                        contentDiv.innerHTML = '';
                        contentDiv.setAttribute('data-empty', 'true');
                        if (noteManager && noteManager.updateNote) {
                            noteManager.updateNote(note.id, { content: '' });
                        }
                    } else {
                        // Якщо весь текст видалено, але браузер зберіг порожні теги <mark></mark> чи <span></span>
                        if (contentDiv.textContent.trim() === '') {
                            contentDiv.innerHTML = '';
                            contentDiv.setAttribute('data-empty', 'true');
                            if (noteManager && noteManager.updateNote) {
                                noteManager.updateNote(note.id, { content: '' });
                            }
                        } else {
                            contentDiv.removeAttribute('data-empty');
                            if (noteManager && noteManager.updateNote) {
                                noteManager.updateNote(note.id, { content: contentDiv.innerHTML });
                            }
                        }
                    }
                });

                contentDiv.addEventListener('focus', updateContentPlaceholder);
                contentDiv.addEventListener('blur', () => {
                    const text = contentDiv.innerText.replace(/\u200B/g, '').trim();
                    if (!text) {
                        contentDiv.innerHTML = '';
                    }
                    updateContentPlaceholder();
                    if (window.App.storage && window.App.storage.flushNotes) {
                        window.App.storage.flushNotes();
                    }
                });

                // Перед введенням нового символу (beforeinput):
                // 1. Якщо нотатка візуально порожня — гарантуємо чистий корінь без залишкових тегів
                // 2. Автоматично робимо першу літеру після крапки (. ), оклику (! ), питання (? ) чи нового рядка великою
                contentDiv.addEventListener('beforeinput', (e) => {
                    const cleanText = contentDiv.innerText.replace(/\u200B/g, '').trim();
                    const hasImg = contentDiv.querySelector('img');

                    // Якщо текст порожній, або користувач виділив весь текст перед заміною
                    const selection = window.getSelection();
                    const isAllSelected = selection && !selection.isCollapsed && selection.toString().trim() === cleanText;

                    if ((!cleanText && !hasImg) || isAllSelected) {
                        // Якщо є залишкові теги mark, span, b
                        if (contentDiv.querySelector('mark, span, b, strong, font')) {
                            contentDiv.innerHTML = '';
                            contentDiv.removeAttribute('data-empty');
                        }
                    }

                    // Авто-капіталізація після крапки / знаків кінця речення
                    if (isAutoCapitalizing) return;
                    if (e.inputType === 'insertText' && e.data && e.data.length === 1) {
                        const char = e.data;
                        if (/\p{L}/u.test(char)) {
                            const upper = char.toLocaleUpperCase();
                            if (upper !== char) {
                                const sel = window.getSelection();
                                if (sel && sel.isCollapsed && sel.rangeCount > 0) {
                                    const range = sel.getRangeAt(0);
                                    if (contentDiv.contains(range.startContainer)) {
                                        // Якщо користувач щойно видалив велику літеру Backspace-ом і знову вводить маленьку — залишаємо маленьку
                                        if (lastAutoCapitalized &&
                                            lastAutoCapitalized.char === char &&
                                            lastAutoCapitalized.contentDiv === contentDiv &&
                                            lastAutoCapitalized.userDeleted &&
                                            Date.now() - lastAutoCapitalized.time < 4000) {
                                            lastAutoCapitalized = null;
                                            return;
                                        }

                                        try {
                                            const preRange = document.createRange();
                                            preRange.setStart(contentDiv, 0);
                                            preRange.setEnd(range.startContainer, range.startOffset);
                                            const textBefore = preRange.toString();

                                            const isAutoCapEnabled = !window.App?.settingsModal || window.App.settingsModal.isAutoCapitalizeEnabled();
                                            if (isAutoCapEnabled && SENTENCE_START_REGEX.test(textBefore)) {
                                                if (e.cancelable) {
                                                    e.preventDefault();
                                                    isAutoCapitalizing = true;
                                                    lastAutoCapitalized = { char, upper, contentDiv, time: Date.now(), userDeleted: false };
                                                    try {
                                                        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
                                                            document.execCommand('insertText', false, upper);
                                                        } else {
                                                            insertTextAtCaret(upper, contentDiv, note);
                                                        }
                                                    } finally {
                                                        isAutoCapitalizing = false;
                                                    }
                                                }
                                            }
                                        } catch (err) {
                                            console.warn('[stickerContent] Помилка авто-капіталізації:', err);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                // Перехоплення вставки (Paste Ctrl+V): обробка зображень та вставки тексту зі збереженням маркерів і жирного накреслення
                const handlePaste = async (e) => {
                    if (titleDiv && (e.currentTarget === titleDiv || titleDiv.contains(e.target))) {
                        // Для заголовка перевіряємо тільки зображення, форматування обробляється у stickerHeader.js
                        const clipboardData = e.clipboardData || window.clipboardData;
                        if (!clipboardData) return;
                        const items = Array.from(clipboardData.items || []);
                        const imageFiles = [];
                        for (const item of items) {
                            if (item.type && item.type.indexOf('image') !== -1) {
                                const file = item.getAsFile();
                                if (file) imageFiles.push(file);
                            }
                        }
                        if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                            for (const file of clipboardData.files) {
                                if (file.type && file.type.startsWith('image/')) {
                                    imageFiles.push(file);
                                }
                            }
                        }
                        if (imageFiles.length > 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.App.stickerMenu && window.App.stickerMenu.attachImagesToNote) {
                                await window.App.stickerMenu.attachImagesToNote(note.id, imageFiles, card);
                            }
                        }
                        return;
                    }

                    const clipboardData = e.clipboardData || window.clipboardData;
                    if (!clipboardData) return;

                    const items = Array.from(clipboardData.items || []);
                    const imageFiles = [];

                    for (const item of items) {
                        if (item.type && item.type.indexOf('image') !== -1) {
                            const file = item.getAsFile();
                            if (file) imageFiles.push(file);
                        }
                    }

                    // Якщо файлів напряму в items не було, перевіримо clipboardData.files
                    if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                        for (const file of clipboardData.files) {
                            if (file.type && file.type.startsWith('image/')) {
                                imageFiles.push(file);
                            }
                        }
                    }

                    if (imageFiles.length > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.App.stickerMenu && window.App.stickerMenu.attachImagesToNote) {
                            await window.App.stickerMenu.attachImagesToNote(note.id, imageFiles, card);
                        }
                        return;
                    }

                    // Обробка вставки тексту та збереження стилів маркерів і жирності
                    const html = clipboardData.getData('text/html');
                    const plainText = clipboardData.getData('text/plain');

                    if (!html && !plainText) return;

                    e.preventDefault();
                    e.stopPropagation();

                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('paste_content');
                    }

                    // Чек джерела: якщо текст скопійовано із заголовка, він не повинен переносити стилі заголовка на звичайний блок тексту
                    const fromTitle = isClipboardFromTitle(clipboardData, html, plainText);
                    if (fromTitle) {
                        if (plainText) {
                            insertTextAtCaret(plainText, contentDiv, note);
                        }
                        return;
                    }

                    if (html) {
                        const cleanHtml = cleanPastedHtml(html);
                        if (cleanHtml) {
                            insertHtmlAtCaret(cleanHtml, contentDiv, note);
                            ensureNoteMarkers(contentDiv);
                            return;
                        }
                    }

                    if (plainText) {
                        insertTextAtCaret(plainText, contentDiv, note);
                    }
                };

                contentDiv.addEventListener('paste', handlePaste);
                if (titleDiv) {
                    titleDiv.addEventListener('paste', handlePaste);
                }

                // При Backspace/Delete якщо нотатка порожня або виділено все — гарантуємо видалення тегів mark
                contentDiv.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        if (e.key === 'Backspace' && lastAutoCapitalized && lastAutoCapitalized.contentDiv === contentDiv && Date.now() - lastAutoCapitalized.time < 4000) {
                            lastAutoCapitalized.userDeleted = true;
                        }
                        setTimeout(() => {
                            const cleanText = contentDiv.innerText.replace(/\u200B/g, '').trim();
                            const hasImg = contentDiv.querySelector('img');
                            if (!cleanText && !hasImg) {
                                contentDiv.innerHTML = '';
                                contentDiv.setAttribute('data-empty', 'true');
                                if (noteManager && noteManager.updateNote) {
                                    noteManager.updateNote(note.id, { content: '' });
                                }
                            }
                        }, 0);
                    }
                });

                // При переході на новий рядок (Enter) в кінці маркера створюємо чистий абзац
                contentDiv.addEventListener('keydown', (e) => {
                    const selection = window.getSelection();
                    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return;

                    const range = selection.getRangeAt(0);
                    let markNode = range.startContainer;
                    if (markNode.nodeType === Node.TEXT_NODE) {
                        markNode = markNode.parentElement;
                    }
                    const markEl = markNode ? markNode.closest('mark.note-marker') : null;

                    if (!markEl || !contentDiv.contains(markEl)) return;

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const br = document.createElement('br');
                        const textNode = document.createTextNode('\u200B');
                        
                        if (markEl.nextSibling) {
                            markEl.parentNode.insertBefore(br, markEl.nextSibling);
                            markEl.parentNode.insertBefore(textNode, br.nextSibling);
                        } else {
                            markEl.parentNode.appendChild(br);
                            markEl.parentNode.appendChild(textNode);
                        }

                        const newRange = document.createRange();
                        newRange.setStartAfter(br);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        contentDiv.dispatchEvent(new Event('input'));
                    }
                });

                if (titleDiv) {
                    titleDiv.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            contentDiv.focus();
                        }
                    });
                }
            }

            return contentDiv;
        }
    };

    // Глобальне відстеження операцій copy та cut для точної детекції джерела виділеного тексту (заголовок vs контент)
})();
