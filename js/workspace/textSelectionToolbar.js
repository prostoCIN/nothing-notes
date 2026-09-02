// js/workspace/textSelectionToolbar.js - Контекстний тулбар виділеного тексту з маркером <mark> та чистим ресетом
window.App = window.App || {};

(function() {
    let toolbarEl = null;
    let currentRange = null;
    let activeContentDiv = null;
    let savedSelectedText = '';
    let isInteracting = false;

    let isApplyToAll = false; // Режим: тільки виділений фрагмент чи всі такі слова в нотатці
    let activeBrushMarker = null; // Активний колір пензля швидкого маркування

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

            let colorsHtml = MARKER_COLORS.map(c => {
                if (c.className === 'clear') {
                    return `<button class="text-sel-color-btn clear-marker-btn" data-marker="" title="${c.name}">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
                            <path d="M22 21H7"></path>
                            <path d="m5 11 9 9"></path>
                        </svg>
                    </button>`;
                }
                return `<button class="text-sel-color-btn" data-marker="${c.className}" style="background-color: ${c.bg};" title="${c.name}"></button>`;
            }).join('');

            toolbarEl.innerHTML = `
                <!-- 1. Розмір шрифту з 4 фіксованими шкалами -->
                <div class="text-sel-slider-wrap">
                    <span class="text-sel-slider-icon">A</span>
                    <div class="text-sel-slider-track-wrap">
                        <input type="range" class="text-sel-slider" id="text-sel-size-slider" min="0" max="3" step="1" value="1">
                        <div class="text-sel-slider-ticks">
                            <span class="text-sel-tick-line" data-step="0" title="12px"></span>
                            <span class="text-sel-tick-line active" data-step="1" title="16px"></span>
                            <span class="text-sel-tick-line" data-step="2" title="24px"></span>
                            <span class="text-sel-tick-line" data-step="3" title="32px"></span>
                        </div>
                    </div>
                    <span class="text-sel-slider-value" id="text-sel-size-val">16px</span>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 2. Кегель Regular / Bold -->
                <div class="text-sel-weight-wrap">
                    <button class="text-sel-weight-btn active" id="text-sel-weight-regular" title="Звичайний шрифт (Regular)">R</button>
                    <button class="text-sel-weight-btn" id="text-sel-weight-bold" title="Жирний шрифт (Bold)"><b>B</b></button>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 3. Маркери виділення (Тег <mark>) -->
                <div class="text-sel-colors-wrap">
                    <div class="text-sel-colors-list">
                        ${colorsHtml}
                    </div>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 4. Кнопка "Всі однакові слова" з окремою спливаючою підказкою -->
                <div class="text-sel-scope-wrap">
                    <button class="text-sel-scope-btn" id="text-sel-scope-btn">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <span>Всі</span>
                    </button>
                    <div class="text-sel-tooltip">
                        Застосувати обраний колір маркера до <b>всіх однакових слів</b> у цій нотатці
                    </div>
                </div>

                <div class="text-sel-divider"></div>

                <!-- 5. Кнопка повного ресету (скидання всіх стилів до чистого тексту) -->
                <button class="text-sel-btn text-sel-reset-all-btn" id="text-sel-reset-btn" title="Скинути ВСЕ форматування виділеного тексту">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                </button>
            `;

            document.body.appendChild(toolbarEl);

            const slider = toolbarEl.querySelector('#text-sel-size-slider');
            const valLabel = toolbarEl.querySelector('#text-sel-size-val');
            const resetBtn = toolbarEl.querySelector('#text-sel-reset-btn');
            const regularBtn = toolbarEl.querySelector('#text-sel-weight-regular');
            const boldBtn = toolbarEl.querySelector('#text-sel-weight-bold');
            const scopeBtn = toolbarEl.querySelector('#text-sel-scope-btn');

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
            scopeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isApplyToAll = !isApplyToAll;
                scopeBtn.classList.toggle('active', isApplyToAll);
                console.log(`[TextToolbar] Режим "Всі слова": ${isApplyToAll ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}`);
            });

            // Підключення кнопки пензля у верхньому хедері (workspace-top-header)
            const headerBrushBtn = document.getElementById('workspace-brush-btn');
            const colorTriggerBtn = document.getElementById('workspace-brush-color-btn');
            const colorDropdown = document.getElementById('workspace-brush-dropdown');
            const colorDot = document.getElementById('workspace-brush-color-dot');

            let currentBrushColorClass = 'hl-green';
            const colorBgMap = {
                'hl-green': '#bbf7d0',
                'hl-yellow': '#fef08a',
                'hl-blue': '#bae6fd',
                'hl-pink': '#fbcfe8',
                'hl-orange': '#fed7aa',
                'hl-purple': '#e9d5ff'
            };

            if (headerBrushBtn) {
                headerBrushBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (colorDropdown) colorDropdown.classList.remove('active');
                    if (activeBrushMarker) {
                        this.disableBrushMode();
                    } else {
                        this.enableBrushMode(currentBrushColorClass);
                    }
                });
            }

            if (colorTriggerBtn && colorDropdown) {
                colorTriggerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    colorDropdown.classList.toggle('active');
                });

                colorDropdown.querySelectorAll('.brush-palette-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const colorClass = item.dataset.color;
                        currentBrushColorClass = colorClass;

                        // Оновлюємо активний стан елементів палітри
                        colorDropdown.querySelectorAll('.brush-palette-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');

                        // Оновлюємо колір крапки
                        if (colorDot) {
                            colorDot.style.backgroundColor = colorBgMap[colorClass] || '#bbf7d0';
                        }

                        // Якщо режим пензля вже увімкнений — оновлюємо його колір
                        if (activeBrushMarker) {
                            activeBrushMarker = colorClass;
                        } else {
                            this.enableBrushMode(colorClass);
                        }

                        colorDropdown.classList.remove('active');
                    });
                });

                document.addEventListener('pointerdown', (e) => {
                    if (!colorDropdown.contains(e.target) && !colorTriggerBtn.contains(e.target)) {
                        colorDropdown.classList.remove('active');
                    }
                });
            }

            const FONT_SIZES = [12, 16, 24, 32];
            const ticks = toolbarEl.querySelectorAll('.text-sel-tick-line');

            const updateTicks = (idx) => {
                ticks.forEach((tick, i) => {
                    tick.classList.toggle('active', i === idx);
                });
            };

            const getTargetWord = () => {
                let text = savedSelectedText;
                if (!text && currentRange) {
                    text = currentRange.toString().trim();
                }
                if (!text) {
                    const sel = window.getSelection();
                    if (sel && !sel.isCollapsed) {
                        text = sel.toString().trim();
                    }
                }
                return text || '';
            };

            // Повзунок розміру шрифту з фіксованими кроками
            slider.addEventListener('input', (e) => {
                const stepIdx = Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0));
                const newSize = FONT_SIZES[stepIdx];
                if (valLabel) valLabel.textContent = `${newSize}px`;
                updateTicks(stepIdx);
                if (!activeContentDiv) return;

                const textTarget = getTargetWord();
                console.log('[TextToolbar] Slider input:', { isApplyToAll, textTarget, newSize, activeContentDiv });

                if (isApplyToAll && textTarget) {
                    this.applyFontSizeToAllOccurrences(textTarget, `${newSize}px`);
                    return;
                }

                if (currentRange) {
                    this.applyFontSizeToRange(currentRange, `${newSize}px`);
                    this.syncChanges();
                }
            });

            // Клік по засічках під слайдером
            ticks.forEach((tick) => {
                tick.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const stepIdx = parseInt(tick.dataset.step, 10);
                    slider.value = stepIdx;
                    const newSize = FONT_SIZES[stepIdx];
                    if (valLabel) valLabel.textContent = `${newSize}px`;
                    updateTicks(stepIdx);
                    if (!activeContentDiv) return;

                    const textTarget = getTargetWord();
                    console.log('[TextToolbar] Tick click:', { isApplyToAll, textTarget, newSize });

                    if (isApplyToAll && textTarget) {
                        this.applyFontSizeToAllOccurrences(textTarget, `${newSize}px`);
                        return;
                    }

                    if (currentRange) {
                        this.applyFontSizeToRange(currentRange, `${newSize}px`);
                        this.syncChanges();
                    }
                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('change_font_size');
                    }
                });
            });

            slider.addEventListener('change', () => {
                if (window.App.historyManager) {
                    window.App.historyManager.recordState('change_font_size');
                }
            });

            // Regular / Bold
            regularBtn.addEventListener('click', (e) => {
                e.stopPropagation();
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

            boldBtn.addEventListener('click', (e) => {
                e.stopPropagation();
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
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
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
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const textTarget = getTargetWord();
                console.log('[TextToolbar] Reset click:', { isApplyToAll, textTarget });

                if (isApplyToAll && textTarget && activeContentDiv) {
                    this.resetAllFormattingFromAllOccurrences(textTarget);
                    if (valLabel) valLabel.textContent = '16px';
                    if (slider) slider.value = 1;
                    updateTicks(1);
                    regularBtn.classList.add('active');
                    boldBtn.classList.remove('active');
                    return;
                }
                this.executeAction((range) => this.resetAllFormattingFromRange(range));
                if (valLabel) valLabel.textContent = '16px';
                if (slider) slider.value = 1; // Індекс 1 відповідає 16px
                updateTicks(1);
                regularBtn.classList.add('active');
                boldBtn.classList.remove('active');
            });

            window.addEventListener('pointerup', () => {
                setTimeout(() => {
                    isInteracting = false;
                }, 100);
            });
        },

        enableBrushMode(markerClass = 'hl-green') {
            // Автоматично вимикаємо режим гумки, якщо він був активний
            if (document.body.classList.contains('global-eraser-active')) {
                document.body.classList.remove('global-eraser-active');
                const eraserBtn = document.getElementById('workspace-eraser-btn');
                if (eraserBtn) eraserBtn.classList.remove('active');
            }

            activeBrushMarker = markerClass;
            document.body.classList.add('highlighter-brush-active');
            const brushBtn = document.getElementById('workspace-brush-btn');
            if (brushBtn) brushBtn.classList.add('active');
        },

        disableBrushMode() {
            activeBrushMarker = null;
            document.body.classList.remove('highlighter-brush-active');
            const brushBtn = document.getElementById('workspace-brush-btn');
            if (brushBtn) brushBtn.classList.remove('active');
        },

        bindEvents() {
            document.addEventListener('selectionchange', () => {
                if (isInteracting || activeBrushMarker || document.body.classList.contains('global-eraser-active')) return;
                this.checkSelection();
            });

            window.addEventListener('scroll', () => {
                if (!isInteracting) this.hide();
            }, true);

            // Клік у режимі пензля: швидке фарбування виділеного слова або репліки
            document.addEventListener('mouseup', (e) => {
                if (!activeBrushMarker) return;
                const contentDiv = e.target.closest('.sticker-content');
                if (!contentDiv) return;

                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                    activeContentDiv = contentDiv;
                    const range = selection.getRangeAt(0);
                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('brush_highlight');
                    }
                    this.applyMarkerToRange(range, activeBrushMarker);
                    this.syncChanges();
                    selection.removeAllRanges();
                }
            });

            document.addEventListener('pointerdown', (e) => {
                if (toolbarEl && !toolbarEl.contains(e.target) && !e.target.closest('.sticker-content')) {
                    this.hide();
                }
            });

            // Швидка глобальна гумка (Eraser mode)
            const eraserBtn = document.getElementById('workspace-eraser-btn');

            const toggleEraserMode = (enable) => {
                const isCurrentlyActive = document.body.classList.contains('global-eraser-active');
                const shouldBeActive = (typeof enable === 'boolean') ? enable : !isCurrentlyActive;

                document.body.classList.toggle('global-eraser-active', shouldBeActive);
                if (eraserBtn) eraserBtn.classList.toggle('active', shouldBeActive);

                if (shouldBeActive) {
                    this.disableBrushMode();
                }
            };

            if (eraserBtn) {
                eraserBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleEraserMode();
                });
            }

            // Робота гумки суворо по виділенню (1-в-1 як пензлик): виділили текст мишею -> маркер змивається
            document.addEventListener('mouseup', (e) => {
                if (!document.body.classList.contains('global-eraser-active')) return;
                const contentDiv = e.target.closest('.sticker-content');
                if (!contentDiv) return;

                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                    activeContentDiv = contentDiv;
                    const range = selection.getRangeAt(0);
                    if (window.App.historyManager) {
                        window.App.historyManager.recordState('eraser_selection');
                    }
                    this.clearMarkerFromRange(range);
                    this.syncChanges();
                    selection.removeAllRanges();
                }
            });

            // Дзен / Фокус Режим
            const zenBtn = document.getElementById('workspace-zen-btn');
            if (zenBtn) {
                zenBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.body.classList.toggle('zen-mode-active');
                });
            }

            // Згорнути всі ланцюжки піднотаток (залишаючи лише базову головну колонку)
            const collapseBtn = document.getElementById('workspace-collapse-btn');
            if (collapseBtn) {
                collapseBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const state = window.App.state;
                    if (state && state.activeChain && state.activeChain.length > 1) {
                        state.activeChain = [null];
                        if (window.App.workspaceView) {
                            window.App.workspaceView.render();
                        }
                    }
                });
            }

            // Глобальний пошук та підсвічування на дошці (Ctrl + F)
            const searchBtn = document.getElementById('workspace-search-btn');
            const searchBar = document.getElementById('workspace-search-bar');
            const searchInput = document.getElementById('workspace-search-input');
            const searchCount = document.getElementById('workspace-search-count');
            const searchClose = document.getElementById('workspace-search-close');

            // Пошук по слову з перемиканням між збігами (PDF Style) та авто-розгортанням колонок піднотаток
            const searchNav = document.getElementById('workspace-search-nav');
            const searchPrevBtn = document.getElementById('workspace-search-prev');
            const searchNextBtn = document.getElementById('workspace-search-next');

            let searchMatches = []; // Масив об'єктів { noteId, isVisible } або DOM mark елементів
            let currentMatchIndex = -1;

            const clearSearchHighlights = () => {
                document.querySelectorAll('mark.workspace-search-highlight').forEach(mark => {
                    const parent = mark.parentNode;
                    if (parent) {
                        while (mark.firstChild) {
                            parent.insertBefore(mark.firstChild, mark);
                        }
                        parent.removeChild(mark);
                    }
                });
                document.querySelectorAll('.sticker-content, .sticker-title').forEach(el => el.normalize());
                searchMatches = [];
                currentMatchIndex = -1;
                if (searchCount) searchCount.style.display = 'none';
                if (searchNav) searchNav.style.display = 'none';
            };

            const highlightCurrentMatch = (index) => {
                if (searchMatches.length === 0 || index < 0 || index >= searchMatches.length) return;

                // Знімаємо клас active з усіх підсвічувань
                document.querySelectorAll('mark.workspace-search-highlight.current-search-match').forEach(m => {
                    m.classList.remove('current-search-match');
                });

                const targetMatch = searchMatches[index];
                currentMatchIndex = index;

                if (searchCount) {
                    searchCount.textContent = `${index + 1}/${searchMatches.length}`;
                    searchCount.style.display = 'inline-block';
                }

                // Перевіряємо чи картка цієї нотатки зараз присутня у відкритих колонках DOM
                let card = document.querySelector(`.note-sticker[data-note-id="${targetMatch.noteId}"]`);

                const focusAndScrollToMatch = (targetCard) => {
                    if (!targetCard) return;
                    // Знаходимо всі марковані елементи всередині цієї картки (і в title, і в content)
                    const cardMarks = Array.from(targetCard.querySelectorAll('mark.workspace-search-highlight'));
                    const matchEl = cardMarks[targetMatch.matchIndexInNote] || cardMarks[0] || targetCard;

                    if (matchEl && matchEl.classList) {
                        matchEl.classList.add('current-search-match');
                        matchEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    } else {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    }
                };

                if (!card) {
                    // Нотатка схована в закритій піднотатці — відкриваємо ланцюжок колонок через scrollToNote
                    if (window.App.workspaceView && window.App.workspaceView.scrollToNote) {
                        window.App.workspaceView.scrollToNote(targetMatch.noteId);
                        // Після рендерингу колонок знову накладаємо підсвічування тексту
                        setTimeout(() => {
                            applyHighlightsToDOM(searchInput.value.trim().toLowerCase());
                            const newCard = document.querySelector(`.note-sticker[data-note-id="${targetMatch.noteId}"]`);
                            focusAndScrollToMatch(newCard);
                        }, 120);
                    }
                } else {
                    focusAndScrollToMatch(card);
                }
            };

            const applyHighlightsToDOM = (target) => {
                if (!target || target.length < 1) return;
                // Підсвічуємо і в заголовках .sticker-title, і в основному тексті .sticker-content
                document.querySelectorAll('.sticker-title, .sticker-content').forEach(textContainer => {
                    const card = textContainer.closest('.note-sticker');
                    if (!card) return;

                    const walker = document.createTreeWalker(textContainer, NodeFilter.SHOW_TEXT, null);
                    const textNodes = [];
                    let curr = walker.nextNode();
                    while (curr) {
                        textNodes.push(curr);
                        curr = walker.nextNode();
                    }

                    textNodes.forEach(node => {
                        const val = node.nodeValue;
                        if (!val) return;
                        const lower = val.toLowerCase();
                        const idx = lower.indexOf(target);
                        if (idx !== -1) {
                            const parent = node.parentNode;
                            if (!parent || parent.classList?.contains('workspace-search-highlight')) return;

                            const parts = [];
                            let lastIdx = 0;
                            let pos = lower.indexOf(target, lastIdx);

                            while (pos !== -1) {
                                parts.push(val.substring(lastIdx, pos));
                                parts.push(val.substring(pos, pos + target.length));
                                lastIdx = pos + target.length;
                                pos = lower.indexOf(target, lastIdx);
                            }
                            parts.push(val.substring(lastIdx));

                            const fragment = document.createDocumentFragment();
                            for (let i = 0; i < parts.length; i++) {
                                if (i % 2 === 1) {
                                    const mark = document.createElement('mark');
                                    mark.className = 'workspace-search-highlight';
                                    mark.textContent = parts[i];
                                    fragment.appendChild(mark);
                                } else if (parts[i]) {
                                    fragment.appendChild(document.createTextNode(parts[i]));
                                }
                            }
                            parent.replaceChild(fragment, node);
                        }
                    });
                });
            };

            const performGlobalSearch = (query) => {
                clearSearchHighlights();
                if (!query || query.trim().length < 1) {
                    return;
                }

                const target = query.trim().toLowerCase();
                const state = window.App.state;

                // 1. Спочатку шукаємо збіги в усіх нотатках активної дошки (включаючи закриті піднотатки)
                const boardNotes = state.notes.filter(n => n.boardId === state.activeBoardId);
                const matchesList = [];

                boardNotes.forEach(note => {
                    let countInThisNote = 0;

                    // 1.1 Пошук у заголовку нотатки
                    if (note.title) {
                        const cleanTitle = note.title.toLowerCase();
                        let pos = cleanTitle.indexOf(target);
                        while (pos !== -1) {
                            matchesList.push({
                                noteId: note.id,
                                matchIndexInNote: countInThisNote
                            });
                            countInThisNote++;
                            pos = cleanTitle.indexOf(target, pos + target.length);
                        }
                    }

                    // 1.2 Пошук у контенті нотатки
                    if (note.content) {
                        const temp = document.createElement('div');
                        temp.innerHTML = note.content || '';
                        const cleanContent = temp.textContent.toLowerCase();
                        let pos = cleanContent.indexOf(target);
                        while (pos !== -1) {
                            matchesList.push({
                                noteId: note.id,
                                matchIndexInNote: countInThisNote
                            });
                            countInThisNote++;
                            pos = cleanContent.indexOf(target, pos + target.length);
                        }
                    }
                });

                searchMatches = matchesList;

                if (searchMatches.length === 0) {
                    if (searchCount) {
                        searchCount.textContent = '0/0';
                        searchCount.style.display = 'inline-block';
                    }
                    if (searchNav) searchNav.style.display = 'none';
                    return;
                }

                // 2. Накладаємо підсвічування на всі видимі картки на екрані
                applyHighlightsToDOM(target);

                // 3. Показуємо кнопки навігації та переходимо до 1-го збігу
                if (searchNav) searchNav.style.display = 'inline-flex';
                highlightCurrentMatch(0);
            };

            const goToNextMatch = () => {
                if (searchMatches.length === 0) return;
                const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
                highlightCurrentMatch(nextIndex);
            };

            const goToPrevMatch = () => {
                if (searchMatches.length === 0) return;
                const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
                highlightCurrentMatch(prevIndex);
            };

            if (searchNextBtn) searchNextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                goToNextMatch();
            });

            const searchWrap = document.getElementById('workspace-search-wrap');

            const openSearch = () => {
                if (searchBar) {
                    searchBar.style.display = 'flex';
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                        if (searchInput.value.trim()) {
                            performGlobalSearch(searchInput.value);
                        }
                    }
                }
            };

            const closeSearch = () => {
                if (searchBar) searchBar.style.display = 'none';
                if (searchInput) searchInput.value = '';
                clearSearchHighlights();
            };

            if (searchBtn) {
                searchBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (searchBar && searchBar.style.display === 'flex') {
                        closeSearch();
                    } else {
                        openSearch();
                    }
                });
            }

            if (searchClose) searchClose.addEventListener('click', (e) => {
                e.stopPropagation();
                closeSearch();
            });

            // Закриття пошуку при кліку в будь-яке інше місце сторінки
            document.addEventListener('pointerdown', (e) => {
                if (searchWrap && !searchWrap.contains(e.target)) {
                    if (searchBar && searchBar.style.display === 'flex') {
                        closeSearch();
                    }
                }
            });

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    performGlobalSearch(e.target.value);
                });
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        closeSearch();
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        goToNextMatch();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        goToPrevMatch();
                    } else if (e.key === 'Escape') {
                        closeSearch();
                    }
                });
            }

            // Глобальне перехоплення Ctrl+F на етапі захоплення (Capture Phase) та надійний вихід з режимів по Esc
            window.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    openSearch();
                } else if (e.key === 'Escape') {
                    // 1. Вимикаємо режим швидкого пензля
                    this.disableBrushMode();
                    // 2. Вимикаємо режим швидкої гумки
                    toggleEraserMode(false);
                    // 3. Закриваємо випадаючу палітру кольорів пензля
                    const brushDropdown = document.getElementById('workspace-brush-dropdown');
                    if (brushDropdown) brushDropdown.classList.remove('active');
                    // 4. Закриваємо тулбар форматування
                    this.hide();
                    // 5. Закриваємо пошук
                    closeSearch();
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
            const contentDiv = (commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentElement)?.closest('.sticker-content');

            if (!contentDiv) {
                this.hide();
                return;
            }

            const text = selection.toString().trim();
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

        show(range) {
            if (!toolbarEl) return;

            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                this.hide();
                return;
            }

            // Точне визначення кеглю та жирності виділених символів
            let currentFontSize = 16;
            if (activeContentDiv) {
                const compContent = window.getComputedStyle(activeContentDiv);
                const parsedContentSize = parseInt(compContent.fontSize, 10);
                if (!isNaN(parsedContentSize) && parsedContentSize > 0) {
                    currentFontSize = parsedContentSize;
                }
            }

            let isBold = false;

            const textNodes = this.getTextNodesInRange(range);
            if (textNodes.length > 0) {
                // Перевіряємо чи всі виділені вузли є жирними
                const boldNodesCount = textNodes.filter(node => {
                    const parent = node.parentElement;
                    if (!parent) return false;
                    const bTag = parent.closest('b, strong');
                    if (bTag && activeContentDiv.contains(bTag)) return true;
                    const comp = window.getComputedStyle(parent);
                    const fw = parseInt(comp.fontWeight, 10);
                    return fw >= 600 || comp.fontWeight === 'bold';
                }).length;

                isBold = (boldNodesCount === textNodes.length && textNodes.length > 0);

                // Визначаємо розмір шрифту: якщо є локальний span зі стилем — беремо його, інакше розмір нотатки
                const firstParent = textNodes[0].parentElement;
                if (firstParent) {
                    const customSpan = firstParent.closest('span[style*="font-size"]');
                    if (customSpan && activeContentDiv.contains(customSpan)) {
                        const parsed = parseInt(customSpan.style.fontSize, 10);
                        if (!isNaN(parsed) && parsed > 0) currentFontSize = parsed;
                    }
                }
            }

            const slider = toolbarEl.querySelector('#text-sel-size-slider');
            const valLabel = toolbarEl.querySelector('#text-sel-size-val');
            const regularBtn = toolbarEl.querySelector('#text-sel-weight-regular');
            const boldBtn = toolbarEl.querySelector('#text-sel-weight-bold');
            const ticks = toolbarEl.querySelectorAll('.text-sel-tick-line');

            const FONT_SIZES = [12, 16, 24, 32];
            // Знаходимо найближчий фіксований крок
            let closestStepIdx = 1; // За замовчуванням 16px
            let minDiff = Infinity;
            FONT_SIZES.forEach((size, idx) => {
                const diff = Math.abs(size - currentFontSize);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestStepIdx = idx;
                }
            });

            if (slider) slider.value = closestStepIdx;
            if (valLabel) valLabel.textContent = `${FONT_SIZES[closestStepIdx]}px`;
            if (ticks) {
                ticks.forEach((tick, i) => tick.classList.toggle('active', i === closestStepIdx));
            }

            if (isBold) {
                boldBtn.classList.add('active');
                regularBtn.classList.remove('active');
            } else {
                regularBtn.classList.add('active');
                boldBtn.classList.remove('active');
            }

            toolbarEl.style.display = 'flex';
            const tbWidth = toolbarEl.offsetWidth || 350;
            const tbHeight = toolbarEl.offsetHeight || 38;

            let top = rect.top - tbHeight - 10;
            let left = rect.left + (rect.width / 2) - (tbWidth / 2);

            if (top < 56) {
                top = rect.bottom + 10;
                toolbarEl.classList.add('open-below');
            } else {
                toolbarEl.classList.remove('open-below');
            }

            left = Math.max(12, Math.min(window.innerWidth - tbWidth - 12, left));

            toolbarEl.style.top = `${top}px`;
            toolbarEl.style.left = `${left}px`;
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

                bTagsToUnwrap.forEach(bTag => {
                    const parent = bTag.parentNode;
                    if (parent) {
                        while (bTag.firstChild) {
                            parent.insertBefore(bTag.firstChild, bTag);
                        }
                        parent.removeChild(bTag);
                    }
                });
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
        }
    };
})();