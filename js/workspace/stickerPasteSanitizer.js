// js/workspace/stickerPasteSanitizer.js - Очищення, нормалізація кольорів та безпечна вставка HTML у стікер
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

    const SENTENCE_START_REGEX = /(?:^[\s\u00A0]*|[\r\n]+[\s\u00A0]*|(?:[.!?…]+|\.\.\.)[\s\u00A0]*(?:[\s\u00A0\r\n]|["'«»“”„(\[—–-])[\s\u00A0]*)$/;
    let isAutoCapitalizing = false;
    let lastAutoCapitalized = null;

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

        const isTitleNode = node.classList?.contains('sticker-title') || 
                            node.classList?.contains('column-title') || 
                            node.classList?.contains('column-title-h2') ||
                            node.getAttribute?.('data-note-source') === 'title' ||
                            node.getAttribute?.('data-source') === 'note-title' ||
                            node.getAttribute?.('data-source') === 'title';

        // Визначаємо bold (якщо це заголовок — жирність не переноситься)
        const isBold = !isTitleNode && (tagName === 'b' || tagName === 'strong' || 
                        node.style.fontWeight === 'bold' || 
                        parseInt(node.style.fontWeight, 10) >= 600) && node.style.fontWeight !== 'normal' && node.style.fontWeight !== '400';

        const childFrag = document.createDocumentFragment();
        for (let child = node.firstChild; child; child = child.nextSibling) {
            const sanitizedChild = sanitizePastedNode(child);
            if (sanitizedChild) {
                childFrag.appendChild(sanitizedChild);
            }
        }

        const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName);

        let currentWrapper = childFrag;

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

        // Видаляємо сторонні форматувальні теги (code, pre, kbd, samp, var, tt, i, em, u, s, strike, font, small, sub, sup, span без класу note-marker), залишаючи їх чистий текст
        const foreignElements = container.querySelectorAll('code, pre, kbd, samp, var, tt, i, em, u, s, strike, font, small, sub, sup, span:not(.note-marker)');
        foreignElements.forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                parent.removeChild(el);
            }
        });

        // Видаляємо будь-які залишки інлайн-стилів на будь-яких елементах, крім коректних маркерів
        const elementsWithStyle = container.querySelectorAll('[style]');
        elementsWithStyle.forEach(el => {
            if (el.tagName.toLowerCase() === 'mark' && el.classList.contains('note-marker')) {
                // Маркери зберігають тільки свій колір фону
                return;
            }
            if (el.style.fontSize) el.style.fontSize = '';
            if (el.style.fontStyle) el.style.fontStyle = '';
            if (el.style.fontFamily) el.style.fontFamily = '';
            if (el.style.color) el.style.color = '';
            if (el.style.letterSpacing) el.style.letterSpacing = '';
            if (el.style.lineHeight) el.style.lineHeight = '';
            if (el.style.fontWeight && el.style.fontWeight !== 'bold' && parseInt(el.style.fontWeight, 10) < 600) {
                el.style.fontWeight = '';
            }
            if (el.getAttribute('style') === '') el.removeAttribute('style');
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

    window.App.stickerPasteSanitizer = {
        normalizeColor,
        getClosestMarkerColor,
        getFormattedSelectionHtml,
        cleanAndFormatPastedHtml
    };
})();
