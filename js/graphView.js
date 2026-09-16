// js/graphView.js - Інтерактивний граф зв'язків нотаток (Obsidian Graph View)
window.App = window.App || {};

(function() {
    let container = null;
    let canvas = null;
    let ctx = null;
    let nodesLayer = null;
    let searchInput = null;

    // Стан симуляції та перегляду
    let nodes = [];
    let edges = [];
    let animationFrameId = null;
    let isRunning = false;

    // Трансформація камери (Pan / Zoom)
    let camera = {
        x: 0,
        y: 0,
        zoom: 1,
        minZoom: 0.2,
        maxZoom: 3.5
    };

    // Взаємодія з мишею / тачем
    let isDraggingCanvas = false;
    let isDraggingNode = false;
    let draggedNode = null;
    let hoveredNode = null;
    let startMousePos = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    let searchQuery = '';

    // Стан нових інтелектуальних фільтрів та попереднього перегляду
    let isOrphansOnly = false;
    let showTagLinks = true;
    let activeTagFilter = null;
    let previewCard = null;
    let previewNode = null;
    let previewTimeout = null;
    let isMouseOverPreview = false;

    // Кеш для фокусованих піддерев (уникнення повторних алокацій у кожному кадрі)
    let lastFocusNodeId = null;
    let cachedSubtreeIds = null;

    // Збережені прив'язки подій для чистого unbind
    let boundPointerMove = null;
    let boundPointerUp = null;
    let boundKeyDown = null;
    let boundResize = null;
    let boundTouchStart = null;
    let boundTouchMove = null;
    let boundTouchEnd = null;

    // Стан сенсорного масштабування двома пальцями (Pinch-to-zoom)
    let isPinching = false;
    let touchStartDist = 0;
    let touchStartZoom = 1;
    let touchStartCenter = { x: 0, y: 0 };
    let touchStartCam = { x: 0, y: 0 };

    // Палітра насичених та виразних кольорів для різних гілок графу
    const BRANCH_COLORS = [
        '#10b981', // Смарагдовий зелений
        '#3b82f6', // Насичений синій
        '#a855f7', // Фіолетовий
        '#ec4899', // Рожевий / Малиновий
        '#f59e0b', // Бурштиновий / Оранжевий
        '#06b6d4', // Бірюзовий / Cyan
        '#84cc16', // Лаймовий
        '#f43f5e', // Коралово-червоний
        '#8b5cf6', // Індиго
        '#14b8a6', // Тіловий (Teal)
        '#eab308'  // Золотистий
    ];

    const TAG_HEX_COLORS = [
        '#3b82f6', // Синій
        '#10b981', // Смарагдовий
        '#f59e0b', // Бурштиновий
        '#ec4899', // Рожевий
        '#8b5cf6', // Фіолетовий
        '#ef4444'  // Червоний
    ];

    function getTagColor(tagText) {
        const idx = window.App.getTagColorIndex ? window.App.getTagColorIndex(tagText) : 0;
        return TAG_HEX_COLORS[idx % TAG_HEX_COLORS.length];
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'щойно';
        if (mins < 60) return `${mins} хв тому`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} год тому`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} дн тому`;
        return new Date(timestamp).toLocaleDateString('uk-UA');
    }

    function getBranchColor(rootId, index) {
        if (typeof index === 'number') {
            return BRANCH_COLORS[index % BRANCH_COLORS.length];
        }
        let hash = 0;
        const str = String(rootId || '');
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIdx = Math.abs(hash) % BRANCH_COLORS.length;
        return BRANCH_COLORS[colorIdx];
    }

    window.App.graphView = {
        init() {},

        render() {
            this.cleanup();

            const els = window.App.getElements();
            if (!els.columnsContainer) return;

            // Ховаємо мобільний індикатор пагінації колонок у режимі Графу
            const pagination = document.getElementById('mobile-columns-pagination');
            if (pagination) {
                pagination.classList.remove('visible');
                pagination.innerHTML = '';
            }

            // Очищаємо робочу область
            els.columnsContainer.innerHTML = '';

            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            this.createGraphDOM(els.columnsContainer, currentBoard);
            this.resizeCanvas();
            this.buildGraphData();
            this.startSimulation();
        },

        createGraphDOM(parentEl, currentBoard) {
            container = document.createElement('div');
            container.className = 'graph-view-wrapper';

            container.innerHTML = `
                <div class="graph-toolbar">
                    <div class="graph-toolbar-left">
                        <div class="graph-title-pill">
                            <span class="graph-title-icon">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="18" cy="5" r="3"></circle>
                                    <circle cx="6" cy="12" r="3"></circle>
                                    <circle cx="18" cy="19" r="3"></circle>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                </svg>
                            </span>
                            <span class="graph-title-text">${currentBoard.name}</span>
                            <span class="graph-nodes-count" id="graph-nodes-counter">0 зв'язків</span>
                        </div>

                        <div class="graph-toolbar-filters">
                            <button class="graph-toolbar-filter-btn is-orphans-btn" id="graph-filter-orphans" title="Показати лише ізольовані нотатки без піднотаток та батьків">
                                <span class="filter-btn-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="3.5" fill="currentColor"></circle>
                                        <circle cx="12" cy="12" r="8" stroke-dasharray="2 3"></circle>
                                    </svg>
                                </span>
                                <span class="filter-btn-label">Острови</span>
                                <span class="filter-btn-badge" id="graph-orphans-counter">0</span>
                            </button>
                            <button class="graph-toolbar-filter-btn is-active" id="graph-toggle-tag-links" title="Увімкнути/вимкнути пунктирні зв'язки між нотатками зі спільними тегами">
                                <span class="filter-btn-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                    </svg>
                                </span>
                                <span class="filter-btn-label">Зв'язки тегів</span>
                            </button>
                        </div>
                    </div>

                    <div class="graph-top-actions">
                        <div class="graph-search-box">
                            <input type="text" class="graph-search-input" id="graph-search-input" placeholder="Пошук у графі зв'язків..." autocomplete="off">
                            <span class="graph-search-icon-right" id="graph-search-icon-right">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <button class="graph-search-clear-btn" id="graph-search-clear-btn" style="display: none;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <button class="graph-mobile-filters-trigger" id="graph-mobile-filters-trigger" title="Фільтри та зв'язки графу" aria-label="Фільтри графу">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="4" y1="21" x2="4" y2="14"></line>
                                <line x1="4" y1="10" x2="4" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12" y2="3"></line>
                                <line x1="20" y1="21" x2="20" y2="16"></line>
                                <line x1="20" y1="12" x2="20" y2="3"></line>
                                <line x1="1" y1="14" x2="7" y2="14"></line>
                                <line x1="9" y1="8" x2="15" y2="8"></line>
                                <line x1="17" y1="16" x2="23" y2="16"></line>
                            </svg>
                            <span class="graph-filter-dot" id="graph-filter-indicator"></span>
                        </button>
                    </div>
                </div>

                <div class="graph-tags-bar" id="graph-tags-bar" style="display: none;"></div>

                <div class="graph-mobile-sheet-backdrop" id="graph-mobile-sheet-backdrop">
                    <div class="graph-mobile-sheet" id="graph-mobile-sheet">
                        <div class="graph-mobile-sheet-handle"></div>
                        <div class="graph-mobile-sheet-header">
                            <div class="graph-mobile-sheet-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="4" y1="21" x2="4" y2="14"></line>
                                    <line x1="4" y1="10" x2="4" y2="3"></line>
                                    <line x1="12" y1="21" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12" y2="3"></line>
                                    <line x1="20" y1="21" x2="20" y2="16"></line>
                                    <line x1="20" y1="12" x2="20" y2="3"></line>
                                    <line x1="1" y1="14" x2="7" y2="14"></line>
                                    <line x1="9" y1="8" x2="15" y2="8"></line>
                                    <line x1="17" y1="16" x2="23" y2="16"></line>
                                </svg>
                                <span>Фільтри та зв'язки</span>
                            </div>
                            <button class="graph-mobile-sheet-close" id="graph-mobile-sheet-close" aria-label="Закрити">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="graph-mobile-sheet-content">
                            <div class="graph-mobile-section-label">Режими зв'язків</div>
                            <div class="graph-mobile-toggles-grid">
                                <button class="graph-mobile-toggle-btn is-orphans-btn" id="graph-mobile-filter-orphans">
                                    <div class="graph-mobile-toggle-left">
                                        <svg class="graph-mobile-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="3.5" fill="currentColor"></circle>
                                            <circle cx="12" cy="12" r="8" stroke-dasharray="2 3"></circle>
                                        </svg>
                                        <div class="graph-mobile-toggle-info">
                                            <span class="graph-mobile-toggle-title">Лише острови</span>
                                            <span class="graph-mobile-toggle-sub">Нотатки без зв'язків</span>
                                        </div>
                                    </div>
                                    <div class="graph-mobile-toggle-right">
                                        <span class="graph-mobile-badge" id="graph-mobile-orphans-counter">0</span>
                                        <span class="graph-mobile-checkbox"></span>
                                    </div>
                                </button>

                                <button class="graph-mobile-toggle-btn is-active" id="graph-mobile-toggle-tag-links">
                                    <div class="graph-mobile-toggle-left">
                                        <svg class="graph-mobile-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                        </svg>
                                        <div class="graph-mobile-toggle-info">
                                            <span class="graph-mobile-toggle-title">Зв'язки тегів</span>
                                            <span class="graph-mobile-toggle-sub">Лінії спільних тегів</span>
                                        </div>
                                    </div>
                                    <div class="graph-mobile-toggle-right">
                                        <span class="graph-mobile-checkbox"></span>
                                    </div>
                                </button>
                            </div>

                            <div class="graph-mobile-section-label" id="graph-mobile-tags-label" style="display: none;">Фільтр за тегами</div>
                            <div class="graph-mobile-tags-wrap" id="graph-mobile-tags-wrap" style="display: none;"></div>
                        </div>
                    </div>
                </div>

                <canvas class="graph-canvas" id="graph-canvas"></canvas>
                <div class="graph-nodes-layer" id="graph-nodes-layer"></div>

                <div class="graph-preview-card" id="graph-preview-card" style="display: none;">
                    <button class="graph-preview-close" id="graph-preview-close" title="Закрити прев'ю">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="graph-preview-header">
                        <span class="graph-preview-icon" id="graph-preview-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </span>
                        <div class="graph-preview-title-wrap">
                            <h4 class="graph-preview-title" id="graph-preview-title"></h4>
                            <div class="graph-preview-badges" id="graph-preview-badges"></div>
                        </div>
                    </div>
                    <div class="graph-preview-tags" id="graph-preview-tags"></div>
                    <div class="graph-preview-body" id="graph-preview-body"></div>
                    <div class="graph-preview-footer">
                        <span class="graph-preview-meta" id="graph-preview-meta"></span>
                        <button class="graph-preview-open-btn" id="graph-preview-open-btn">
                            <span>Відкрити нотатку</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="graph-controls-panel">
                    <button class="graph-ctrl-btn" id="graph-zoom-in" title="Наблизити (+)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="graph-ctrl-btn" id="graph-zoom-out" title="Віддалити (-)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="graph-ctrl-btn" id="graph-reset-view" title="Скинути камеру / Центрувати">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>

                <div class="graph-legend-pill">
                    <div class="graph-legend-item">
                        <span class="graph-legend-dot root"></span>
                        <span>Корінь</span>
                    </div>
                    <div class="graph-legend-item">
                        <span class="graph-legend-dot subnote"></span>
                        <span>Піднотатки</span>
                    </div>
                    <div class="graph-legend-item">
                        <span class="graph-legend-dot" style="background: #f59e0b; border: 1px dashed #f59e0b;"></span>
                        <span>Спільні теги</span>
                    </div>
                    <span class="graph-legend-hint">Наведення відкриває прев'ю, клік відкриває в робочій області</span>
                </div>
            `;

            parentEl.appendChild(container);

            canvas = container.querySelector('#graph-canvas');
            ctx = canvas.getContext('2d');
            nodesLayer = container.querySelector('#graph-nodes-layer');
            searchInput = container.querySelector('#graph-search-input');
            previewCard = container.querySelector('#graph-preview-card');

            this.bindDOMEvents();
        },

        bindDOMEvents() {
            this.unbindDOMEvents();

            const clearBtn = container.querySelector('#graph-search-clear-btn');
            const searchIconRight = container.querySelector('#graph-search-icon-right');
            const orphansBtn = container.querySelector('#graph-filter-orphans');
            const mobileOrphansBtn = container.querySelector('#graph-mobile-filter-orphans');
            const tagLinksBtn = container.querySelector('#graph-toggle-tag-links');
            const mobileTagLinksBtn = container.querySelector('#graph-mobile-toggle-tag-links');
            const previewCloseBtn = container.querySelector('#graph-preview-close');

            const mobileTrigger = container.querySelector('#graph-mobile-filters-trigger');
            const mobileSheetBackdrop = container.querySelector('#graph-mobile-sheet-backdrop');
            const mobileSheetClose = container.querySelector('#graph-mobile-sheet-close');

            const openMobileSheet = () => {
                if (mobileSheetBackdrop) mobileSheetBackdrop.classList.add('is-open');
            };
            const closeMobileSheet = () => {
                if (mobileSheetBackdrop) mobileSheetBackdrop.classList.remove('is-open');
            };

            if (mobileTrigger) mobileTrigger.addEventListener('click', openMobileSheet);
            if (mobileSheetClose) mobileSheetClose.addEventListener('click', closeMobileSheet);
            if (mobileSheetBackdrop) {
                mobileSheetBackdrop.addEventListener('click', (e) => {
                    if (e.target === mobileSheetBackdrop) closeMobileSheet();
                });
            }

            // 1. Фільтр Острови (Orphans)
            const toggleOrphans = () => {
                isOrphansOnly = !isOrphansOnly;
                if (orphansBtn) orphansBtn.classList.toggle('is-active', isOrphansOnly);
                if (mobileOrphansBtn) mobileOrphansBtn.classList.toggle('is-active', isOrphansOnly);
                this.updateMobileFilterIndicator();
                this.hidePreviewCard(true);
                this.updateEdgesCounter();
                this.draw();
            };

            if (orphansBtn) {
                orphansBtn.classList.toggle('is-active', isOrphansOnly);
                orphansBtn.addEventListener('click', toggleOrphans);
            }
            if (mobileOrphansBtn) {
                mobileOrphansBtn.classList.toggle('is-active', isOrphansOnly);
                mobileOrphansBtn.addEventListener('click', toggleOrphans);
            }

            // 2. Перемикач зв'язків за тегами
            const toggleTagLinks = () => {
                showTagLinks = !showTagLinks;
                if (tagLinksBtn) tagLinksBtn.classList.toggle('is-active', showTagLinks);
                if (mobileTagLinksBtn) mobileTagLinksBtn.classList.toggle('is-active', showTagLinks);
                this.updateMobileFilterIndicator();
                this.hidePreviewCard(true);
                this.updateEdgesCounter();
                this.wakeUpSimulation();
                this.draw();
            };

            if (tagLinksBtn) {
                tagLinksBtn.classList.toggle('is-active', showTagLinks);
                tagLinksBtn.addEventListener('click', toggleTagLinks);
            }
            if (mobileTagLinksBtn) {
                mobileTagLinksBtn.classList.toggle('is-active', showTagLinks);
                mobileTagLinksBtn.addEventListener('click', toggleTagLinks);
            }

            // 3. Події картки швидкого перегляду
            if (previewCard) {
                previewCard.addEventListener('pointerenter', () => {
                    isMouseOverPreview = true;
                    if (previewTimeout) {
                        clearTimeout(previewTimeout);
                        previewTimeout = null;
                    }
                });
                previewCard.addEventListener('pointerleave', () => {
                    isMouseOverPreview = false;
                    this.hidePreviewCard();
                });
            }

            if (previewCloseBtn) {
                previewCloseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hidePreviewCard(true);
                });
            }

            // Пошук
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
                    if (searchIconRight) searchIconRight.style.display = searchQuery ? 'none' : 'flex';
                    this.draw();
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (searchInput) {
                        searchInput.value = '';
                        searchQuery = '';
                        searchInput.focus();
                    }
                    clearBtn.style.display = 'none';
                    if (searchIconRight) searchIconRight.style.display = 'flex';
                    this.draw();
                });
            }

            // Шорткат '/' або Escape / Enter
            boundKeyDown = (e) => {
                if (e.key === '/' && document.activeElement !== searchInput && !document.activeElement.isContentEditable && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    if (window.App.state && window.App.state.isGraphView) {
                        e.preventDefault();
                        if (searchInput) {
                            searchInput.focus();
                            searchInput.select();
                        }
                    }
                } else if ((e.key === 'Escape' || e.key === 'Enter') && document.activeElement === searchInput) {
                    searchInput.blur();
                } else if (e.key === 'Escape' && mobileSheetBackdrop && mobileSheetBackdrop.classList.contains('is-open')) {
                    closeMobileSheet();
                } else if (e.key === 'Escape' && previewCard && previewCard.classList.contains('active')) {
                    this.hidePreviewCard(true);
                }
            };

            // Зум кнопки
            container.querySelector('#graph-zoom-in').addEventListener('click', () => {
                this.smoothZoom(1.25);
            });
            container.querySelector('#graph-zoom-out').addEventListener('click', () => {
                this.smoothZoom(0.8);
            });
            container.querySelector('#graph-reset-view').addEventListener('click', () => {
                this.resetCamera();
            });

            // Canvas події (Pointer)
            canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
            canvas.addEventListener('dblclick', (e) => {
                const targetNode = this.getNodeAt(e.clientX, e.clientY);
                if (targetNode) {
                    this.openNoteInWorkspace(targetNode.id);
                }
            });
            canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

            // Сенсорний жест масштабування камери двома пальцями (Pinch-to-zoom)
            const getTouchDist = (t1, t2) => {
                const dx = t2.clientX - t1.clientX;
                const dy = t2.clientY - t1.clientY;
                return Math.sqrt(dx * dx + dy * dy);
            };

            const getTouchCenter = (t1, t2) => {
                return {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };
            };

            boundTouchStart = (e) => {
                if (e.touches.length === 2) {
                    isPinching = true;
                    isDraggingNode = false;
                    isDraggingCanvas = false;
                    draggedNode = null;
                    this.hidePreviewCard(true);

                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    touchStartDist = getTouchDist(t1, t2);
                    touchStartCenter = getTouchCenter(t1, t2);
                    touchStartZoom = camera.zoom;
                    touchStartCam = { x: camera.x, y: camera.y };

                    e.preventDefault();
                }
            };

            boundTouchMove = (e) => {
                if (e.touches.length === 2 && isPinching) {
                    e.preventDefault();
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const currentDist = getTouchDist(t1, t2);
                    const currentCenter = getTouchCenter(t1, t2);

                    if (touchStartDist > 0) {
                        const scale = currentDist / touchStartDist;
                        const newZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, touchStartZoom * scale));

                        const rect = canvas.getBoundingClientRect();
                        const startCenterX = touchStartCenter.x - rect.left;
                        const startCenterY = touchStartCenter.y - rect.top;

                        const panX = currentCenter.x - touchStartCenter.x;
                        const panY = currentCenter.y - touchStartCenter.y;

                        camera.x = startCenterX - (startCenterX - touchStartCam.x) * (newZoom / touchStartZoom) + panX;
                        camera.y = startCenterY - (startCenterY - touchStartCam.y) * (newZoom / touchStartZoom) + panY;
                        camera.zoom = newZoom;

                        this.draw();
                    }
                }
            };

            boundTouchEnd = (e) => {
                if (e.touches.length < 2 && isPinching) {
                    isPinching = false;
                    if (e.touches.length === 1) {
                        const t = e.touches[0];
                        lastMousePos = { x: t.clientX, y: t.clientY };
                        startMousePos = { x: t.clientX, y: t.clientY };
                    }
                }
            };

            canvas.addEventListener('touchstart', boundTouchStart, { passive: false });
            canvas.addEventListener('touchmove', boundTouchMove, { passive: false });
            canvas.addEventListener('touchend', boundTouchEnd);
            canvas.addEventListener('touchcancel', boundTouchEnd);

            // Глобальні події вікна з можливістю чистого відписування
            boundPointerMove = this.onPointerMove.bind(this);
            boundPointerUp = this.onPointerUp.bind(this);
            boundResize = this.onResize.bind(this);

            window.addEventListener('pointermove', boundPointerMove);
            window.addEventListener('pointerup', boundPointerUp);
            window.addEventListener('pointercancel', boundPointerUp);
            window.addEventListener('keydown', boundKeyDown);
            window.addEventListener('resize', boundResize);

            this.updateMobileFilterIndicator();
        },

        unbindDOMEvents() {
            if (boundPointerMove) {
                window.removeEventListener('pointermove', boundPointerMove);
                boundPointerMove = null;
            }
            if (boundPointerUp) {
                window.removeEventListener('pointerup', boundPointerUp);
                window.removeEventListener('pointercancel', boundPointerUp);
                boundPointerUp = null;
            }
            if (boundKeyDown) {
                window.removeEventListener('keydown', boundKeyDown);
                boundKeyDown = null;
            }
            if (boundResize) {
                window.removeEventListener('resize', boundResize);
                boundResize = null;
            }
            if (canvas && boundTouchStart) {
                canvas.removeEventListener('touchstart', boundTouchStart);
                canvas.removeEventListener('touchmove', boundTouchMove);
                canvas.removeEventListener('touchend', boundTouchEnd);
                canvas.removeEventListener('touchcancel', boundTouchEnd);
                boundTouchStart = null;
                boundTouchMove = null;
                boundTouchEnd = null;
            }
        },

        buildGraphData() {
            const state = window.App.state;
            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            const boardNotes = (state.notes || []).filter(n => n.boardId === currentBoard.id);
            const notesMap = new Map();

            nodes = [];
            edges = [];
            lastFocusNodeId = null;
            cachedSubtreeIds = null;
            if (nodesLayer) {
                nodesLayer.innerHTML = '';
            }

            const dpr = window.devicePixelRatio || 1;
            const width = (canvas && canvas.width > 0) ? (canvas.width / dpr) : (container ? container.clientWidth : 800);
            const height = (canvas && canvas.height > 0) ? (canvas.height / dpr) : (container ? container.clientHeight : 600);

            const centerX = width / 2;
            const centerY = height / 2;

            // Створюємо мапу нотаток для швидкого пошуку предків
            const rawNotesById = new Map();
            boardNotes.forEach(n => rawNotesById.set(n.id, n));

            function getRootAncestor(noteId) {
                let curr = rawNotesById.get(noteId);
                const visited = new Set();
                while (curr && curr.parentId && rawNotesById.has(curr.parentId) && !visited.has(curr.id)) {
                    visited.add(curr.id);
                    curr = rawNotesById.get(curr.parentId);
                }
                return curr || null;
            }

            // Збираємо список усіх унікальних коренів для призначення послідовних кольорів
            const rootIds = [];
            boardNotes.forEach(note => {
                const root = getRootAncestor(note.id);
                const rId = root ? root.id : note.id;
                if (!rootIds.includes(rId)) {
                    rootIds.push(rId);
                }
            });

            // 1. Формуємо вершини (Nodes) навколо реального центру полотна
            boardNotes.forEach((note) => {
                const isRoot = !note.parentId;
                const noteLevel = window.App.noteManager ? window.App.noteManager.getNoteLevel(note.id) : (isRoot ? 0 : 1);
                const radius = isRoot ? 20 : Math.max(12, 16 - noteLevel);

                const rootAncestor = getRootAncestor(note.id);
                const rootId = rootAncestor ? rootAncestor.id : note.id;
                const rootIndex = rootIds.indexOf(rootId);
                const branchColor = getBranchColor(rootId, rootIndex >= 0 ? rootIndex : undefined);

                // Очищення тексту для тултіпа/пошуку в один прохід
                const cleanContent = (note.content || '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * (isRoot ? 80 : 150);

                const node = {
                    id: note.id,
                    title: (note.title && note.title.trim()) ? note.title.trim() : 'Без назви',
                    content: cleanContent,
                    icon: note.icon || (isRoot ? '🗒️' : '📄'),
                    branchColor: branchColor,
                    isRoot: isRoot,
                    level: noteLevel,
                    parentId: note.parentId || null,
                    tags: window.App.noteManager ? window.App.noteManager.getNoteTags(note) : (Array.isArray(note.tags) ? note.tags : (note.tag ? [note.tag.text || note.tag] : [])),
                    radius: radius,
                    x: centerX + Math.cos(angle) * dist,
                    y: centerY + Math.sin(angle) * dist,
                    vx: 0,
                    vy: 0,
                    childCount: 0,
                    isOrphan: false
                };

                if (nodesLayer) {
                    const el = document.createElement('div');
                    el.className = 'graph-html-node' + (isRoot ? ' is-root' : '') + ` is-level-${noteLevel}`;
                    el.dataset.level = noteLevel;
                    const levelLabel = noteLevel === 0 ? 'Коренева нотатка (Рівень 0)' : `Піднотатка (Рівень ${noteLevel})`;
                    el.title = `${node.title} — ${levelLabel}\n\n${node.content.substring(0, 100)}...`;

                    const circle = document.createElement('div');
                    circle.className = 'graph-html-node-circle';
                    circle.style.setProperty('--node-branch-color', branchColor);
                    circle.style.backgroundColor = branchColor;
                    if (!isRoot) {
                        circle.style.borderColor = 'rgba(255, 255, 255, 0.45)';
                        circle.style.boxShadow = `0 0 10px ${branchColor}55`;
                    }
                    circle.innerHTML = node.icon;

                    const label = document.createElement('div');
                    label.className = 'graph-html-node-label';
                    label.textContent = node.title;

                    el.appendChild(circle);
                    el.appendChild(label);
                    nodesLayer.appendChild(el);

                    node.element = el;
                }

                nodes.push(node);
                notesMap.set(note.id, node);
            });

            // 2. Формуємо ребра (Edges) між батьківськими та дочірніми нотатками
            nodes.forEach(node => {
                if (node.parentId && notesMap.has(node.parentId)) {
                    const parentNode = notesMap.get(node.parentId);
                    parentNode.childCount++;
                    parentNode.radius = Math.min(26, parentNode.radius + 1.8);

                    edges.push({
                        source: parentNode,
                        target: node,
                        color: parentNode.branchColor || node.branchColor || '#10b981',
                        length: 90 + Math.random() * 20,
                        type: 'hierarchy'
                    });
                }
            });

            // 3. Розрахунок ізольованих нотаток (сиріт)
            let orphansCount = 0;
            nodes.forEach(node => {
                node.isOrphan = !node.parentId && (node.childCount === 0);
                if (node.isOrphan) {
                    orphansCount++;
                    if (node.element) {
                        node.element.classList.add('is-orphan');
                    }
                }
            });

            const orphansCounter = container.querySelector('#graph-orphans-counter');
            const mobileOrphansCounter = container.querySelector('#graph-mobile-orphans-counter');
            if (orphansCounter) {
                orphansCounter.textContent = orphansCount;
            }
            if (mobileOrphansCounter) {
                mobileOrphansCounter.textContent = orphansCount;
            }

            // 4. Формуємо зв'язки за спільними тегами та панель тегів
            const tagToNodes = new Map();
            const tagsCountMap = new Map();
            nodes.forEach(node => {
                (node.tags || []).forEach(t => {
                    const tagText = (typeof t === 'string' ? t : (t.text || '')).trim();
                    if (!tagText) return;
                    if (!tagToNodes.has(tagText)) tagToNodes.set(tagText, []);
                    tagToNodes.get(tagText).push(node);
                    tagsCountMap.set(tagText, (tagsCountMap.get(tagText) || 0) + 1);
                });
            });

            this.renderTagsBar(tagsCountMap);

            const tagEdgePairs = new Set();
            const hasHierarchyEdge = (n1, n2) => (n1.parentId === n2.id || n2.parentId === n1.id);

            tagToNodes.forEach((taggedNodes, tagText) => {
                if (taggedNodes.length < 2) return;
                const tagColor = getTagColor(tagText);

                for (let i = 0; i < taggedNodes.length; i++) {
                    const nextIdx = (i + 1) % taggedNodes.length;
                    if (taggedNodes.length === 2 && i === 1) break;

                    const n1 = taggedNodes[i];
                    const n2 = taggedNodes[nextIdx];
                    if (n1 === n2 || hasHierarchyEdge(n1, n2)) continue;

                    const pairKey = n1.id < n2.id ? (n1.id + '__' + n2.id) : (n2.id + '__' + n1.id);
                    if (tagEdgePairs.has(pairKey)) continue;
                    tagEdgePairs.add(pairKey);

                    edges.push({
                        source: n1,
                        target: n2,
                        color: tagColor,
                        length: 130 + Math.random() * 25,
                        type: 'tag',
                        tag: tagText
                    });
                }
            });

            // Оновлюємо лічильник активних зв'язків
            this.updateEdgesCounter();

            // Центруємо камеру на старті
            this.resetCamera();

            // Warm-up Physics: розгортаємо граф за кілька швидких ітерацій
            for (let i = 0; i < 40; i++) {
                this.updatePhysics();
            }
        },

        renderTagsBar(tagsCountMap) {
            const bar = container ? container.querySelector('#graph-tags-bar') : null;
            const mobileWrap = container ? container.querySelector('#graph-mobile-tags-wrap') : null;
            const mobileLabel = container ? container.querySelector('#graph-mobile-tags-label') : null;

            if (!tagsCountMap || tagsCountMap.size === 0) {
                if (bar) {
                    bar.style.display = 'none';
                    bar.innerHTML = '';
                }
                if (mobileWrap) {
                    mobileWrap.style.display = 'none';
                    mobileWrap.innerHTML = '';
                }
                if (mobileLabel) {
                    mobileLabel.style.display = 'none';
                }
                this.updateMobileFilterIndicator();
                return;
            }

            if (bar) {
                bar.style.display = 'flex';
                bar.innerHTML = '';
            }
            if (mobileWrap) {
                mobileWrap.style.display = 'flex';
                mobileWrap.innerHTML = '';
            }
            if (mobileLabel) {
                mobileLabel.style.display = 'block';
            }

            const sortedTags = Array.from(tagsCountMap.entries()).sort((a, b) => b[1] - a[1]);

            const createAllBtn = () => {
                const btn = document.createElement('button');
                btn.className = 'graph-tag-chip' + (activeTagFilter === null ? ' is-active' : '');
                btn.innerHTML = `
                    <span class="graph-tag-dot" style="background: #10b981;"></span>
                    <span class="graph-tag-name">Всі нотатки</span>
                    <span class="graph-tag-count">${nodes.length}</span>
                `;
                btn.addEventListener('click', () => {
                    activeTagFilter = null;
                    this.updateTagsBarActive();
                    this.hidePreviewCard(true);
                    this.draw();
                });
                return btn;
            };

            if (bar) bar.appendChild(createAllBtn());
            if (mobileWrap) mobileWrap.appendChild(createAllBtn());

            sortedTags.forEach(([tagText, count]) => {
                const color = getTagColor(tagText);

                const createChip = () => {
                    const chip = document.createElement('button');
                    chip.className = 'graph-tag-chip' + (activeTagFilter === tagText ? ' is-active' : '');
                    chip.dataset.tag = tagText;
                    chip.innerHTML = `
                        <span class="graph-tag-dot" style="background: ${color};"></span>
                        <span class="graph-tag-name">#${tagText}</span>
                        <span class="graph-tag-count">${count}</span>
                    `;

                    chip.addEventListener('click', () => {
                        if (activeTagFilter === tagText) {
                            activeTagFilter = null;
                        } else {
                            activeTagFilter = tagText;
                        }
                        this.updateTagsBarActive();
                        this.hidePreviewCard(true);
                        this.draw();
                    });
                    return chip;
                };

                if (bar) bar.appendChild(createChip());
                if (mobileWrap) mobileWrap.appendChild(createChip());
            });

            this.updateMobileFilterIndicator();
        },

        updateTagsBarActive() {
            if (!container) return;
            const chips = container.querySelectorAll('.graph-tag-chip');
            chips.forEach(chip => {
                const tag = chip.dataset.tag;
                if (!tag) {
                    chip.classList.toggle('is-active', activeTagFilter === null);
                } else {
                    chip.classList.toggle('is-active', activeTagFilter === tag);
                }
            });
            this.updateMobileFilterIndicator();
        },

        updateMobileFilterIndicator() {
            if (!container) return;
            const trigger = container.querySelector('#graph-mobile-filters-trigger');
            const dot = container.querySelector('#graph-filter-indicator');
            const hasActive = isOrphansOnly || !showTagLinks || (activeTagFilter !== null);
            if (trigger) trigger.classList.toggle('has-active-filters', hasActive);
            if (dot) dot.classList.toggle('is-visible', hasActive);
        },

        updateEdgesCounter() {
            if (!container) return;
            const counter = container.querySelector('#graph-nodes-counter');
            if (counter) {
                const activeEdgesCount = edges.filter(e => !isOrphansOnly && (e.type !== 'tag' || showTagLinks)).length;
                counter.textContent = `${nodes.length} нотаток, ${activeEdgesCount} зв'язків`;
            }
        },

        showPreviewCard(node, immediate = false) {
            if (!node || !previewCard) return;
            if (previewTimeout) {
                clearTimeout(previewTimeout);
                previewTimeout = null;
            }

            if (immediate) {
                this.renderPreviewCard(node);
            } else {
                previewTimeout = setTimeout(() => {
                    this.renderPreviewCard(node);
                }, 120);
            }
        },

        renderPreviewCard(node) {
            if (!node || !previewCard) return;
            previewNode = node;

            const iconEl = previewCard.querySelector('#graph-preview-icon');
            const titleEl = previewCard.querySelector('#graph-preview-title');
            const badgesEl = previewCard.querySelector('#graph-preview-badges');
            const tagsEl = previewCard.querySelector('#graph-preview-tags');
            const bodyEl = previewCard.querySelector('#graph-preview-body');
            const metaEl = previewCard.querySelector('#graph-preview-meta');
            const openBtn = previewCard.querySelector('#graph-preview-open-btn');

            if (iconEl) iconEl.textContent = node.icon;
            if (titleEl) titleEl.textContent = node.title;

            if (badgesEl) {
                let badgesHtml = '';
                if (node.isOrphan) {
                    badgesHtml += `<span class="preview-badge preview-badge-orphan">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;">
                            <circle cx="12" cy="12" r="3.5" fill="currentColor"></circle>
                            <circle cx="12" cy="12" r="8" stroke-dasharray="2 3"></circle>
                        </svg>
                        Острів
                    </span>`;
                }
                if (node.isRoot) {
                    badgesHtml += `<span class="preview-badge preview-badge-root">Коренева</span>`;
                } else {
                    badgesHtml += `<span class="preview-badge preview-badge-level">Рівень ${node.level}</span>`;
                }
                if (node.childCount > 0) {
                    badgesHtml += `<span class="preview-badge preview-badge-subs">${node.childCount} ${node.childCount === 1 ? 'піднотатка' : (node.childCount < 5 ? 'піднотатки' : 'піднотаток')}</span>`;
                }
                badgesEl.innerHTML = badgesHtml;
            }

            if (tagsEl) {
                if (node.tags && node.tags.length > 0) {
                    tagsEl.innerHTML = node.tags.map(t => {
                        const tagText = typeof t === 'string' ? t : (t.text || '');
                        const color = getTagColor(tagText);
                        return `<span class="graph-preview-tag" style="background: ${color}22; color: ${color}; border: 1px solid ${color}55;">#${tagText}</span>`;
                    }).join('');
                    tagsEl.style.display = 'flex';
                } else {
                    tagsEl.innerHTML = '';
                    tagsEl.style.display = 'none';
                }
            }

            if (bodyEl) {
                if (node.content && node.content.trim()) {
                    bodyEl.classList.remove('is-empty');
                    const text = node.content.trim();
                    bodyEl.textContent = text.length > 200 ? text.slice(0, 200) + '...' : text;
                } else {
                    bodyEl.classList.add('is-empty');
                    bodyEl.textContent = 'Порожня нотатка';
                }
            }

            if (metaEl) {
                const rawNote = window.App.noteManager ? window.App.noteManager.getNoteById(node.id) : null;
                const timeStr = rawNote && rawNote.updatedAt ? `Змінено ${formatTimeAgo(rawNote.updatedAt)}` : '';
                metaEl.textContent = timeStr;
            }

            if (openBtn) {
                openBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.openNoteInWorkspace(node.id);
                };
            }

            previewCard.style.display = 'block';
            previewCard.classList.add('active');
            this.updatePreviewPosition(node);
        },

        updatePreviewPosition(node) {
            if (!previewCard || !node || !container) return;

            const screenPos = this.worldToScreen(node.x, node.y);
            const cRect = container.getBoundingClientRect();
            const pRect = previewCard.getBoundingClientRect();

            const cardWidth = pRect.width || 320;
            const cardHeight = pRect.height || 180;
            const padding = 16;

            let left = screenPos.x + (node.radius * camera.zoom) + 16;
            let top = screenPos.y - 45;

            // Якщо картка виходить за правий край — відображаємо зліва від вузла
            if (left + cardWidth > cRect.width - padding) {
                left = screenPos.x - (node.radius * camera.zoom) - cardWidth - 16;
            }

            // Межі екрана
            if (left < padding) left = padding;
            if (top + cardHeight > cRect.height - padding) {
                top = Math.max(padding + 60, cRect.height - cardHeight - padding);
            }
            if (top < padding + 55) {
                top = padding + 55;
            }

            previewCard.style.left = `${left}px`;
            previewCard.style.top = `${top}px`;
        },

        hidePreviewCard(immediate = false) {
            if (previewTimeout) {
                clearTimeout(previewTimeout);
                previewTimeout = null;
            }

            if (isMouseOverPreview && !immediate) return;

            const doHide = () => {
                if (isMouseOverPreview && !immediate) return;
                if (previewCard) {
                    previewCard.style.display = 'none';
                    previewCard.classList.remove('active');
                }
                previewNode = null;
            };

            if (immediate) {
                doHide();
            } else {
                previewTimeout = setTimeout(doHide, 220);
            }
        },

        resizeCanvas() {
            if (!canvas || !container) return;
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            ctx.scale(dpr, dpr);
        },

        onResize() {
            if (window.App.state && window.App.state.isGraphView && isRunning) {
                this.resizeCanvas();
                this.draw();
            }
        },

        resetCamera() {
            if (!canvas || !container) return;
            const rect = container.getBoundingClientRect();
            camera.x = rect.width / 2;
            camera.y = rect.height / 2;
            camera.zoom = 1;
            this.draw();
        },

        smoothZoom(factor) {
            const newZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
            camera.zoom = newZoom;
            this.draw();
        },

        // Фізична симуляція (Force-Directed Graph)
        updatePhysics() {
            const repulsion = 1200;
            const springK = 0.005;
            const damping = 0.88;
            const centerAttraction = 0.0008;
            const maxVelocity = 20;

            const dpr = window.devicePixelRatio || 1;
            const centerX = canvas ? (canvas.width / dpr) / 2 : 400;
            const centerY = canvas ? (canvas.height / dpr) / 2 : 300;

            // 1. Відштовхування кожної пари вершин (Coulomb's Law)
            for (let i = 0; i < nodes.length; i++) {
                const n1 = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const n2 = nodes[j];
                    let dx = n2.x - n1.x;
                    let dy = n2.y - n1.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1) dist = 1;

                    if (dist < 320) {
                        // Запобігаємо вибуху сили при дуже близьких або однакових координатах
                        const effectiveDist = Math.max(15, dist);
                        let force = (repulsion / (effectiveDist * effectiveDist));
                        let fx = (dx / dist) * force;
                        let fy = (dy / dist) * force;

                        if (n1 !== draggedNode) {
                            n1.vx -= fx;
                            n1.vy -= fy;
                        }
                        if (n2 !== draggedNode) {
                            n2.vx += fx;
                            n2.vy += fy;
                        }
                    }
                }

                // Тяжіння до центру маси
                if (n1 !== draggedNode) {
                    n1.vx += (centerX - n1.x) * centerAttraction;
                    n1.vy += (centerY - n1.y) * centerAttraction;
                }
            }

            // 2. Сила пружин по зв'язках (Hooke's Law: дія та протидія рівні й протилежні)
            edges.forEach(edge => {
                if (edge.type === 'tag' && !showTagLinks) return;
                const s = edge.source;
                const t = edge.target;
                let dx = t.x - s.x;
                let dy = t.y - s.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                let displacement = dist - edge.length;
                const k = (edge.type === 'tag') ? (springK * 0.35) : springK;
                let force = displacement * k;

                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                if (s !== draggedNode) {
                    s.vx += fx;
                    s.vy += fy;
                }
                if (t !== draggedNode) {
                    t.vx -= fx;
                    t.vy -= fy;
                }
            });

            // 3. Застосування швидкості та затухання з лімітом швидкості та розрахунком сумарної енергії
            let totalMovement = 0;
            nodes.forEach(node => {
                if (node === draggedNode) return;

                node.vx *= damping;
                node.vy *= damping;

                // Обмежуємо максимальну швидкість для стабільності симуляції
                const speed = Math.hypot(node.vx, node.vy);
                if (speed > maxVelocity) {
                    node.vx = (node.vx / speed) * maxVelocity;
                    node.vy = (node.vy / speed) * maxVelocity;
                }

                node.x += node.vx;
                node.y += node.vy;

                totalMovement += Math.abs(node.vx) + Math.abs(node.vy);
            });

            return totalMovement;
        },

        // Малювання патерну крапок на фоні графа (Адаптивний LOD)
        drawDotGrid(width, height) {
            let gridSize = 28;
            if (camera.zoom < 0.35) {
                gridSize = 112;
            } else if (camera.zoom < 0.65) {
                gridSize = 56;
            }

            const dotRadius = Math.max(0.75, 1.0 / camera.zoom);

            const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize - gridSize;
            const endX = Math.ceil(((width - camera.x) / camera.zoom) / gridSize) * gridSize + gridSize;
            const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize - gridSize;
            const endY = Math.ceil(((height - camera.y) / camera.zoom) / gridSize) * gridSize + gridSize;

            const countX = (endX - startX) / gridSize;
            const countY = (endY - startY) / gridSize;
            if (countX * countY > 2500) return;

            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();

            for (let x = startX; x <= endX; x += gridSize) {
                for (let y = startY; y <= endY; y += gridSize) {
                    ctx.moveTo(x + dotRadius, y);
                    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                }
            }

            ctx.fill();
        },

        // Отримує множину ID вершини та її нащадків з кешуванням
        getFocusSubtreeIds(focusNodeId) {
            if (!focusNodeId) return null;
            if (focusNodeId === lastFocusNodeId && cachedSubtreeIds) {
                return cachedSubtreeIds;
            }

            lastFocusNodeId = focusNodeId;
            cachedSubtreeIds = new Set();
            cachedSubtreeIds.add(focusNodeId);

            const collectDescendants = (currentId) => {
                for (let i = 0; i < edges.length; i++) {
                    const edge = edges[i];
                    if (edge.source && edge.source.id === currentId && edge.target) {
                        if (!cachedSubtreeIds.has(edge.target.id)) {
                            cachedSubtreeIds.add(edge.target.id);
                            collectDescendants(edge.target.id);
                        }
                    }
                }
            };

            collectDescendants(focusNodeId);
            return cachedSubtreeIds;
        },

        // Рендеринг кадру на Canvas
        draw() {
            if (!ctx || !canvas) return;

            const dpr = window.devicePixelRatio || 1;
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;

            ctx.clearRect(0, 0, width, height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);

            this.drawDotGrid(width, height);

            ctx.translate(-width / 2, -height / 2);

            const activeFocusNode = draggedNode || hoveredNode;
            const activeSubtreeIds = activeFocusNode ? this.getFocusSubtreeIds(activeFocusNode.id) : null;

            // 1. Малювання зв'язків (Edges)
            edges.forEach(edge => {
                // Якщо увімкнено фільтр "Лише сироти", зв'язки графу не відображаються
                if (isOrphansOnly) return;

                // Якщо тип - тег, і тегові зв'язки вимкнено - пропускаємо
                if (edge.type === 'tag' && !showTagLinks) return;

                const isTagEdge = (edge.type === 'tag');

                // Перевірка активного фільтра за тегами
                const sourceMatchesTag = !activeTagFilter || (edge.source.tags && edge.source.tags.some(t => (typeof t === 'string' ? t : (t.text || '')) === activeTagFilter));
                const targetMatchesTag = !activeTagFilter || (edge.target.tags && edge.target.tags.some(t => (typeof t === 'string' ? t : (t.text || '')) === activeTagFilter));
                const edgeMatchesTagFilter = sourceMatchesTag && targetMatchesTag;

                const isHighlighted = !!(activeSubtreeIds &&
                    activeSubtreeIds.has(edge.source.id) &&
                    activeSubtreeIds.has(edge.target.id));

                const branchColor = edge.color || edge.source.branchColor || '#10b981';

                ctx.beginPath();
                ctx.moveTo(edge.source.x, edge.source.y);
                ctx.lineTo(edge.target.x, edge.target.y);

                if (isTagEdge) {
                    ctx.setLineDash([5, 4]);
                } else {
                    ctx.setLineDash([]);
                }

                if (activeTagFilter && !edgeMatchesTagFilter) {
                    ctx.strokeStyle = branchColor + '10';
                    ctx.lineWidth = 0.7 / camera.zoom;
                    ctx.shadowBlur = 0;
                } else if (isHighlighted) {
                    ctx.strokeStyle = branchColor;
                    ctx.lineWidth = (draggedNode ? 3.0 : 2.5) / camera.zoom;
                    ctx.shadowColor = branchColor;
                    ctx.shadowBlur = 14;
                } else if (activeSubtreeIds) {
                    ctx.strokeStyle = branchColor + '15';
                    ctx.lineWidth = 0.8 / camera.zoom;
                    ctx.shadowBlur = 0;
                } else if (isTagEdge) {
                    ctx.strokeStyle = branchColor + (activeTagFilter ? 'dd' : '90');
                    ctx.lineWidth = (activeTagFilter ? 2.0 : 1.3) / camera.zoom;
                    ctx.shadowBlur = activeTagFilter ? 8 : 0;
                    ctx.shadowColor = branchColor;
                } else {
                    ctx.strokeStyle = branchColor + '40';
                    ctx.lineWidth = 1.2 / camera.zoom;
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            ctx.setLineDash([]);

            // 2. Оновлення стану та позицій HTML-вершин
            nodes.forEach(node => {
                if (!node.element) return;

                const isSearchMatch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery) || node.content.toLowerCase().includes(searchQuery);
                const isOrphanMatch = !isOrphansOnly || node.isOrphan;
                const isTagMatch = !activeTagFilter || (node.tags && node.tags.some(t => (typeof t === 'string' ? t : (t.text || '')) === activeTagFilter));

                const isOverallMatch = isSearchMatch && isOrphanMatch && isTagMatch;

                const isDragging = (draggedNode === node);
                const isHovered = (hoveredNode === node && !draggedNode);
                const isInSubtree = activeSubtreeIds && activeSubtreeIds.has(node.id);
                const isConnected = isInSubtree && !isHovered && !isDragging;

                const hasActiveFilter = (searchQuery !== '' || isOrphansOnly || activeTagFilter !== null);
                let isFaded = false;
                if (hasActiveFilter) {
                    isFaded = !isOverallMatch;
                } else if (activeSubtreeIds) {
                    isFaded = !isInSubtree;
                }

                node.element.classList.toggle('is-dragging', isDragging);
                node.element.classList.toggle('is-hovered', isHovered);
                node.element.classList.toggle('is-connected', isConnected);
                node.element.classList.toggle('is-orphan', !!node.isOrphan && isOrphansOnly);
                node.element.classList.toggle('is-match', isOverallMatch && hasActiveFilter);
                node.element.classList.toggle('is-faded', isFaded);

                node.element.style.left = node.x + 'px';
                node.element.style.top = node.y + 'px';
            });

            if (previewNode && previewCard && previewCard.classList.contains('active')) {
                this.updatePreviewPosition(previewNode);
            }

            if (nodesLayer) {
                nodesLayer.style.transform = 'translate(' + camera.x + 'px, ' + camera.y + 'px) scale(' + camera.zoom + ') translate(' + (-width / 2) + 'px, ' + (-height / 2) + 'px)';
            }

            ctx.restore();
        },

        // Головний цикл анімації з адаптивним засинанням
        startSimulation() {
            if (isRunning) return;
            isRunning = true;
            this.requestLoop();
        },

        wakeUpSimulation() {
            if (!isRunning) return;
            if (!animationFrameId) {
                this.requestLoop();
            }
        },

        requestLoop() {
            if (animationFrameId) return;

            const loop = () => {
                if (!isRunning) {
                    animationFrameId = null;
                    return;
                }

                const totalMovement = this.updatePhysics();
                this.draw();

                // Якщо вузли стабілізувалися і користувач не взаємодіє — зупиняємо RAF loop для збереження енергії
                const isInteracting = isDraggingNode || isDraggingCanvas;
                if (totalMovement < 0.15 && !isInteracting) {
                    animationFrameId = null;
                    return;
                }

                animationFrameId = requestAnimationFrame(loop);
            };

            animationFrameId = requestAnimationFrame(loop);
        },

        stopSimulation() {
            isRunning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            this.unbindDOMEvents();
        },

        cleanup() {
            this.stopSimulation();
            this.hidePreviewCard(true);
            nodes = [];
            edges = [];
            hoveredNode = null;
            draggedNode = null;
            lastFocusNodeId = null;
            cachedSubtreeIds = null;
            isOrphansOnly = false;
            activeTagFilter = null;
            isPinching = false;
        },

        destroy() {
            this.cleanup();
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
            container = null;
            canvas = null;
            ctx = null;
            nodesLayer = null;
            searchInput = null;
            previewCard = null;
        },

        // Перетворення координат
        screenToWorld(screenX, screenY) {
            if (!canvas) return { x: screenX, y: screenY };
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            const x = (screenX - rect.left - camera.x) / camera.zoom + (width / 2);
            const y = (screenY - rect.top - camera.y) / camera.zoom + (height / 2);
            return { x, y };
        },

        getNodeAt(screenX, screenY) {
            const world = this.screenToWorld(screenX, screenY);
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                const dx = world.x - node.x;
                const dy = world.y - node.y;
                if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 6) {
                    return node;
                }
            }
            return null;
        },

        // Події миші та тач-пристроїв
        onPointerDown(e) {
            if (isPinching) return;
            if (e.button !== 0 && e.button !== 1) return;

            const targetNode = this.getNodeAt(e.clientX, e.clientY);
            startMousePos = { x: e.clientX, y: e.clientY };
            lastMousePos = { x: e.clientX, y: e.clientY };

            if (targetNode) {
                isDraggingNode = true;
                draggedNode = targetNode;
                hoveredNode = targetNode;
                this.showPreviewCard(targetNode, true);
                this.wakeUpSimulation();
            } else {
                isDraggingCanvas = true;
                hoveredNode = null;
                draggedNode = null;
                this.hidePreviewCard(true);
                this.draw();
            }
        },

        onPointerMove(e) {
            if (isPinching) return;
            if (!canvas) return;

            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            lastMousePos = { x: e.clientX, y: e.clientY };

            if (isDraggingNode && draggedNode) {
                const world = this.screenToWorld(e.clientX, e.clientY);
                draggedNode.x = world.x;
                draggedNode.y = world.y;
                draggedNode.vx = 0;
                draggedNode.vy = 0;
                this.hidePreviewCard(true);
                this.wakeUpSimulation();
            } else if (isDraggingCanvas) {
                camera.x += dx;
                camera.y += dy;
                this.hidePreviewCard(true);
                this.draw();
            } else {
                const isTouchDevice = e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches || window.innerWidth <= 768;
                if (!isTouchDevice) {
                    const hovered = this.getNodeAt(e.clientX, e.clientY);
                    if (hovered !== hoveredNode) {
                        hoveredNode = hovered;
                        if (hoveredNode) {
                            this.showPreviewCard(hoveredNode);
                        } else {
                            this.hidePreviewCard();
                        }
                        this.draw();
                    }
                } else {
                    if (hoveredNode && !draggedNode) {
                        hoveredNode = null;
                        this.draw();
                    }
                }
            }
        },

        onPointerUp(e) {
            if (isPinching) return;
            const distMoved = Math.sqrt(Math.pow(e.clientX - startMousePos.x, 2) + Math.pow(e.clientY - startMousePos.y, 2));
            const isTouchDevice = e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches || window.innerWidth <= 768;

            if (distMoved < 6 && draggedNode) {
                const clickedNode = draggedNode;
                this.showPreviewCard(clickedNode, true);
            }

            isDraggingCanvas = false;
            isDraggingNode = false;
            draggedNode = null;

            if (isTouchDevice) {
                hoveredNode = null;
            } else {
                hoveredNode = this.getNodeAt(e.clientX, e.clientY);
            }

            this.draw();
        },

        onWheel(e) {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const newZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));

            camera.x = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
            camera.y = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);
            camera.zoom = newZoom;

            this.draw();
        },

        worldToScreen(worldX, worldY) {
            const dpr = window.devicePixelRatio || 1;
            const width = canvas ? (canvas.width / dpr) : (container ? container.clientWidth : 800);
            const height = canvas ? (canvas.height / dpr) : (container ? container.clientHeight : 600);

            const screenX = (worldX - (width / 2)) * camera.zoom + camera.x;
            const screenY = (worldY - (height / 2)) * camera.zoom + camera.y;
            return { x: screenX, y: screenY };
        },

        openNoteInWorkspace(noteId) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const targetNote = noteManager ? noteManager.getNoteById(noteId) : null;
            if (!targetNote) return;

            const chain = [null];
            const ancestors = [];
            let curr = targetNote;

            while (curr && curr.parentId) {
                ancestors.unshift(curr.parentId);
                curr = noteManager.getNoteById(curr.parentId);
            }

            chain.push(...ancestors);
            state.activeChain = chain;

            this.stopSimulation();
            if (window.App.store) {
                window.App.store.setGraphView(false);
            } else {
                state.isGraphView = false;
                window.App.storage.saveGraphViewMode(false);
            }
            window.App.workspaceView.render();

            setTimeout(() => {
                window.App.workspaceView.scrollToNote(noteId);
            }, 100);
        }
    };
})();
