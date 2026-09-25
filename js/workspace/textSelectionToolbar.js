// js/workspace/textSelectionToolbar.js - Контекстний тулбар виділеного тексту з маркером <mark> та чистим ресетом
window.App = window.App || {};

(function() {
    let toolbarEl = null;
    let currentRange = null;
    let activeContentDiv = null;
    let savedSelectedText = '';
    let isInteracting = false;

    let isApplyToAll = false; // Режим: тільки виділений фрагмент чи всі такі слова в нотатці

    // Палітра маркерів хайлайтера (класи прив'язані до CSS стилів <mark>)
    const MARKER_COLORS = [
        { name: 'Зняти маркер (Гумка)', className: 'clear' },
        { name: 'Жовтий маркер', className: 'hl-yellow', bg: '#fef08a' },
        { name: 'Зелений маркер', className: 'hl-green', bg: '#bbf7d0' },
        { name: 'Блакитний маркер', className: 'hl-blue', bg: '#bae6fd' },
        { name: 'Рожевий маркер', className: 'hl-pink', bg: '#fbcfe8' },
        { name: 'Помаранчевий маркер', className: 'hl-orange', bg: '#fed7aa' },
        { name: 'Фіолетовий маркер', className: 'hl-purple', bg: '#e9d5ff' }
    ];

    window.App.textSelectionToolbar = {
        init() {
            this.createToolbarDOM();
            this.bindEvents();
        },

        createToolbarDOM() {
            if (toolbarEl) return;

            toolbarEl = document.createElement('div');
            toolbarEl.className = 'text-selection-toolbar';

            const getMarkerName = (c) => {
                if (c.className === 'clear') return 'textToolbar.clearMarker';
                const keyMap = {
                    'hl-yellow': 'workspace.brushColors.yellow',
                    'hl-green': 'workspace.brushColors.green',
                    'hl-blue': 'workspace.brushColors.blue',
                    'hl-pink': 'workspace.brushColors.pink',
                    'hl-orange': 'workspace.brushColors.orange',
                    'hl-purple': 'workspace.brushColors.purple'
                };
                return keyMap[c.className] || '';
            };

            let colorsHtml = MARKER_COLORS.map(c => {
                const i18nKey = getMarkerName(c);
                if (c.className === 'clear') {
                    return `<button class="text-sel-color-btn clear-marker-btn" data-marker="" title="${c.name}" data-i18n-title="${i18nKey}">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
                            <path d="M22 21H7"></path>
                            <path d="m5 11 9 9"></path>
                        </svg>
                    </button>`;
                }
                return `<button class="text-sel-color-btn" data-marker="${c.className}" style="background-color: ${c.bg};" title="${c.name}" data-i18n-title="${i18nKey}"></button>`;
            }).join('');

            toolbarEl.innerHTML = `
                <!-- 1. Кегель Regular / Bold -->
                <div class="text-sel-weight-wrap">
                    <button class="text-sel-weight-btn active" id="text-sel-weight-regular" title="Звичайний шрифт (Regular)" data-i18n-title="textToolbar.regular">R</button>
                    <button class="text-sel-weight-btn" id="text-sel-weight-bold" title="Жирний шрифт (Bold)" data-i18n-title="textToolbar.boldTitle"><b>B</b></button>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 2. Маркери виділення (Тег <mark>) -->
                <div class="text-sel-colors-wrap">
                    <div class="text-sel-colors-list">
                        ${colorsHtml}
                    </div>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 3. Кнопка "Всі однакові слова" з окремою спливаючою підказкою -->
                <div class="text-sel-scope-wrap">
                    <button class="text-sel-scope-btn" id="text-sel-scope-btn">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <span data-i18n="common.all">Всі</span>
                    </button>
                    <div class="text-sel-tooltip" data-i18n="textToolbar.allWordsTooltip">
                        Застосувати обраний колір маркера до <b>всіх однакових слів</b> у цій нотатці
                    </div>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 4. Кнопка повного ресету (скидання всіх стилів до чистого тексту) -->
                <button class="text-sel-btn text-sel-reset-all-btn" id="text-sel-reset-btn" title="Скинути ВСЕ форматування виділеного тексту" data-i18n-title="textToolbar.resetAll">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                </button>
            `;

            if (window.App && window.App.i18n && window.App.i18n.updateDOM) {
                window.App.i18n.updateDOM(toolbarEl);
            }

            document.body.appendChild(toolbarEl);

            const resetBtn = toolbarEl.querySelector('#text-sel-reset-btn');
            const regularBtn = toolbarEl.querySelector('#text-sel-weight-regular');
            const boldBtn = toolbarEl.querySelector('#text-sel-weight-bold');
            const scopeBtn = toolbarEl.querySelector('#text-sel-scope-btn');

            // Універсальний біндинг натискань для кнопок тулбара (тач + клік без зняття виділення в Safari)
            const bindButtonAction = (btn, actionFn) => {
                if (!btn) return;
                let handled = false;

                const trigger = (e) => {
                    if (handled) return;
                    handled = true;
                    setTimeout(() => { handled = false; }, 250);
                    actionFn(e);
                };

                btn.addEventListener('pointerdown', (e) => {
                    isInteracting = true;
                    e.preventDefault();
                    e.stopPropagation();
                });

                btn.addEventListener('touchend', (e) => {
                    isInteracting = true;
                    e.preventDefault();
                    e.stopPropagation();
                    trigger(e);
                });

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    trigger(e);
                });
            };

            // Позначаємо взаємодію з тулбаром, щоб сторонні кліки не закривали його
            toolbarEl.addEventListener('pointerdown', (e) => {
                isInteracting = true;
                e.preventDefault(); // Запобігає скиданню виділення тексту в Safari iOS/macOS
                e.stopPropagation();
            });

            toolbarEl.addEventListener('mousedown', (e) => {
                isInteracting = true;
                e.preventDefault();
                e.stopPropagation();
            });

            toolbarEl.addEventListener('touchstart', (e) => {
                isInteracting = true;
                e.stopPropagation();
            }, { passive: true });

            // Перемикач режиму "Всі слова"
            bindButtonAction(scopeBtn, (e) => {
                isApplyToAll = !isApplyToAll;
                scopeBtn.classList.toggle('active', isApplyToAll);
                console.log(`[TextToolbar] Режим "Всі слова": ${isApplyToAll ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}`);
            });

            const getTargetWord = () => {
                let text = savedSelectedText;
                if (!text && currentRange) {
                    text = currentRange.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                }
                if (!text) {
                    const sel = window.getSelection();
                    if (sel && !sel.isCollapsed) {
                        text = sel.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                    }
                }
                return text || '';
            };

            // Regular / Bold
            bindButtonAction(regularBtn, (e) => {
                const textTarget = getTargetWord();
                console.log('[TextToolbar] Regular click:', { isApplyToAll, textTarget });

                if (isApplyToAll && textTarget && activeContentDiv) {
                    this.applyFontWeightToAllOccurrences(textTarget, 'normal');
                    regularBtn.classList.add('active');
                    boldBtn.classList.remove('active');
                    return;
                }
                this.executeAction((range) => this.applyFontWeightToRange(range, 'normal'));
                regularBtn.classList.add('active');
                boldBtn.classList.remove('active');
            });

            bindButtonAction(boldBtn, (e) => {
                const textTarget = getTargetWord();
                console.log('[TextToolbar] Bold click:', { isApplyToAll, textTarget });

                if (isApplyToAll && textTarget && activeContentDiv) {
                    this.applyFontWeightToAllOccurrences(textTarget, 'bold');
                    boldBtn.classList.add('active');
                    regularBtn.classList.remove('active');
                    return;
                }
                this.executeAction((range) => this.applyFontWeightToRange(range, 'bold'));
                boldBtn.classList.add('active');
                regularBtn.classList.remove('active');
            });

            // Клік по кольорах маркера
            toolbarEl.querySelectorAll('.text-sel-color-btn').forEach(btn => {
                bindButtonAction(btn, (e) => {
                    const markerClass = btn.dataset.marker;
                    const textTarget = getTargetWord();
                    console.log('[TextToolbar] Color marker click:', { isApplyToAll, textTarget, markerClass });

                    if (isApplyToAll && textTarget && activeContentDiv) {
                        if (markerClass) {
                            this.applyMarkerToAllOccurrences(textTarget, markerClass);
                        } else {
                            this.clearMarkerFromAllOccurrences(textTarget);
                        }
                        return;
                    }

                    // Звичайне поодиноке форматування
                    if (markerClass) {
                        this.executeAction((range) => this.applyMarkerToRange(range, markerClass));
                    } else {
                        this.executeAction((range) => this.clearMarkerFromRange(range));
                    }
                });
            });

            // Кнопка повного ресету форматування
            bindButtonAction(resetBtn, (e) => {
                const textTarget = getTargetWord();
                console.log('[TextToolbar] Reset click:', { isApplyToAll, textTarget });

                if (isApplyToAll && textTarget && activeContentDiv) {
                    this.resetAllFormattingFromAllOccurrences(textTarget);
                    regularBtn.classList.add('active');
                    boldBtn.classList.remove('active');
                    return;
                }
                this.executeAction((range) => this.resetAllFormattingFromRange(range));
                regularBtn.classList.add('active');
                boldBtn.classList.remove('active');
            });

            const endInteraction = () => {
                setTimeout(() => {
                    isInteracting = false;
                }, 200);
            };

            window.addEventListener('pointerup', endInteraction);
            window.addEventListener('touchend', endInteraction);
        },

        enableBrushMode(markerClass) {
            if (window.App.brushTool) {
                window.App.brushTool.enable(markerClass);
            }
        },

        disableBrushMode() {
            if (window.App.brushTool) {
                window.App.brushTool.disable();
            }
        },

        getActiveContentDiv() {
            return activeContentDiv;
        },

        setActiveContentDiv(div) {
            activeContentDiv = div;
        },

        getRangeRect(range) {
            if (!range) return null;
            try {
                const rect = range.getBoundingClientRect();
                if (rect && (rect.width > 0 || rect.height > 0)) {
                    return rect;
                }
                const rects = range.getClientRects();
                if (rects && rects.length > 0) {
                    for (let i = 0; i < rects.length; i++) {
                        if (rects[i].width > 0 || rects[i].height > 0) {
                            return rects[i];
                        }
                    }
                }
                const startNode = range.startContainer;
                const parent = startNode ? (startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement) : null;
                if (parent) {
                    const parentRect = parent.getBoundingClientRect();
                    if (parentRect && (parentRect.width > 0 || parentRect.height > 0)) {
                        return parentRect;
                    }
                }
            } catch (e) {}
            return null;
        },

        bindEvents() {
            let checkTimer = null;
            const debouncedCheck = (delay = 30) => {
                if (checkTimer) clearTimeout(checkTimer);
                checkTimer = setTimeout(() => {
                    checkTimer = null;
                    const isBrush = window.App.brushTool && window.App.brushTool.isActive();
                    const isEraser = (window.App.eraserTool && window.App.eraserTool.isActive()) || document.body.classList.contains('global-eraser-active');
                    if (isInteracting || isBrush || isEraser) return;
                    this.checkSelection();
                }, delay);
            };

            document.addEventListener('selectionchange', () => {
                const isBrush = window.App.brushTool && window.App.brushTool.isActive();
                const isEraser = (window.App.eraserTool && window.App.eraserTool.isActive()) || document.body.classList.contains('global-eraser-active');
                if (isInteracting || isBrush || isEraser) return;

                // Перевіряємо негайно
                this.checkSelection();
                // Також плануємо повторні перевірки після завершення жесту виділення в WebKit/Safari
                debouncedCheck(50);
                debouncedCheck(150);
            });

            // Відстежуємо події завершення жестів (тач, дабл-тап) на мобільних пристроях
            document.addEventListener('touchend', () => debouncedCheck(60), { passive: true });
            document.addEventListener('pointerup', () => debouncedCheck(40), { passive: true });
            document.addEventListener('mouseup', () => debouncedCheck(40), { passive: true });
            document.addEventListener('dblclick', () => debouncedCheck(20), { passive: true });

            const onScrollOrResize = () => {
                if (isInteracting) return;

                const selection = window.getSelection();
                if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !currentRange) {
                    this.hide();
                    return;
                }

                if (toolbarEl && toolbarEl.classList.contains('active')) {
                    const rect = this.getRangeRect(currentRange);
                    if (!rect) {
                        this.hide();
                        return;
                    }

                    const vpHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                    const vpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;

                    // Якщо виділений текст проскролили далеко за межі екрана — ховаємо
                    if (rect.bottom < vpTop - 40 || rect.top > vpTop + vpHeight + 40) {
                        this.hide();
                        return;
                    }

                    // Оновлюємо координати тулбара, щоб він слідував за текстом при автоскролі Safari
                    this.updatePosition();
                }
            };

            window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
            if (window.visualViewport) {
                window.visualViewport.addEventListener('scroll', onScrollOrResize, { passive: true });
                window.visualViewport.addEventListener('resize', onScrollOrResize, { passive: true });
            }

            document.addEventListener('pointerdown', (e) => {
                if (toolbarEl && !toolbarEl.contains(e.target) && !e.target.closest('.sticker-content')) {
                    this.hide();
                }
            });

            // Закриття тулбара форматування по Escape
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hide();
                }
            }, true);
        },

        isMobileDevice() {
            return window.innerWidth <= 768 || window.matchMedia('(max-width: 768px)').matches;
        },

        checkSelection() {
            if (isInteracting) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                this.hide();
                return;
            }

            const range = selection.getRangeAt(0);
            const commonAncestor = range.commonAncestorContainer;
            const startNode = range.startContainer;
            const startEl = startNode ? (startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement) : null;
            const ancestorEl = commonAncestor ? (commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentElement) : null;
            const contentDiv = ancestorEl?.closest('.sticker-content') || startEl?.closest('.sticker-content');

            if (!contentDiv || contentDiv.contentEditable === 'false' || contentDiv.getAttribute('contenteditable') === 'false') {
                this.hide();
                return;
            }

            const parentCard = contentDiv.closest('.note-sticker');
            if (parentCard && document.getElementById('board-workspace')?.classList.contains('is-board-readonly')) {
                this.hide();
                return;
            }

            const text = selection.toString().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            if (!text) {
                this.hide();
                return;
            }

            activeContentDiv = contentDiv;
            currentRange = range.cloneRange();
            savedSelectedText = text;
            this.show(range);
        },

        // Виконання дії форматування для поточного виділення із записом історії Undo
        executeAction(actionFn) {
            if (!currentRange || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('format_selection');
            }

            actionFn(currentRange);

            this.syncChanges();

            // Відновлюємо візуальне синє виділення в браузері (особливо на телефонах)
            if (currentRange) {
                try {
                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        sel.addRange(currentRange);
                    }
                } catch (e) {}
            }
            // Залишаємо тулбар відкритим для зручного комбінування параметрів (розмір, колір, жирність)
        },

        updatePosition() {
            if (!toolbarEl || !currentRange || !toolbarEl.classList.contains('active')) return;
            const rect = this.getRangeRect(currentRange);
            if (!rect || (rect.width === 0 && rect.height === 0)) return;

            const isMobile = this.isMobileDevice();
            const tbWidth = toolbarEl.offsetWidth || (isMobile ? 80 : 350);
            const tbHeight = toolbarEl.offsetHeight || 38;

            const vpWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
            const vpHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            const vpTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
            const vpLeft = window.visualViewport ? window.visualViewport.offsetLeft : 0;

            let top;
            let left = rect.left + (rect.width / 2) - (tbWidth / 2);

            if (isMobile) {
                // На мобільних пристроях: системне меню iOS (Copy/Share) майже завжди з'являється ЗВЕРХУ виділеного слова.
                // Щоб вони не перекривали один одного, розміщуємо наш компактний тулбар [R | B] ЗНИЗУ слова!
                const spaceBelow = (vpTop + vpHeight) - rect.bottom;
                if (spaceBelow >= tbHeight + 14) {
                    top = rect.bottom + 10;
                    toolbarEl.classList.add('open-below');
                } else if (rect.top - vpTop >= tbHeight + 14) {
                    top = rect.top - tbHeight - 10;
                    toolbarEl.classList.remove('open-below');
                } else {
                    top = Math.max(vpTop + 10, rect.bottom + 10);
                    toolbarEl.classList.add('open-below');
                }
            } else {
                top = rect.top - tbHeight - 10;
                if (top < 56) {
                    top = rect.bottom + 10;
                    toolbarEl.classList.add('open-below');
                } else {
                    toolbarEl.classList.remove('open-below');
                }
            }

            left = Math.max(vpLeft + 10, Math.min(vpLeft + vpWidth - tbWidth - 10, left));

            toolbarEl.style.top = `${top}px`;
            toolbarEl.style.left = `${left}px`;
        },

        show(range) {
            if (!toolbarEl) return;

            const rect = this.getRangeRect(range);
            if (!rect || (rect.width === 0 && rect.height === 0)) {
                // На мобільних WebKit розраховує геометрію асинхронно
                requestAnimationFrame(() => {
                    if (!currentRange) return;
                    const retryRect = this.getRangeRect(currentRange);
                    if (retryRect && (retryRect.width > 0 || retryRect.height > 0)) {
                        this.show(currentRange);
                    }
                });
                return;
            }

            let isBold = false;
            const textNodes = this.getTextNodesInRange(range);
            if (textNodes.length > 0) {
                const boldNodesCount = textNodes.filter(node => {
                    const parent = node.parentElement;
                    if (!parent) return false;
                    const bTag = parent.closest('b, strong');
                    if (bTag && activeContentDiv && activeContentDiv.contains(bTag)) return true;
                    const comp = window.getComputedStyle(parent);
                    const fw = parseInt(comp.fontWeight, 10);
                    return fw >= 600 || comp.fontWeight === 'bold';
                }).length;

                isBold = (boldNodesCount === textNodes.length && textNodes.length > 0);

                const firstParent = textNodes[0].parentElement;
                if (firstParent) {
                    const customSpan = firstParent.closest('span[style*="font-size"]');
                    if (customSpan && activeContentDiv && activeContentDiv.contains(customSpan)) {
                        const parsed = parseInt(customSpan.style.fontSize, 10);
                        if (!isNaN(parsed) && parsed > 0) currentFontSize = parsed;
                    }
                }
            }

            const regularBtn = toolbarEl.querySelector('#text-sel-weight-regular');
            const boldBtn = toolbarEl.querySelector('#text-sel-weight-bold');

            if (regularBtn && boldBtn) {
                if (isBold) {
                    boldBtn.classList.add('active');
                    regularBtn.classList.remove('active');
                } else {
                    regularBtn.classList.add('active');
                    boldBtn.classList.remove('active');
                }
            }

            toolbarEl.style.display = 'flex';
            this.updatePosition();
            toolbarEl.classList.add('active');
        },

        hide() {
            if (!toolbarEl) return;
            toolbarEl.classList.remove('active');
            toolbarEl.style.display = 'none';
            currentRange = null;
            activeContentDiv = null;
        },

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

        // Застосування маркера до ВСІХ однакових слів у цій нотатці
        applyMarkerToAllOccurrences(targetText, markerClass) {
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('highlight_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();

            // 1. Оновлюємо або очищаємо існуючі <mark>, якщо вони містять або збігаються з цим словом
            activeContentDiv.querySelectorAll('mark.note-marker').forEach(mark => {
                const text = mark.textContent.trim();
                if (text.toLowerCase() === targetLower) {
                    mark.className = `note-marker ${markerClass}`;
                } else if (text.toLowerCase().includes(targetLower)) {
                    // Якщо mark містить більше тексту, розгортаємо його
                    const parent = mark.parentNode;
                    if (parent) {
                        while (mark.firstChild) {
                            parent.insertBefore(mark.firstChild, mark);
                        }
                        parent.removeChild(mark);
                    }
                }
            });

            activeContentDiv.normalize();

            // 2. Обходимо всі текстові вузли
            const walker = document.createTreeWalker(activeContentDiv, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let curr = walker.nextNode();
            while (curr) {
                textNodes.push(curr);
                curr = walker.nextNode();
            }

            textNodes.forEach(node => {
                const fullText = node.nodeValue;
                if (!fullText || !fullText.toLowerCase().includes(targetLower)) return;

                // Якщо цей вузол вже всередині <mark> з цим класом — пропускаємо
                const existingMark = node.parentElement && node.parentElement.closest('mark');
                if (existingMark && existingMark.classList.contains(markerClass)) {
                    return;
                }

                const parent = node.parentNode;
                if (!parent) return;

                const regex = new RegExp(`(${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = fullText.split(regex);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.toLowerCase() === targetLower) {
                        const mark = document.createElement('mark');
                        mark.className = `note-marker ${markerClass}`;
                        mark.textContent = part;
                        fragment.appendChild(mark);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, node);
            });

            this.syncChanges();
        },

        // Зняття маркера з усіх однакових слів у нотатці
        clearMarkerFromAllOccurrences(targetText) {
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('clear_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();
            activeContentDiv.querySelectorAll('mark.note-marker').forEach(mark => {
                const text = mark.textContent.trim().toLowerCase();
                if (text === targetLower || text.includes(targetLower)) {
                    const parent = mark.parentNode;
                    if (parent) {
                        while (mark.firstChild) {
                            parent.insertBefore(mark.firstChild, mark);
                        }
                        parent.removeChild(mark);
                    }
                }
            });

            this.syncChanges();
        },

        // Застосування розміру шрифту до ВСІХ однакових слів у нотатці
        applyFontSizeToAllOccurrences(targetText, fontSizeStr) {
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('fontsize_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();

            // Оновлюємо існуючі span
            activeContentDiv.querySelectorAll('span[style*="font-size"]').forEach(sp => {
                const text = sp.textContent.trim().toLowerCase();
                if (text === targetLower) {
                    sp.style.fontSize = fontSizeStr;
                } else if (text.includes(targetLower)) {
                    const parent = sp.parentNode;
                    if (parent) {
                        while (sp.firstChild) {
                            parent.insertBefore(sp.firstChild, sp);
                        }
                        parent.removeChild(sp);
                    }
                }
            });

            activeContentDiv.normalize();

            const walker = document.createTreeWalker(activeContentDiv, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let curr = walker.nextNode();
            while (curr) {
                textNodes.push(curr);
                curr = walker.nextNode();
            }

            textNodes.forEach(node => {
                const fullText = node.nodeValue;
                if (!fullText || !fullText.toLowerCase().includes(targetLower)) return;

                const existingSpan = node.parentElement && node.parentElement.closest('span[style*="font-size"]');
                if (existingSpan && existingSpan.style.fontSize === fontSizeStr) {
                    return;
                }

                const parent = node.parentNode;
                if (!parent) return;

                const regex = new RegExp(`(${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = fullText.split(regex);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.toLowerCase() === targetLower) {
                        const span = document.createElement('span');
                        span.style.fontSize = fontSizeStr;
                        span.textContent = part;
                        fragment.appendChild(span);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, node);
            });

            this.syncChanges();
        },

        // Застосування Regular / Bold до ВСІХ однакових слів у нотатці
        applyFontWeightToAllOccurrences(targetText, weight) {
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('fontweight_all_occurrences');
            }

            const targetLower = targetText.toLowerCase();

            if (weight === 'normal') {
                activeContentDiv.querySelectorAll('b, strong').forEach(bTag => {
                    const text = bTag.textContent.trim().toLowerCase();
                    if (text === targetLower || text.includes(targetLower)) {
                        const parent = bTag.parentNode;
                        if (parent) {
                            while (bTag.firstChild) {
                                parent.insertBefore(bTag.firstChild, bTag);
                            }
                            parent.removeChild(bTag);
                        }
                    }
                });
                this.syncChanges();
                return;
            }

            activeContentDiv.normalize();

            const walker = document.createTreeWalker(activeContentDiv, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let curr = walker.nextNode();
            while (curr) {
                textNodes.push(curr);
                curr = walker.nextNode();
            }

            textNodes.forEach(node => {
                const fullText = node.nodeValue;
                if (!fullText || !fullText.toLowerCase().includes(targetLower)) return;

                if (node.parentElement && node.parentElement.closest('b, strong')) {
                    return;
                }

                const parent = node.parentNode;
                if (!parent) return;

                const regex = new RegExp(`(${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                const parts = fullText.split(regex);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.toLowerCase() === targetLower) {
                        const b = document.createElement('b');
                        b.textContent = part;
                        fragment.appendChild(b);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, node);
            });

            this.syncChanges();
        },

        // Скидання ВСЬОГО форматування для всіх однакових слів у нотатці
        resetAllFormattingFromAllOccurrences(targetText) {
            if (!targetText || !activeContentDiv) return;

            if (window.App.historyManager) {
                window.App.historyManager.recordState('reset_all_occurrences');
            }

            // 1. Знімаємо маркери
            this.clearMarkerFromAllOccurrences(targetText);

            // 2. Знімаємо span, b, strong, font
            const targetLower = targetText.toLowerCase();
            activeContentDiv.querySelectorAll('span, b, strong, i, em, font').forEach(el => {
                const text = el.textContent.trim().toLowerCase();
                if (text === targetLower || text.includes(targetLower)) {
                    const parent = el.parentNode;
                    if (parent) {
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                    }
                }
            });

            this.syncChanges();
        },

        // Автоочищення порожніх тегів та синхронізація
        syncChanges() {
            if (!activeContentDiv) return;

            // Видаляємо будь-які порожні теги без тексту
            activeContentDiv.querySelectorAll('mark, span, b, strong, font').forEach(el => {
                const text = el.innerText || el.textContent || '';
                if (!text.trim() && text === '' && !el.querySelector('img, svg, canvas')) {
                    el.remove();
                }
            });

            activeContentDiv.normalize();

            const card = activeContentDiv.closest('.note-sticker');
            const noteId = card ? card.dataset.noteId : null;

            if (noteId && window.App.noteManager) {
                window.App.noteManager.updateNote(noteId, { content: activeContentDiv.innerHTML });
            }

            if (window.App.cloudSync && typeof window.App.cloudSync.flushPendingNotes === 'function') {
                window.App.cloudSync.flushPendingNotes();
            }
        }
    };
})();