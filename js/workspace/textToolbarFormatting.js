// js/workspace/textToolbarFormatting.js - Низькорівневе форматування фрагментів Range (маркери, шрифти, очищення)
window.App = window.App || {};

(function() {
    window.App.textToolbarFormatting = {
        // Отримання всіх текстових вузлів, які перетинаються з Range
        getTextNodesInRange(range) {
            const textNodes = [];
            if (!range || !activeContentDiv) return textNodes;

            const walker = document.createTreeWalker(
                range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
                    ? range.commonAncestorContainer 
                    : range.commonAncestorContainer.parentNode,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {
                        if (!node.nodeValue || !node.nodeValue.length) return NodeFilter.FILTER_REJECT;
                        if (range.intersectsNode(node)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    }
                }
            );

            let currentNode = walker.nextNode();
            while (currentNode) {
                textNodes.push(currentNode);
                currentNode = walker.nextNode();
            }

            return textNodes;
        },

        // Універсальна утиліта для обгортання виділених текстових вузлів у будь-який HTML-елемент
        wrapTextNodesInRange(range, createElementFn) {
            if (!range || !activeContentDiv) return;

            const textNodes = this.getTextNodesInRange(range);
            if (textNodes.length === 0) return;

            const startContainer = range.startContainer;
            const startOffset = range.startOffset;
            const endContainer = range.endContainer;
            const endOffset = range.endOffset;

            textNodes.forEach(node => {
                let textToWrap = node.nodeValue;
                let beforeText = '';
                let afterText = '';

                if (node === endContainer && endOffset < textToWrap.length) {
                    afterText = textToWrap.substring(endOffset);
                    textToWrap = textToWrap.substring(0, endOffset);
                }

                if (node === startContainer && startOffset > 0) {
                    beforeText = textToWrap.substring(0, startOffset);
                    textToWrap = textToWrap.substring(startOffset);
                }

                if (!textToWrap) return;

                const wrapperEl = createElementFn(textToWrap, node);
                if (!wrapperEl) return;

                const parent = node.parentNode;
                if (parent) {
                    if (beforeText) {
                        parent.insertBefore(document.createTextNode(beforeText), node);
                    }
                    parent.insertBefore(wrapperEl, node);
                    if (afterText) {
                        parent.insertBefore(document.createTextNode(afterText), node);
                    }
                    parent.removeChild(node);

                    // Оновлюємо currentRange на новий елемент, щоб наступні переміщення повзунка продовжували працювати
                    try {
                        const newRange = document.createRange();
                        newRange.selectNodeContents(wrapperEl);
                        currentRange = newRange;
                    } catch (e) {}
                }
            });
        },

        // Застосування маркера через <mark class="..."> для конкретного Range
        applyMarkerToRange(range, markerClass) {
            this.wrapTextNodesInRange(range, (textToWrap, node) => {
                const existingMark = node.parentElement && node.parentElement.closest('mark');
                if (existingMark && existingMark.textContent === textToWrap) {
                    existingMark.className = `note-marker ${markerClass}`;
                    return null;
                }
                const markEl = document.createElement('mark');
                markEl.className = `note-marker ${markerClass}`;
                markEl.textContent = textToWrap;
                return markEl;
            });
        },

        // Зняття маркера (Гумка) для конкретного Range з точним збереженням неторканих шматочків
        clearMarkerFromRange(range) {
            if (!range || !activeContentDiv) return;

            const marks = Array.from(activeContentDiv.querySelectorAll('mark.note-marker'));
            marks.forEach(mark => {
                // Перевіряємо чи діапазон перетинається з цим елементом mark
                if (!range.intersectsNode(mark)) return;

                const markRange = document.createRange();
                markRange.selectNodeContents(mark);

                // 1. Повністю всередині Range: розгортаємо повністю
                if (range.compareBoundaryPoints(Range.START_TO_START, markRange) <= 0 &&
                    range.compareBoundaryPoints(Range.END_TO_END, markRange) >= 0) {
                    const parent = mark.parentNode;
                    if (parent) {
                        while (mark.firstChild) {
                            parent.insertBefore(mark.firstChild, mark);
                        }
                        parent.removeChild(mark);
                    }
                    return;
                }

                // 2. Частковий перетин: розбиваємо <mark> на 3 частини:
                // Part A (до виділення) -> зберігає <mark>
                // Part B (всередині виділення) -> стає звичайним текстом (без <mark>)
                // Part C (після виділення) -> зберігає <mark>
                const markClass = mark.className;
                const parent = mark.parentNode;
                if (!parent) return;

                // Створюємо діапазон для частини Всередині виділення
                const intersectionRange = document.createRange();
                
                // Початок перетину
                if (range.compareBoundaryPoints(Range.START_TO_START, markRange) > 0) {
                    intersectionRange.setStart(range.startContainer, range.startOffset);
                } else {
                    intersectionRange.setStart(markRange.startContainer, markRange.startOffset);
                }

                // Кінець перетину
                if (range.compareBoundaryPoints(Range.END_TO_END, markRange) < 0) {
                    intersectionRange.setEnd(range.endContainer, range.endOffset);
                } else {
                    intersectionRange.setEnd(markRange.endContainer, markRange.endOffset);
                }

                // Текст до перетину
                const preRange = document.createRange();
                preRange.setStart(markRange.startContainer, markRange.startOffset);
                preRange.setEnd(intersectionRange.startContainer, intersectionRange.startOffset);

                // Текст після перетину
                const postRange = document.createRange();
                postRange.setStart(intersectionRange.endContainer, intersectionRange.endOffset);
                postRange.setEnd(markRange.endContainer, markRange.endOffset);

                const preFrag = preRange.cloneContents();
                const interFrag = intersectionRange.cloneContents();
                const postFrag = postRange.cloneContents();

                const fragment = document.createDocumentFragment();

                // Додаємо ліву частину в <mark> (якщо вона не порожня)
                if (preFrag.textContent && preFrag.textContent.length > 0) {
                    const preMark = document.createElement('mark');
                    preMark.className = markClass;
                    preMark.appendChild(preFrag);
                    fragment.appendChild(preMark);
                }

                // Додаємо центральну частину ЯК ЗВИЧАЙНИЙ ТЕКСТ (стертий маркер)
                if (interFrag.textContent && interFrag.textContent.length > 0) {
                    // Витягуємо чистий текст із фрагмента
                    fragment.appendChild(document.createTextNode(interFrag.textContent));
                }

                // Додаємо праву частину в <mark> (якщо вона не порожня)
                if (postFrag.textContent && postFrag.textContent.length > 0) {
                    const postMark = document.createElement('mark');
                    postMark.className = markClass;
                    postMark.appendChild(postFrag);
                    fragment.appendChild(postMark);
                }

                parent.replaceChild(fragment, mark);
            });

            activeContentDiv.normalize();
        },

        // Розмір шрифту для конкретного Range
        applyFontSizeToRange(range, fontSizeStr) {
            this.wrapTextNodesInRange(range, (textToWrap) => {
                const span = document.createElement('span');
                span.style.fontSize = fontSizeStr;
                span.textContent = textToWrap;
                return span;
            });
        },

        // Regular / Bold для конкретного Range
        applyFontWeightToRange(range, weight) {
            if (!range || !activeContentDiv) return;

            if (weight === 'normal') {
                // Знімаємо жирність: розгортаємо <b> та <strong> теги
                const textNodes = this.getTextNodesInRange(range);
                const bTagsToUnwrap = new Set();
                textNodes.forEach(node => {
                    let parent = node.parentElement;
                    while (parent && parent !== activeContentDiv) {
                        if (parent.tagName.toLowerCase() === 'b' || parent.tagName.toLowerCase() === 'strong') {
                            bTagsToUnwrap.add(parent);
                        }
                        parent = parent.parentElement;
                    }
                });

                const unwrappedNodes = [];
                bTagsToUnwrap.forEach(bTag => {
                    const parent = bTag.parentNode;
                    if (parent) {
                        while (bTag.firstChild) {
                            const child = bTag.firstChild;
                            parent.insertBefore(child, bTag);
                            unwrappedNodes.push(child);
                        }
                        parent.removeChild(bTag);
                    }
                });

                // Оновлюємо currentRange на розгорнутий текст, щоб виділення не злітало
                if (unwrappedNodes.length > 0) {
                    try {
                        const first = unwrappedNodes[0];
                        const last = unwrappedNodes[unwrappedNodes.length - 1];
                        const newRange = document.createRange();
                        newRange.setStartBefore(first);
                        newRange.setEndAfter(last);
                        currentRange = newRange;
                    } catch (e) {}
                }
                return;
            }

            // Застосовуємо Bold (<b>)
            this.wrapTextNodesInRange(range, (textToWrap, node) => {
                if (node.parentElement && node.parentElement.closest('b, strong')) {
                    return null;
                }
                const el = document.createElement('b');
                el.textContent = textToWrap;
                return el;
            });
        },

        // ПОВНИЙ РЕСЕТ для конкретного Range з точним збереженням стилів сусіднього тексту
        resetAllFormattingFromRange(range) {
            if (!range || !activeContentDiv) return;

            // 1. Знімаємо маркери (з точним розбиттям <mark>)
            this.clearMarkerFromRange(range);

            // 2. Знімаємо кастомні span розміру шрифту або кольорів із збереженням неторканих шматочків
            const spansAndBolds = Array.from(activeContentDiv.querySelectorAll('span, b, strong, i, em, font'));
            spansAndBolds.forEach(el => {
                if (!range.intersectsNode(el)) return;

                const elRange = document.createRange();
                elRange.selectNodeContents(el);

                // Повністю всередині Range: розгортаємо повністю
                if (range.compareBoundaryPoints(Range.START_TO_START, elRange) <= 0 &&
                    range.compareBoundaryPoints(Range.END_TO_END, elRange) >= 0) {
                    const parent = el.parentNode;
                    if (parent) {
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                    }
                    return;
                }

                // Частковий перетин: розбиваємо на частини (ліва з тегом, центральна чиста, права з тегом)
                const parent = el.parentNode;
                if (!parent) return;

                const intersectionRange = document.createRange();
                if (range.compareBoundaryPoints(Range.START_TO_START, elRange) > 0) {
                    intersectionRange.setStart(range.startContainer, range.startOffset);
                } else {
                    intersectionRange.setStart(elRange.startContainer, elRange.startOffset);
                }

                if (range.compareBoundaryPoints(Range.END_TO_END, elRange) < 0) {
                    intersectionRange.setEnd(range.endContainer, range.endOffset);
                } else {
                    intersectionRange.setEnd(elRange.endContainer, elRange.endOffset);
                }

                const preRange = document.createRange();
                preRange.setStart(elRange.startContainer, elRange.startOffset);
                preRange.setEnd(intersectionRange.startContainer, intersectionRange.startOffset);

                const postRange = document.createRange();
                postRange.setStart(intersectionRange.endContainer, intersectionRange.endOffset);
                postRange.setEnd(elRange.endContainer, elRange.endOffset);

                const preFrag = preRange.cloneContents();
                const interFrag = intersectionRange.cloneContents();
                const postFrag = postRange.cloneContents();

                const fragment = document.createDocumentFragment();

                if (preFrag.textContent && preFrag.textContent.length > 0) {
                    const preEl = el.cloneNode(false);
                    preEl.appendChild(preFrag);
                    fragment.appendChild(preEl);
                }

                if (interFrag.textContent && interFrag.textContent.length > 0) {
                    fragment.appendChild(document.createTextNode(interFrag.textContent));
                }

                if (postFrag.textContent && postFrag.textContent.length > 0) {
                    const postEl = el.cloneNode(false);
                    postEl.appendChild(postFrag);
                    fragment.appendChild(postEl);
                }

                parent.replaceChild(fragment, el);
            });

            activeContentDiv.normalize();
        },
    };
})();
