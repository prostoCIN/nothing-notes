// js/workspace/stickerContent.js - Модуль текстового вмісту стікера та обробки форматування/вводу
window.App = window.App || {};

(function() {
    const SENTENCE_START_REGEX = /(?:^[\s\u00A0]*|[\r\n]+[\s\u00A0]*|(?:[.!?…]+|\.\.\.)[\s\u00A0]*(?:[\s\u00A0\r\n]|["'«»“”„(\[—–-])[\s\u00A0]*)$/;
    let isAutoCapitalizing = false;
    let lastAutoCapitalized = null;

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
            contentDiv.dataset.placeholder = isReadOnly ? '' : ((window.App && window.App.i18n) ? window.App.i18n.t('sticker.contentPlaceholder') : 'Введіть текст, для введення списку наберіть [] або 1. ...');

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

            const sanitizer = window.App.stickerPasteSanitizer;
            const safeContent = (sanitizer && sanitizer.sanitizeNoteHtml) ? sanitizer.sanitizeNoteHtml(initialContent) : initialContent;
            contentDiv.innerHTML = safeContent;

            // Допоміжна функція визначення тексту поточного рядка перед кареткою
            function getLineTextBeforeCaret(div, range) {
                if (!range || !div.contains(range.startContainer)) return null;
                let node = range.startContainer;
                let offset = range.startOffset;

                // Якщо каретка на ELEMENT_NODE, знаходимо відповідний текстовий вузол
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (offset > 0 && node.childNodes[offset - 1]) {
                        node = node.childNodes[offset - 1];
                        while (node && node.nodeType === Node.ELEMENT_NODE && node.lastChild) {
                            node = node.lastChild;
                        }
                        offset = (node && node.nodeType === Node.TEXT_NODE) ? node.nodeValue.length : 0;
                    } else if (node.childNodes[offset]) {
                        node = node.childNodes[offset];
                        while (node && node.nodeType === Node.ELEMENT_NODE && node.firstChild) {
                            node = node.firstChild;
                        }
                        offset = 0;
                    }
                }

                if (!node || !div.contains(node)) return null;

                if (node.nodeType === Node.TEXT_NODE) {
                    const textInNode = node.nodeValue.slice(0, offset);
                    const lastNl = Math.max(textInNode.lastIndexOf('\n'), textInNode.lastIndexOf('\r'));
                    if (lastNl !== -1) {
                        return { text: textInNode.slice(lastNl + 1), node, offset };
                    }
                    const lineParts = [textInNode];
                    let curr = node.previousSibling;
                    while (curr) {
                        if (curr.nodeType === Node.ELEMENT_NODE) {
                            const tag = curr.tagName.toLowerCase();
                            // Будь-який розділювач рядків (br) або блочний елемент (div, p тощо) означає межу рядка
                            if (tag === 'br' || /^(div|p|li|h[1-6]|blockquote|hr)$/.test(tag)) {
                                break;
                            }
                        } else if (curr.nodeType === Node.TEXT_NODE) {
                            const val = curr.nodeValue || '';
                            const prevNl = Math.max(val.lastIndexOf('\n'), val.lastIndexOf('\r'));
                            if (prevNl !== -1) {
                                lineParts.unshift(val.slice(prevNl + 1));
                                break;
                            }
                        }
                        lineParts.unshift(curr.textContent || '');
                        curr = curr.previousSibling;
                    }
                    return { text: lineParts.join(''), node, offset };
                }
                return null;
            }

            function removeNumberPrefixAtCaret(node, prefixText) {
                if (node && node.nodeType === Node.TEXT_NODE) {
                    node.nodeValue = node.nodeValue.replace(/((?:^|[\r\n])[\s\u00A0]*)\d+[\.\)][\s\u00A0]*/, '$1');
                }
            }

            function getContentText() {
                return (contentDiv.innerText || contentDiv.textContent || '').replace(/\u200B/g, '').trim();
            }

            function updateContentPlaceholder() {
                if (isReadOnly) return;
                const text = getContentText();
                const hasImg = contentDiv.querySelector('img');
                const hasCheckbox = contentDiv.querySelector('.todo-checkbox');
                if (!text && !hasImg && !hasCheckbox) {
                    contentDiv.setAttribute('data-empty', 'true');
                } else {
                    contentDiv.removeAttribute('data-empty');
                }
            }

            updateContentPlaceholder();

            if (!isReadOnly) {
                contentDiv.addEventListener('input', () => {
                    const text = getContentText();
                    const hasImg = contentDiv.querySelector('img');
                    const hasCheckbox = contentDiv.querySelector('.todo-checkbox');
                    if (!text && !hasImg && !hasCheckbox) {
                        contentDiv.innerHTML = '';
                        contentDiv.setAttribute('data-empty', 'true');
                        if (noteManager && noteManager.updateNote) {
                            noteManager.updateNote(note.id, { content: '' });
                        }
                    } else {
                        // Якщо весь текст видалено, але браузер зберіг порожні теги <mark></mark> чи <span></span>
                        if (contentDiv.textContent.trim() === '' && !hasImg && !hasCheckbox) {
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
                    const text = getContentText();
                    const hasImg = contentDiv.querySelector('img');
                    const hasCheckbox = contentDiv.querySelector('.todo-checkbox');
                    if (!text && !hasImg && !hasCheckbox) {
                        contentDiv.innerHTML = '';
                        if (noteManager && noteManager.updateNote) {
                            noteManager.updateNote(note.id, { content: '' });
                        }
                    } else {
                        const sanitizer = window.App.stickerPasteSanitizer;
                        if (sanitizer && sanitizer.sanitizeNoteHtml) {
                            const cleaned = sanitizer.sanitizeNoteHtml(contentDiv.innerHTML);
                            if (cleaned !== contentDiv.innerHTML) {
                                contentDiv.innerHTML = cleaned;
                                if (noteManager && noteManager.updateNote) {
                                    noteManager.updateNote(note.id, { content: cleaned });
                                }
                            }
                        }
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
                    const cleanText = getContentText();
                    const hasImg = contentDiv.querySelector('img');
                    const hasCheckbox = contentDiv.querySelector('.todo-checkbox');

                    // Якщо текст порожній, або користувач виділив весь текст перед заміною
                    const selection = window.getSelection();
                    const isAllSelected = selection && !selection.isCollapsed && selection.toString().trim() === cleanText;

                    if ((!cleanText && !hasImg && !hasCheckbox) || isAllSelected) {
                        // Якщо є залишкові теги mark, span, b (крім todo)
                        if (contentDiv.querySelector('mark, span:not(.todo-item):not(.todo-checkbox), b, strong, font')) {
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
                                                        } else if (window.App.stickerPasteHandler && window.App.stickerPasteHandler.insertTextAtCaret) {
                                                            window.App.stickerPasteHandler.insertTextAtCaret(upper, contentDiv, note);
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
                    if (window.App.stickerPasteHandler) {
                        await window.App.stickerPasteHandler.handlePaste(e, note, contentDiv, card, titleDiv);
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
                            const cleanText = getContentText();
                            const hasImg = contentDiv.querySelector('img');
                            const hasCheckbox = contentDiv.querySelector('.todo-checkbox');
                            if (!cleanText && !hasImg && !hasCheckbox) {
                                contentDiv.innerHTML = '';
                                contentDiv.setAttribute('data-empty', 'true');
                                if (noteManager && noteManager.updateNote) {
                                    noteManager.updateNote(note.id, { content: '' });
                                }
                            }
                        }, 0);
                    }
                });

                // Клік по чекбоксу для перемикання статусу (To-Do toggle)
                contentDiv.addEventListener('click', (e) => {
                    const box = e.target.closest('.todo-checkbox');
                    if (!box || !contentDiv.contains(box)) return;
                    if (isReadOnly) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const isChecked = box.getAttribute('data-checked') === 'true';
                    const nextChecked = !isChecked;
                    box.setAttribute('data-checked', nextChecked ? 'true' : 'false');

                    const parentItem = box.closest('.todo-item');
                    if (parentItem) {
                        parentItem.setAttribute('data-checked', nextChecked ? 'true' : 'false');
                    }

                    if (noteManager && noteManager.updateNote) {
                        noteManager.updateNote(note.id, { content: contentDiv.innerHTML });
                    }
                });

                // Автоматичне перетворення [] або [ ] у To-Do чекбокс при введенні пробілу
                contentDiv.addEventListener('keydown', (e) => {
                    if (e.key === ' ') {
                        const selection = window.getSelection();
                        if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return;
                        const range = selection.getRangeAt(0);
                        let node = range.startContainer;
                        let offset = range.startOffset;

                        // Якщо каретка на ELEMENT_NODE, знаходимо відповідний текстовий вузол
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (offset > 0 && node.childNodes[offset - 1]) {
                                node = node.childNodes[offset - 1];
                                while (node && node.nodeType === Node.ELEMENT_NODE && node.lastChild) {
                                    node = node.lastChild;
                                }
                                offset = (node && node.nodeType === Node.TEXT_NODE) ? node.nodeValue.length : 0;
                            } else if (node.childNodes[offset]) {
                                node = node.childNodes[offset];
                                while (node && node.nodeType === Node.ELEMENT_NODE && node.firstChild) {
                                    node = node.firstChild;
                                }
                                offset = 0;
                            }
                        }

                        if (node && node.nodeType === Node.TEXT_NODE && contentDiv.contains(node)) {
                            const textBefore = node.nodeValue.slice(0, offset);
                            const todoMatch = textBefore.match(/(?:^|([\r\n]))(\s*)(?:-\s*)?(?:\[\s*\]|\[\])$/);
                            if (todoMatch) {
                                e.preventDefault();

                                const nl = todoMatch[1] || '';
                                const prefixLen = todoMatch[0].length - nl.length;
                                const newTextBefore = textBefore.slice(0, textBefore.length - prefixLen);
                                const textAfter = node.nodeValue.slice(offset);

                                node.nodeValue = newTextBefore;

                                const todoSpan = document.createElement('span');
                                todoSpan.className = 'todo-item';
                                todoSpan.setAttribute('data-checked', 'false');

                                const checkbox = document.createElement('span');
                                checkbox.className = 'todo-checkbox';
                                checkbox.setAttribute('contenteditable', 'false');
                                checkbox.setAttribute('data-checked', 'false');

                                const spaceText = document.createTextNode('\u00A0');
                                todoSpan.appendChild(checkbox);
                                todoSpan.appendChild(spaceText);

                                if (textAfter) {
                                    const afterNode = document.createTextNode(textAfter);
                                    todoSpan.appendChild(afterNode);
                                }

                                if (!newTextBefore) {
                                    node.parentNode.insertBefore(todoSpan, node);
                                    node.remove();
                                } else {
                                    node.nodeValue = newTextBefore;
                                    if (node.nextSibling) {
                                        node.parentNode.insertBefore(todoSpan, node.nextSibling);
                                    } else {
                                        node.parentNode.appendChild(todoSpan);
                                    }
                                }

                                contentDiv.removeAttribute('data-empty');

                                const newRange = document.createRange();
                                newRange.setStart(spaceText, spaceText.length);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);

                                contentDiv.dispatchEvent(new Event('input'));
                                return;
                            }

                            // Автоматична активація нумерованого списку (1. або 1) -> додаємо відступ для наочності)
                            const numberMatch = textBefore.match(/(?:^|([\r\n]))([\s\u00A0]*)(\d+)([\.\)])$/);
                            if (numberMatch) {
                                e.preventDefault();
                                const nl = numberMatch[1] || '';
                                const existingIndent = numberMatch[2] || '';
                                const num = numberMatch[3];
                                const delim = numberMatch[4];
                                // Якщо відступу ще немає — додаємо 2 нерозривні пробіли для візуального акценту списку
                                const indent = existingIndent ? '' : '\u00A0\u00A0';

                                const prefixLen = numberMatch[0].length - nl.length;
                                const newTextBefore = textBefore.slice(0, textBefore.length - prefixLen);
                                const textAfter = node.nodeValue.slice(offset);

                                const insertedPrefix = newTextBefore + existingIndent + indent + num + delim + '\u00A0';
                                node.nodeValue = insertedPrefix + textAfter;

                                const newRange = document.createRange();
                                newRange.setStart(node, insertedPrefix.length);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);

                                contentDiv.dispatchEvent(new Event('input'));
                                return;
                            }
                        }
                    }
                });

                // Обробка Enter та Backspace для To-Do чекбоксів та автоматичних нумерованих списків
                contentDiv.addEventListener('keydown', (e) => {
                    const selection = window.getSelection();
                    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return;
                    const range = selection.getRangeAt(0);
                    const startNode = range.startContainer;
                    if (!contentDiv.contains(startNode)) return;

                    // 1. Обробка натискання Enter
                    if (e.key === 'Enter') {
                        // Перевіряємо, чи курсор всередині To-Do елемента
                        const todoItem = (startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement)?.closest('.todo-item');
                        if (todoItem && contentDiv.contains(todoItem)) {
                            e.preventDefault();

                            const textContent = todoItem.textContent.replace(/[\u00A0\u200B\s]/g, '');
                            if (!textContent) {
                                // Порожній чекбокс -> вихід зі списку
                                const br = document.createElement('br');
                                todoItem.parentNode.insertBefore(br, todoItem);
                                todoItem.remove();

                                const newRange = document.createRange();
                                newRange.setStartAfter(br);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                                contentDiv.dispatchEvent(new Event('input'));
                                return;
                            } else {
                                // Створення наступного пункту чекбокса
                                const br = document.createElement('br');
                                const newTodo = document.createElement('span');
                                newTodo.className = 'todo-item';
                                newTodo.setAttribute('data-checked', 'false');

                                const newBox = document.createElement('span');
                                newBox.className = 'todo-checkbox';
                                newBox.setAttribute('contenteditable', 'false');
                                newBox.setAttribute('data-checked', 'false');

                                const spaceText = document.createTextNode('\u00A0');
                                newTodo.appendChild(newBox);
                                newTodo.appendChild(spaceText);

                                if (todoItem.nextSibling) {
                                    todoItem.parentNode.insertBefore(br, todoItem.nextSibling);
                                    todoItem.parentNode.insertBefore(newTodo, br.nextSibling);
                                } else {
                                    todoItem.parentNode.appendChild(br);
                                    todoItem.parentNode.appendChild(newTodo);
                                }

                                const newRange = document.createRange();
                                newRange.setStart(spaceText, spaceText.length);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                                contentDiv.dispatchEvent(new Event('input'));
                                return;
                            }
                        }

                        // Перевіряємо, чи поточний рядок є нумерованим списком (1. або 1))
                        const lineInfo = getLineTextBeforeCaret(contentDiv, range);
                        if (lineInfo) {
                            const numMatch = lineInfo.text.match(/(?:^|[\r\n])([\s\u00A0]*)(\d+)([\.\)])[\s\u00A0]*(.*)$/);
                            if (numMatch) {
                                e.preventDefault();
                                const indent = numMatch[1] || '';
                                const num = parseInt(numMatch[2], 10);
                                const delimiter = numMatch[3];
                                const textAfter = numMatch[4] || '';

                                if (!textAfter.trim()) {
                                    // Порожній номер (наприклад користувач на рядку "3. " без тексту) -> вихід зі списку
                                    removeNumberPrefixAtCaret(lineInfo.node, numMatch[0]);
                                    contentDiv.dispatchEvent(new Event('input'));
                                    return;
                                } else {
                                    // Продовжуємо нумерацію: 1. -> 2. -> 3.
                                    const nextNum = num + 1;
                                    const nextPrefix = `${indent}${nextNum}${delimiter}\u00A0`;

                                    const br = document.createElement('br');
                                    const nextTextNode = document.createTextNode(nextPrefix);

                                    range.deleteContents();
                                    range.insertNode(nextTextNode);
                                    range.insertNode(br);

                                    const newRange = document.createRange();
                                    newRange.setStart(nextTextNode, nextTextNode.length);
                                    newRange.collapse(true);
                                    selection.removeAllRanges();
                                    selection.addRange(newRange);
                                    contentDiv.dispatchEvent(new Event('input'));
                                    return;
                                }
                            }
                        }
                    }

                    // 2. Обробка Backspace для швидкого видалення порожніх чекбоксів або префіксів
                    if (e.key === 'Backspace') {
                        const todoItem = (startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement)?.closest('.todo-item');
                        if (todoItem && contentDiv.contains(todoItem)) {
                            const textContent = todoItem.textContent.replace(/[\u00A0\u200B\s]/g, '');
                            if (!textContent && range.startOffset <= 1) {
                                e.preventDefault();
                                todoItem.remove();
                                contentDiv.dispatchEvent(new Event('input'));
                                return;
                            }
                        }

                        const lineInfo = getLineTextBeforeCaret(contentDiv, range);
                        if (lineInfo) {
                            const numMatch = lineInfo.text.match(/(?:^|[\r\n])([\s\u00A0]*)(\d+)([\.\)])\s*$/);
                            if (numMatch) {
                                e.preventDefault();
                                removeNumberPrefixAtCaret(lineInfo.node, numMatch[0]);
                                contentDiv.dispatchEvent(new Event('input'));
                                return;
                            }
                        }
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
