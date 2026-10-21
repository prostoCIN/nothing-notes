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

        // Делегати до textToolbarFormatting
        getTextNodesInRange(range) {
            return window.App.textToolbarFormatting ? window.App.textToolbarFormatting.getTextNodesInRange.call(this, range) : [];
        },
        wrapTextNodesInRange(range, createElementFn) {
            if (window.App.textToolbarFormatting) return window.App.textToolbarFormatting.wrapTextNodesInRange.call(this, range, createElementFn);
        },
        applyMarkerToRange(range, markerClass) {
            if (window.App.textToolbarFormatting) return window.App.textToolbarFormatting.applyMarkerToRange.call(this, range, markerClass);
        },
        clearMarkerFromRange(range) {
            if (window.App.textToolbarFormatting) return window.App.textToolbarFormatting.clearMarkerFromRange.call(this, range);
        },
        applyFontSizeToRange(range, fontSizeStr) {
            if (window.App.textToolbarFormatting) return window.App.textToolbarFormatting.applyFontSizeToRange.call(this, range, fontSizeStr);
        },
        applyFontWeightToRange(range, weight) {
            if (window.App.textToolbarFormatting) return window.App.textToolbarFormatting.applyFontWeightToRange.call(this, range, weight);
        },
        resetAllFormattingFromRange(range) {
            if (window.App.textToolbarFormatting) return window.App.textToolbarFormatting.resetAllFormattingFromRange.call(this, range);
        },

        // Делегати до textToolbarBatch
        applyMarkerToAllOccurrences(targetText, markerClass) {
            if (window.App.textToolbarBatch) return window.App.textToolbarBatch.applyMarkerToAllOccurrences.call(this, targetText, markerClass);
        },
        clearMarkerFromAllOccurrences(targetText) {
            if (window.App.textToolbarBatch) return window.App.textToolbarBatch.clearMarkerFromAllOccurrences.call(this, targetText);
        },
        applyFontSizeToAllOccurrences(targetText, fontSizeStr) {
            if (window.App.textToolbarBatch) return window.App.textToolbarBatch.applyFontSizeToAllOccurrences.call(this, targetText, fontSizeStr);
        },
        applyFontWeightToAllOccurrences(targetText, weight) {
            if (window.App.textToolbarBatch) return window.App.textToolbarBatch.applyFontWeightToAllOccurrences.call(this, targetText, weight);
        },
        resetAllFormattingFromAllOccurrences(targetText) {
            if (window.App.textToolbarBatch) return window.App.textToolbarBatch.resetAllFormattingFromAllOccurrences.call(this, targetText);
        },

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