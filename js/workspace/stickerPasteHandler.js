// js/workspace/stickerPasteHandler.js - Обробка подій копіювання, вирізання та вставки тексту/медіа у стікер
window.App = window.App || {};

(function() {
    function getFormattedSelectionHtml(range, contentDiv) {
        return window.App.stickerPasteSanitizer ? window.App.stickerPasteSanitizer.getFormattedSelectionHtml(range, contentDiv) : "";
    }
    function sanitizePastedNode(node) {
        return window.App.stickerPasteSanitizer ? window.App.stickerPasteSanitizer.sanitizePastedNode(node) : null;
    }
    function normalizeSanitizedHtml(container) {
        if (window.App.stickerPasteSanitizer) window.App.stickerPasteSanitizer.normalizeSanitizedHtml(container);
    }

    /**
     * Перевіряє, чи було скопійовано вміст буфера обміну із заголовка нотатки/стовпчика
     * @param {DataTransfer} clipboardData
     * @param {string} rawHtml
     * @param {string} plainText
     * @returns {boolean}
     */
    function isClipboardFromTitle(clipboardData, rawHtml, plainText) {
        // 1. Чек за спеціальним MIME-типом із буфера обміну
        try {
            if (clipboardData && clipboardData.getData && clipboardData.getData('application/x-notes-source') === 'title') {
                return true;
            }
        } catch (e) {}

        // 2. Чек по розмітці HTML (наявність маркерів чи класів заголовка)
        if (rawHtml) {
            if (rawHtml.includes('data-note-source="title"') || 
                rawHtml.includes('data-source="note-title"') ||
                rawHtml.includes('data-source="title"') ||
                rawHtml.includes('sticker-title') || 
                rawHtml.includes('column-title-h2') ||
                rawHtml.includes('column-title')) {
                return true;
            }

            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawHtml, 'text/html');
                if (doc.body && doc.body.querySelector('[data-note-source="title"], [data-source="note-title"], [data-source="title"], .sticker-title, .column-title, .column-title-h2')) {
                    return true;
                }
            } catch (e) {}
        }

        // 3. Чек сесійного трекера останнього копіювання в додатку
        if (window.App && window.App._clipboardMeta && window.App._clipboardMeta.source === 'title') {
            const meta = window.App._clipboardMeta;
            if (meta.text && plainText) {
                const cleanMeta = meta.text.trim();
                const cleanPlain = plainText.trim();
                if (cleanMeta === cleanPlain || cleanMeta.includes(cleanPlain) || cleanPlain.includes(cleanMeta)) {
                    return true;
                }
            } else if (Date.now() - meta.timestamp < 120000) {
                return true;
            }
        }

        return false;
    }

    function cleanPastedHtml(rawHtml) {
        if (!rawHtml || typeof rawHtml !== 'string') return '';

        // Якщо HTML скопійовано із заголовка, повертаємо порожній рядок (стилі заголовка не переносяться)
        if (rawHtml.includes('data-note-source="title"') ||
            rawHtml.includes('data-source="note-title"') ||
            rawHtml.includes('data-source="title"') ||
            rawHtml.includes('sticker-title') ||
            rawHtml.includes('column-title-h2') ||
            rawHtml.includes('column-title')) {
            return '';
        }

        try {
            // Витягуємо тільки змістовний фрагмент між маркерами фрагмента браузера
            const fragMatch = rawHtml.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
            if (fragMatch && fragMatch[1]) {
                rawHtml = fragMatch[1];
            }
            rawHtml = rawHtml.replace(/^[\r\n\t]+|[\r\n\t]+$/g, '');

            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, 'text/html');
            const body = doc.body;
            if (!body) return '';

            if (body.querySelector('[data-note-source="title"], [data-source="note-title"], [data-source="title"], .sticker-title, .column-title, .column-title-h2')) {
                return '';
            }

            // Перевіряємо, чи є в HTML РЕАЛЬНЕ підтримуване нотатками форматування:
            // 1. Маркери (тег mark, клас note-marker, клас hl-* або фоновий колір, що точно відповідає маркеру)
            const hasMarkers = body.querySelector('mark, .note-marker, [class*="hl-"]') !== null ||
                Array.from(body.querySelectorAll('*')).some(el => {
                    const bg = el.style && el.style.backgroundColor;
                    return bg && matchColorToMarkerClass(bg) !== null;
                });

            // 2. Жирний шрифт (тег b, strong, або явний font-weight bold/700/800)
            const hasBold = body.querySelector('b, strong') !== null ||
                Array.from(body.querySelectorAll('*')).some(el => {
                    const fw = el.style && el.style.fontWeight;
                    return fw === 'bold' || parseInt(fw, 10) >= 600;
                });

            // Якщо немає ані маркерів, ані жирного шрифту — не парсимо сторонні span/div теги зі сміттям,
            // а повертаємо порожній рядок, щоб insertTextAtCaret вставив чистий текст!
            if (!hasMarkers && !hasBold) return '';

            const frag = document.createDocumentFragment();
            for (let child = body.firstChild; child; child = child.nextSibling) {
                const sanitized = sanitizePastedNode(child);
                if (sanitized) {
                    frag.appendChild(sanitized);
                }
            }

            const temp = document.createElement('div');
            temp.appendChild(frag);
            normalizeSanitizedHtml(temp);

            return temp.innerHTML;
        } catch (e) {
            console.error('[stickerContent] Помилка очищення вставленого HTML:', e);
            return '';
        }
    }

    function ensureNoteMarkers(contentDiv) {
        let changed = false;

        const marks = contentDiv.querySelectorAll('mark:not(.note-marker), mark:not([class*="hl-"])');
        marks.forEach(mark => {
            if (!mark.classList.contains('note-marker')) {
                mark.classList.add('note-marker');
                changed = true;
            }
            let hasHl = false;
            for (const cls of mark.classList) {
                if (cls.startsWith('hl-')) {
                    hasHl = true;
                    break;
                }
            }
            if (!hasHl) {
                const matched = matchColorToMarkerClass(mark.style.backgroundColor);
                const chosen = matched || 'hl-yellow';
                mark.classList.add(chosen);
                const colorInfo = MARKER_COLOR_MAP[chosen] || MARKER_COLOR_MAP['hl-yellow'];
                mark.style.backgroundColor = colorInfo.bg;
                mark.style.color = '#111827';
                changed = true;
            }
        });

        const styledSpans = contentDiv.querySelectorAll('span[style*="background"], font[style*="background"]');
        styledSpans.forEach(span => {
            const matched = matchColorToMarkerClass(span.style.backgroundColor);
            if (matched) {
                const mark = document.createElement('mark');
                mark.className = `note-marker ${matched}`;
                const colorInfo = MARKER_COLOR_MAP[matched] || MARKER_COLOR_MAP['hl-yellow'];
                mark.style.backgroundColor = colorInfo.bg;
                mark.style.color = '#111827';
                span.style.backgroundColor = '';
                while (span.firstChild) {
                    mark.appendChild(span.firstChild);
                }
                span.parentNode.replaceChild(mark, span);
                changed = true;
            }
        });

        // Очищаємо залишки чужих сторонніх тегів (code, pre, kbd, samp, var, tt, i, em, u, s, strike, font, small, sub, sup, span без класу note-marker)
        const foreignElements = contentDiv.querySelectorAll('code, pre, kbd, samp, var, tt, span:not(.note-marker), font, i, em, u, s, strike, small, sub, sup');
        foreignElements.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                parent.removeChild(el);
                changed = true;
            }
        });

        // Очищаємо залишки чужих інлайн-стилів (розмір шрифту, курсив, шрифт, кольори тощо)
        const styledElements = contentDiv.querySelectorAll('[style]');
        styledElements.forEach(el => {
            if (el.tagName.toLowerCase() === 'mark' && el.classList.contains('note-marker')) {
                // Маркери залишають тільки свій фірмовий стиль
                return;
            }
            if (el.style.fontSize) { el.style.fontSize = ''; changed = true; }
            if (el.style.fontStyle) { el.style.fontStyle = ''; changed = true; }
            if (el.style.fontFamily) { el.style.fontFamily = ''; changed = true; }
            if (el.style.color) { el.style.color = ''; changed = true; }
            if (el.style.letterSpacing) { el.style.letterSpacing = ''; changed = true; }
            if (el.style.lineHeight) { el.style.lineHeight = ''; changed = true; }
            if (el.style.fontWeight && el.style.fontWeight !== 'bold' && parseInt(el.style.fontWeight, 10) < 600) {
                el.style.fontWeight = '';
                changed = true;
            }
            if (el.getAttribute('style') === '') el.removeAttribute('style');
        });

        if (changed) {
            contentDiv.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    /**
     * Вставка HTML безпосередньо в позицію курсору за допомогою Range API
     * (Без document.execCommand, що запобігає створенню зайвих div і скиданню стилів у Chrome)
     */
    function insertHtmlAtCaret(html, contentDiv, note) {
        contentDiv.focus();

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        let range = sel.getRangeAt(0);

        // Якщо контент нотатки візуально порожній, очищаємо його перед вставкою від залишкових <br> чи артефактів
        const existingText = contentDiv.innerText.replace(/\u200B/g, '').trim();
        const hasImg = contentDiv.querySelector('img');
        if (!existingText && !hasImg) {
            contentDiv.innerHTML = '';
            range = document.createRange();
            range.selectNodeContents(contentDiv);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (!contentDiv.contains(range.commonAncestorContainer)) {
            // Переконуємось, що каретка знаходиться саме всередині contentDiv
            range = document.createRange();
            range.selectNodeContents(contentDiv);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        // 1. Видаляємо поточний виділений діапазон, якщо користувач щось виділив перед вставкою
        range.deleteContents();

        // 2. Створюємо елементи з очищеного HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Гарантуємо відсутність початкових/кінцевих переносів рядків та <br> безпосередньо у temp перед вставкою
        while (temp.firstChild) {
            const first = temp.firstChild;
            if (first.nodeType === Node.TEXT_NODE) {
                first.nodeValue = first.nodeValue.replace(/^[\r\n]+/, '');
                if (!first.nodeValue) {
                    temp.removeChild(first);
                    continue;
                }
            } else if (first.nodeType === Node.ELEMENT_NODE && first.tagName.toLowerCase() === 'br') {
                temp.removeChild(first);
                continue;
            }
            break;
        }
        while (temp.lastChild) {
            const last = temp.lastChild;
            if (last.nodeType === Node.TEXT_NODE) {
                last.nodeValue = last.nodeValue.replace(/[\r\n]+$/, '');
                if (!last.nodeValue) {
                    temp.removeChild(last);
                    continue;
                }
            } else if (last.nodeType === Node.ELEMENT_NODE && last.tagName.toLowerCase() === 'br') {
                temp.removeChild(last);
                continue;
            }
            break;
        }

        const frag = document.createDocumentFragment();
        let lastNode = null;
        while (temp.firstChild) {
            lastNode = frag.appendChild(temp.firstChild);
        }

        if (!lastNode) return;

        // 3. Вставляємо DocumentFragment безпосередньо через Range.insertNode
        range.insertNode(frag);

        // 4. Ставимо курсор відразу після останнього вставленого вузла
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        contentDiv.removeAttribute('data-empty');
        contentDiv.dispatchEvent(new Event('input', { bubbles: true }));
        if (window.App.noteManager && window.App.noteManager.updateNote) {
            window.App.noteManager.updateNote(note.id, { content: contentDiv.innerHTML });
        }
    }

    /**
     * Вставка простого тексту безпосередньо в позицію курсору за допомогою Range API
     */
    function insertTextAtCaret(text, contentDiv, note) {
        contentDiv.focus();

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        let range = sel.getRangeAt(0);

        const existingText = contentDiv.innerText.replace(/\u200B/g, '').trim();
        const hasImg = contentDiv.querySelector('img');
        if (!existingText && !hasImg) {
            contentDiv.innerHTML = '';
            range = document.createRange();
            range.selectNodeContents(contentDiv);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (!contentDiv.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(contentDiv);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        range.deleteContents();

        const cleanText = text.replace(/^[\r\n]+|[\r\n]+$/g, '');
        const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.split('\n');
        const frag = document.createDocumentFragment();
        let lastNode = null;

        lines.forEach((line, idx) => {
            if (line.length > 0) {
                lastNode = frag.appendChild(document.createTextNode(line));
            }
            if (idx < lines.length - 1) {
                lastNode = frag.appendChild(document.createElement('br'));
            }
        });

        if (lastNode) {
            range.insertNode(frag);
            const newRange = document.createRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }

        contentDiv.removeAttribute('data-empty');
        contentDiv.dispatchEvent(new Event('input', { bubbles: true }));
        if (window.App.noteManager && window.App.noteManager.updateNote) {
            window.App.noteManager.updateNote(note.id, { content: contentDiv.innerHTML });
        }
    }

    let isGlobalCopyCutBound = false;
    function bindGlobalCopyCutListeners() {
        if (isGlobalCopyCutBound || typeof document === 'undefined') return;
        isGlobalCopyCutBound = true;

        document.addEventListener('copy', (e) => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            const startDiv = (range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement)?.closest('.sticker-content');
            const endDiv = (range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement)?.closest('.sticker-content');

            if (!startDiv || !endDiv || startDiv !== endDiv) {
                return;
            }

            const richHtml = getFormattedSelectionHtml(range, startDiv);
            let plainText = selection.toString();
            if (plainText && !plainText.includes('\n\n')) {
                plainText = plainText.replace(/^[\r\n]+|[\r\n]+$/g, '');
            }

            if (!richHtml && !plainText) return;

            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', plainText);
                if (richHtml) {
                    e.clipboardData.setData('text/html', richHtml);
                }
                e.preventDefault();
            }
        });

        document.addEventListener('cut', (e) => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            const startDiv = (range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement)?.closest('.sticker-content');
            const endDiv = (range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement)?.closest('.sticker-content');

            if (!startDiv || !endDiv || startDiv !== endDiv) {
                return;
            }

            if (startDiv.contentEditable === 'false' || startDiv.getAttribute('contenteditable') === 'false') {
                return;
            }

            const richHtml = getFormattedSelectionHtml(range, startDiv);
            let plainText = selection.toString();
            if (plainText && !plainText.includes('\n\n')) {
                plainText = plainText.replace(/^[\r\n]+|[\r\n]+$/g, '');
            }

            if (!richHtml && !plainText) return;

            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', plainText);
                if (richHtml) {
                    e.clipboardData.setData('text/html', richHtml);
                }
                e.preventDefault();
            }

            if (window.App.historyManager) {
                window.App.historyManager.recordState('cut_text');
            }

            range.deleteContents();
            startDiv.dispatchEvent(new Event('input', { bubbles: true }));

            const parentCard = startDiv.closest('.note-sticker');
            if (parentCard && parentCard.dataset.noteId && window.App.noteManager?.updateNote) {
                window.App.noteManager.updateNote(parentCard.dataset.noteId, { content: startDiv.innerHTML });
            }
        });
    }

    bindGlobalCopyCutListeners();


    async function handlePaste(e, note, contentDiv, card, titleDiv = null) {
        if (titleDiv && (e.currentTarget === titleDiv || titleDiv.contains(e.target))) {
            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;
            const items = Array.from(clipboardData.items || []);
            const imageFiles = [];
            for (const item of items) {
                if (item.type && item.type.indexOf("image") !== -1) {
                    const file = item.getAsFile();
                    if (file) imageFiles.push(file);
                }
            }
            if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                for (const file of clipboardData.files) {
                    if (file.type && file.type.startsWith("image/")) imageFiles.push(file);
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
            if (item.type && item.type.indexOf("image") !== -1) {
                const file = item.getAsFile();
                if (file) imageFiles.push(file);
            }
        }
        if (imageFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
            for (const file of clipboardData.files) {
                if (file.type && file.type.startsWith("image/")) imageFiles.push(file);
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

        const html = clipboardData.getData("text/html");
        const plainText = clipboardData.getData("text/plain");
        if (!html && !plainText) return;

        e.preventDefault();
        e.stopPropagation();
        if (window.App.historyManager) {
            window.App.historyManager.recordState("paste_content");
        }
        const fromTitle = isClipboardFromTitle(clipboardData, html, plainText);
        if (fromTitle) {
            if (plainText) insertTextAtCaret(plainText, contentDiv, note);
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
    }

    if (typeof document !== 'undefined') {
        const trackClipboardSource = (e) => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            const anchorEl = sel.anchorNode?.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode?.parentElement;
            const titleEl = anchorEl?.closest('.sticker-title, .column-title, .column-title-h2, [data-note-title], .sticker-header');

            window.App = window.App || {};
            if (titleEl) {
                const text = sel.toString();
                window.App._clipboardMeta = {
                    source: 'title',
                    text: text,
                    timestamp: Date.now()
                };

                if (e.clipboardData && !e.defaultPrevented) {
                    try {
                        const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        e.clipboardData.setData('text/plain', text);
                        e.clipboardData.setData('application/x-notes-source', 'title');
                        e.clipboardData.setData('text/html', `<span data-note-source="title">${safe}</span>`);
                        e.preventDefault();

                        if (e.type === 'cut') {
                            const range = sel.getRangeAt(0);
                            range.deleteContents();
                            titleEl.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } catch (err) {}
                }
            } else {
                window.App._clipboardMeta = {
                    source: 'content',
                    timestamp: Date.now()
                };
            }
        };

        document.addEventListener('copy', trackClipboardSource);
        document.addEventListener('cut', trackClipboardSource);
    }

    window.App.stickerPasteHandler = {
        isClipboardFromTitle,
        cleanPastedHtml,
        ensureNoteMarkers,
        insertHtmlAtCaret,
        insertTextAtCaret,
        handlePaste,
        bindGlobalCopyCutListeners
    };
})();
