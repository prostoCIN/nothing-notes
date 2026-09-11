// js/workspace/stickerContent.js - Модуль текстового вмісту стікера та обробки форматування/вводу
window.App = window.App || {};

(function() {
    const MARKER_COLOR_MAP = {
        'hl-yellow': { bg: '#fef08a', rgba: 'rgba(254, 240, 138, 0.9)' },
        'hl-green':  { bg: '#bbf7d0', rgba: 'rgba(187, 247, 208, 0.9)' },
        'hl-blue':   { bg: '#bae6fd', rgba: 'rgba(186, 230, 253, 0.9)' },
        'hl-pink':   { bg: '#fbcfe8', rgba: 'rgba(251, 207, 232, 0.9)' },
        'hl-orange': { bg: '#fed7aa', rgba: 'rgba(254, 215, 170, 0.9)' },
        'hl-purple': { bg: '#e9d5ff', rgba: 'rgba(233, 213, 255, 0.9)' }
    };

    const NAMED_COLORS = {
        'yellow': 'hl-yellow',
        'lime': 'hl-green',
        'lightgreen': 'hl-green',
        'green': 'hl-green',
        'cyan': 'hl-blue',
        'lightblue': 'hl-blue',
        'blue': 'hl-blue',
        'pink': 'hl-pink',
        'magenta': 'hl-pink',
        'orange': 'hl-orange',
        'purple': 'hl-purple',
        'violet': 'hl-purple'
    };

    let testColorEl = null;
    function resolveColorToRgb(colorStr) {
        if (!testColorEl && typeof document !== 'undefined') {
            testColorEl = document.createElement('div');
        }
        if (!testColorEl) return '';
        testColorEl.style.backgroundColor = '';
        testColorEl.style.backgroundColor = colorStr;
        return testColorEl.style.backgroundColor;
    }

    function matchColorToMarkerClass(colorStr) {
        if (!colorStr) return null;
        const s = colorStr.trim().toLowerCase();
        if (s === 'transparent' || s === 'inherit' || s === 'initial' || s === 'rgba(0, 0, 0, 0)') {
            return null;
        }

        if (NAMED_COLORS[s]) return NAMED_COLORS[s];

        const resolved = resolveColorToRgb(s);
        if (!resolved || resolved === 'transparent' || resolved === 'rgba(0, 0, 0, 0)') {
            return null;
        }

        const rgbMatch = resolved.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
        if (!rgbMatch) return null;

        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;

        if (a < 0.1) return null;

        // Ігноруємо надто темні кольори (наприклад фони карток/стікерів) або нейтрально білі/сірі фони
        if (r < 60 && g < 60 && b < 60) return null;
        if (r > 245 && g > 245 && b > 245 && (Math.max(r, g, b) - Math.min(r, g, b) < 15)) return null;

        const PALETTE = [
            { class: 'hl-yellow', r: 254, g: 240, b: 138 },
            { class: 'hl-green',  r: 187, g: 247, b: 208 },
            { class: 'hl-blue',   r: 186, g: 230, b: 253 },
            { class: 'hl-pink',   r: 251, g: 207, b: 232 },
            { class: 'hl-orange', r: 254, g: 215, b: 170 },
            { class: 'hl-purple', r: 233, g: 213, b: 255 }
        ];

        let closestClass = 'hl-yellow';
        let minDistance = Infinity;

        for (const p of PALETTE) {
            const dist = (r - p.r) ** 2 + (g - p.g) ** 2 + (b - p.b) ** 2;
            if (dist < minDistance) {
                minDistance = dist;
                closestClass = p.class;
            }
        }

        return closestClass;
    }

    /**
     * Отримує форматований фрагмент HTML виділеного тексту в нотатці зі збереженням предків <mark>, <b>, <span>
     */
    function getFormattedSelectionHtml(range, contentDiv) {
        if (!range || !contentDiv) return '';

        const clonedFrag = range.cloneContents();
        const tempContainer = document.createElement('div');
        tempContainer.appendChild(clonedFrag);

        let ancestor = range.commonAncestorContainer;
        if (ancestor.nodeType === Node.TEXT_NODE) {
            ancestor = ancestor.parentElement;
        }

        const ancestorWrappers = [];
        while (ancestor && ancestor !== contentDiv) {
            const tagName = ancestor.tagName.toLowerCase();

            let markerColor = null;
            if (tagName === 'mark' || ancestor.classList.contains('note-marker')) {
                for (const cls of ancestor.classList) {
                    if (cls.startsWith('hl-')) {
                        markerColor = cls;
                        break;
                    }
                }
                if (!markerColor && ancestor.style && ancestor.style.backgroundColor) {
                    markerColor = matchColorToMarkerClass(ancestor.style.backgroundColor);
                }
                markerColor = markerColor || 'hl-yellow';
            } else if (ancestor.style && ancestor.style.backgroundColor) {
                markerColor = matchColorToMarkerClass(ancestor.style.backgroundColor);
            }

            if (markerColor) {
                ancestorWrappers.push({ type: 'mark', colorClass: markerColor });
            } else if (tagName === 'b' || tagName === 'strong' || ancestor.style.fontWeight === 'bold' || parseInt(ancestor.style.fontWeight, 10) >= 600) {
                ancestorWrappers.push({ type: 'b' });
            } else if (ancestor.style && ancestor.style.fontSize) {
                ancestorWrappers.push({ type: 'fontSize', fontSize: ancestor.style.fontSize });
            } else if (tagName === 'i' || tagName === 'em' || ancestor.style.fontStyle === 'italic') {
                ancestorWrappers.push({ type: 'i' });
            } else if (tagName === 'u' || ancestor.style.textDecoration?.includes('underline')) {
                ancestorWrappers.push({ type: 'u' });
            } else if (tagName === 's' || tagName === 'strike' || ancestor.style.textDecoration?.includes('line-through')) {
                ancestorWrappers.push({ type: 's' });
            }

            ancestor = ancestor.parentElement;
        }

        for (const wrapper of ancestorWrappers) {
            if (wrapper.type === 'b') {
                if (tempContainer.childNodes.length === 1 && 
                    tempContainer.firstChild.nodeType === Node.ELEMENT_NODE && 
                    (tempContainer.firstChild.tagName.toLowerCase() === 'b' || tempContainer.firstChild.tagName.toLowerCase() === 'strong')) {
                    continue;
                }
            }
            if (wrapper.type === 'mark') {
                if (tempContainer.childNodes.length === 1 && 
                    tempContainer.firstChild.nodeType === Node.ELEMENT_NODE && 
                    tempContainer.firstChild.tagName.toLowerCase() === 'mark') {
                    continue;
                }
            }

            let wrapperEl;
            if (wrapper.type === 'mark') {
                wrapperEl = document.createElement('mark');
                wrapperEl.className = `note-marker ${wrapper.colorClass}`;
                const colorInfo = MARKER_COLOR_MAP[wrapper.colorClass] || MARKER_COLOR_MAP['hl-yellow'];
                wrapperEl.style.backgroundColor = colorInfo.bg;
                wrapperEl.style.color = '#111827';
            } else if (wrapper.type === 'b') {
                wrapperEl = document.createElement('b');
                wrapperEl.style.fontWeight = 'bold';
            } else if (wrapper.type === 'fontSize') {
                wrapperEl = document.createElement('span');
                wrapperEl.style.fontSize = wrapper.fontSize;
            } else if (wrapper.type === 'i') {
                wrapperEl = document.createElement('i');
            } else if (wrapper.type === 'u') {
                wrapperEl = document.createElement('u');
            } else if (wrapper.type === 's') {
                wrapperEl = document.createElement('s');
            }

            if (wrapperEl) {
                while (tempContainer.firstChild) {
                    wrapperEl.appendChild(tempContainer.firstChild);
                }
                tempContainer.appendChild(wrapperEl);
            }
        }

        // Забезпечуємо наявність класів та інлайн стилів для всіх внутрішніх <mark> (включно з частково скопійованими)
        const allMarks = tempContainer.querySelectorAll('mark, [class*="hl-"]');
        allMarks.forEach(mark => {
            let colorClass = 'hl-yellow';
            for (const cls of mark.classList) {
                if (cls.startsWith('hl-')) {
                    colorClass = cls;
                    break;
                }
            }
            mark.classList.add('note-marker');
            mark.classList.add(colorClass);
            const colorInfo = MARKER_COLOR_MAP[colorClass] || MARKER_COLOR_MAP['hl-yellow'];
            mark.style.backgroundColor = colorInfo.bg;
            mark.style.color = '#111827';
        });

        const allBolds = tempContainer.querySelectorAll('b, strong');
        allBolds.forEach(b => {
            b.style.fontWeight = 'bold';
        });

        // Видаляємо випадкові початкові/кінцеві <br> або \n якщо виділення зачепило край рядка
        while (tempContainer.firstChild) {
            const first = tempContainer.firstChild;
            if (first.nodeType === Node.TEXT_NODE) {
                first.nodeValue = first.nodeValue.replace(/^[\r\n]+/, '');
                if (!first.nodeValue) {
                    tempContainer.removeChild(first);
                    continue;
                }
            } else if (first.nodeType === Node.ELEMENT_NODE && first.tagName.toLowerCase() === 'br') {
                tempContainer.removeChild(first);
                continue;
            }
            break;
        }
        while (tempContainer.lastChild) {
            const last = tempContainer.lastChild;
            if (last.nodeType === Node.TEXT_NODE) {
                last.nodeValue = last.nodeValue.replace(/[\r\n]+$/, '');
                if (!last.nodeValue) {
                    tempContainer.removeChild(last);
                    continue;
                }
            } else if (last.nodeType === Node.ELEMENT_NODE && last.tagName.toLowerCase() === 'br') {
                tempContainer.removeChild(last);
                continue;
            }
            break;
        }

        return tempContainer.innerHTML;
    }
    /**
     * Перевіряє чи вузол містить реальний змістовний текст або візуальний елемент
     */
    function isNodeMeaningful(node) {
        if (!node) return false;
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue.replace(/[\r\n\t]/g, '').trim().length > 0;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            if (['script', 'style', 'meta', 'link', 'svg', 'button', 'input', 'iframe', 'canvas', 'noscript'].includes(tag)) {
                return false;
            }
            if (tag === 'br' || tag === 'img') return true;
            if (node.textContent && node.textContent.replace(/[\r\n\t]/g, '').trim().length > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Перевіряє чи є після поточного вузла наступні сестринські вузли з реальним змістом
     */
    function hasSubsequentContent(node) {
        let next = node.nextSibling;
        while (next) {
            if (isNodeMeaningful(next)) return true;
            next = next.nextSibling;
        }
        return false;
    }

    /**
     * Рекурсивна санітизація та нормалізація вставленого вузла у чистий HTML мінімальних нотаток
     */
    function sanitizePastedNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            // Ігноруємо суто технічні порожні проміжки з переносами рядків
            if (!node.nodeValue.replace(/[\r\n\t]/g, '').trim() && (node.nodeValue.includes('\n') || node.nodeValue.includes('\r'))) {
                return null;
            }
            return document.createTextNode(node.nodeValue);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }

        const tagName = node.tagName.toLowerCase();

        // Ігноруємо технічні теги
        if (['script', 'style', 'meta', 'link', 'svg', 'button', 'input', 'iframe', 'canvas', 'noscript'].includes(tagName)) {
            return null;
        }

        if (tagName === 'br') {
            return document.createElement('br');
        }

        let markerClass = null;
        if (tagName === 'mark') {
            for (const cls of node.classList) {
                if (cls.startsWith('hl-')) {
                    markerClass = cls;
                    break;
                }
            }
            if (!markerClass && node.style.backgroundColor) {
                markerClass = matchColorToMarkerClass(node.style.backgroundColor);
            }
            if (!markerClass) markerClass = 'hl-yellow';
        } else if (node.classList.contains('note-marker')) {
            for (const cls of node.classList) {
                if (cls.startsWith('hl-')) {
                    markerClass = cls;
                    break;
                }
            }
            if (!markerClass) markerClass = 'hl-yellow';
        } else if (node.style && node.style.backgroundColor) {
            const matched = matchColorToMarkerClass(node.style.backgroundColor);
            if (matched) markerClass = matched;
        }

        // Визначаємо bold
        const isBold = (tagName === 'b' || tagName === 'strong' || 
                        node.style.fontWeight === 'bold' || 
                        parseInt(node.style.fontWeight, 10) >= 600) && node.style.fontWeight !== 'normal' && node.style.fontWeight !== '400';

        const fontSize = node.style ? node.style.fontSize : null;
        const isItalic = tagName === 'i' || tagName === 'em' || (node.style && node.style.fontStyle === 'italic');
        const isUnderline = tagName === 'u' || (node.style && node.style.textDecoration?.includes('underline'));
        const isStrike = tagName === 's' || tagName === 'strike' || (node.style && node.style.textDecoration?.includes('line-through'));

        const childFrag = document.createDocumentFragment();
        for (let child = node.firstChild; child; child = child.nextSibling) {
            const sanitizedChild = sanitizePastedNode(child);
            if (sanitizedChild) {
                childFrag.appendChild(sanitizedChild);
            }
        }

        const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName);

        let currentWrapper = childFrag;

        if (fontSize) {
            const span = document.createElement('span');
            span.style.fontSize = fontSize;
            span.appendChild(currentWrapper);
            currentWrapper = span;
        }

        if (isItalic) {
            const it = document.createElement('i');
            it.appendChild(currentWrapper);
            currentWrapper = it;
        }

        if (isUnderline) {
            const u = document.createElement('u');
            u.appendChild(currentWrapper);
            currentWrapper = u;
        }

        if (isStrike) {
            const s = document.createElement('s');
            s.appendChild(currentWrapper);
            currentWrapper = s;
        }

        if (isBold) {
            const b = document.createElement('b');
            b.style.fontWeight = 'bold';
            b.appendChild(currentWrapper);
            currentWrapper = b;
        }

        if (markerClass) {
            const mark = document.createElement('mark');
            mark.className = `note-marker ${markerClass}`;
            const colorInfo = MARKER_COLOR_MAP[markerClass] || MARKER_COLOR_MAP['hl-yellow'];
            mark.style.backgroundColor = colorInfo.bg;
            mark.style.color = '#111827';
            mark.appendChild(currentWrapper);
            currentWrapper = mark;
        }

        if (isBlock) {
            const blockFrag = document.createDocumentFragment();
            blockFrag.appendChild(currentWrapper);
            // Додаємо розрив рядка тільки якщо після цього блоку є інший змістовний вміст
            if (hasSubsequentContent(node)) {
                blockFrag.appendChild(document.createElement('br'));
            }
            return blockFrag;
        }

        return currentWrapper;
    }

    function normalizeSanitizedHtml(container) {
        // Розгортаємо надлишкові однакові вкладені маркери
        const nestedMarks = container.querySelectorAll('mark mark');
        nestedMarks.forEach(innerMark => {
            const outerMark = innerMark.parentElement.closest('mark');
            if (outerMark && innerMark.className === outerMark.className) {
                const parent = innerMark.parentNode;
                while (innerMark.firstChild) {
                    parent.insertBefore(innerMark.firstChild, innerMark);
                }
                parent.removeChild(innerMark);
            }
        });

        // Розгортаємо надлишкові вкладені b/strong
        const nestedBolds = container.querySelectorAll('b b, strong strong, b strong, strong b');
        nestedBolds.forEach(innerBold => {
            const parent = innerBold.parentNode;
            while (innerBold.firstChild) {
                parent.insertBefore(innerBold.firstChild, innerBold);
            }
            parent.removeChild(innerBold);
        });

        // Видаляємо порожні форматувальні теги без тексту
        const emptyTags = container.querySelectorAll('mark, b, span, i, u, s');
        emptyTags.forEach(el => {
            if (!el.textContent.trim() && !el.querySelector('br, img')) {
                el.remove();
            }
        });

        // Видаляємо початкові переноси рядків, порожні текстові вузли та <br>
        while (container.firstChild) {
            const first = container.firstChild;
            if (first.nodeType === Node.TEXT_NODE) {
                first.nodeValue = first.nodeValue.replace(/^[\r\n]+/, '');
                if (!first.nodeValue) {
                    container.removeChild(first);
                    continue;
                }
            } else if (first.nodeType === Node.ELEMENT_NODE && first.tagName.toLowerCase() === 'br') {
                container.removeChild(first);
                continue;
            }
            break;
        }

        // Видаляємо кінцеві переноси рядків, порожні текстові вузли та <br>
        while (container.lastChild) {
            const last = container.lastChild;
            if (last.nodeType === Node.TEXT_NODE) {
                last.nodeValue = last.nodeValue.replace(/[\r\n]+$/, '');
                if (!last.nodeValue) {
                    container.removeChild(last);
                    continue;
                }
            } else if (last.nodeType === Node.ELEMENT_NODE && last.tagName.toLowerCase() === 'br') {
                container.removeChild(last);
                continue;
            }
            break;
        }
    }

    function cleanPastedHtml(rawHtml) {
        if (!rawHtml || typeof rawHtml !== 'string') return '';

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

            const hasFormatting = body.querySelector('mark, b, strong, i, em, u, s, strike, span[style], font[style], .note-marker, [class*="hl-"], [style*="background"], [style*="font-weight"], [style*="font-size"], [style*="text-decoration"]') !== null ||
                (body.firstElementChild && (
                    body.firstElementChild.style.backgroundColor || 
                    body.firstElementChild.style.fontWeight || 
                    body.firstElementChild.style.fontSize
                ));

            if (!hasFormatting) return '';

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
            contentDiv.autocapitalize = 'off';
            contentDiv.autocomplete = 'off';
            contentDiv.dataset.placeholder = isReadOnly ? '' : 'Напишіть текст нотатки...';

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

                // Перед введенням нового символу (beforeinput): якщо нотатка візуально порожня — гарантуємо чистий корінь без залишкових тегів
                contentDiv.addEventListener('beforeinput', () => {
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
})();
