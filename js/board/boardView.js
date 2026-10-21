// js/board/boardView.js - Головний контролер інтерактивної полотно-дошки стікерів
window.App = window.App || {};

(function() {
    let container = null;
    let canvas = null;
    let ctx = null;
    let nodesLayer = null;
    let searchInput = null;

    let nodes = [];
    let edges = [];
    let animationFrameId = null;

    let isDraggingCanvas = false;
    let isDraggingNode = false;
    let draggedNode = null;
    let startMousePos = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    let searchQuery = '';

    let isOrphansOnly = false;
    let showTagLinks = true;
    let activeTagFilter = null;

    let boundPointerMove = null;
    let boundPointerUp = null;
    let boundKeyDown = null;
    let boundResize = null;
    let boundWheel = null;
    let boundCanvasContextMenu = null;

    const BRANCH_COLORS = [
        '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
        '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6'
    ];

    function getBranchColor(rootId, index) {
        if (!rootId) return BRANCH_COLORS[0];
        let hash = 0;
        for (let i = 0; i < rootId.length; i++) {
            hash = ((hash << 5) - hash) + rootId.charCodeAt(i);
            hash |= 0;
        }
        return BRANCH_COLORS[Math.abs(hash) % BRANCH_COLORS.length];
    }

    window.App.boardView = {
        init() {},

        render() {
            this.cleanup();

            const els = window.App.getElements();
            if (!els.columnsContainer) return;

            const pagination = document.getElementById('mobile-columns-pagination');
            if (pagination) {
                pagination.classList.remove('visible');
                pagination.innerHTML = '';
            }

            els.columnsContainer.innerHTML = '';

            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            this.createBoardDOM(els.columnsContainer, currentBoard);
            this.resizeCanvas();
            this.buildBoardData();
            this.draw();
        },

        createBoardDOM(parentEl, currentBoard) {
            container = document.createElement('div');
            container.className = 'board-view-wrapper';

            container.innerHTML = `
                <div class="board-toolbar">
                    <div class="board-toolbar-left">
                        <div class="board-title-pill">
                            <span class="board-title-icon">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                    <path d="M8 8h3v3H8z"></path>
                                    <path d="M13 13h3v3h-3z"></path>
                                    <path d="M11 9.5c2 0 2 5 2 5"></path>
                                </svg>
                            </span>
                            <span class="board-title-text">${currentBoard.name}</span>
                            <span class="board-nodes-count" id="board-nodes-counter">0 стікерів</span>
                        </div>

                        <div class="board-toolbar-filters">
                            <button class="board-toolbar-filter-btn" id="board-auto-layout-btn" title="Впорядкувати стікери на дошці">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="3" width="7" height="7"></rect>
                                    <rect x="14" y="14" width="7" height="7"></rect>
                                    <rect x="3" y="14" width="7" height="7"></rect>
                                </svg>
                                <span>Впорядкувати</span>
                            </button>
                            <button class="board-toolbar-filter-btn is-orphans-btn" id="board-filter-orphans" title="Показати лише ізольовані нотатки">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="3.5" fill="currentColor"></circle>
                                    <circle cx="12" cy="12" r="8" stroke-dasharray="2 3"></circle>
                                </svg>
                                <span>Острови</span>
                                <span class="board-nodes-count" id="board-orphans-counter" style="border:none;padding:0;">0</span>
                            </button>
                            <button class="board-toolbar-filter-btn is-active" id="board-toggle-tag-links" title="Увімкнути/вимкнути зв'язки спільних тегів">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                <span>Зв'язки тегів</span>
                            </button>
                        </div>
                    </div>

                    <div class="board-top-actions">
                        <div class="board-search-box">
                            <input type="text" class="board-search-input" id="board-search-input" placeholder="Пошук на дошці..." autocomplete="off">
                            <span class="board-search-icon-right" id="board-search-icon-right">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <button class="board-search-clear-btn" id="board-search-clear-btn" style="display: none;">✕</button>
                        </div>
                    </div>
                </div>

                <div class="board-tags-bar" id="board-tags-bar" style="display: none;"></div>

                <canvas class="board-canvas"></canvas>
                <div class="board-nodes-layer"></div>

                <div class="board-controls-panel">
                    <button class="board-ctrl-btn" id="board-zoom-in" title="Збільшити масштаб (+)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="board-ctrl-btn" id="board-zoom-out" title="Зменшити масштаб (-)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="board-ctrl-btn" id="board-zoom-reset" title="Скинути положення">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M15 3h6v6"></path>
                            <path d="M9 21H3v-6"></path>
                            <path d="M21 3l-7 7"></path>
                            <path d="M3 21l7-7"></path>
                        </svg>
                    </button>
                </div>

                <div class="board-legend-pill">
                    <span>💡 Перетягуйте картки за шапку</span>
                    <span>•</span>
                    <span>Клікніть правою кнопкою миші на полотні для створення нотатки</span>
                </div>
            `;

            parentEl.appendChild(container);

            canvas = container.querySelector('.board-canvas');
            ctx = canvas.getContext('2d');
            nodesLayer = container.querySelector('.board-nodes-layer');
            searchInput = container.querySelector('#board-search-input');

            this.bindEvents();
        },

        resizeCanvas() {
            if (!canvas || !container) return;
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';

            if (ctx) {
                ctx.resetTransform();
                ctx.scale(dpr, dpr);
            }
        },

        buildBoardData() {
            const state = window.App.state;
            if (!state || !state.notes) return;

            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            const boardNotes = state.notes.filter(n => n.boardId === currentBoard.id);
            const notesMap = new Map();
            boardNotes.forEach(n => notesMap.set(n.id, n));

            if (nodesLayer) nodesLayer.innerHTML = '';
            nodes = [];
            edges = [];

            const interaction = window.App.boardInteraction;
            const cardWidth = 380;
            const levelGapX = 420;
            const siblingGapY = 24;

            let rootIdx = 0;
            let currentRootY = 120;

            boardNotes.forEach((note) => {
                const isRoot = !note.parentId || !notesMap.has(note.parentId);
                const hasChildren = boardNotes.some(child => child.parentId === note.id);
                const isOrphan = isRoot && !hasChildren;

                let posX = note.boardX !== undefined ? note.boardX : (100 + (rootIdx * 40));
                let posY = note.boardY !== undefined ? note.boardY : currentRootY;

                if (note.boardX === undefined && isRoot) {
                    currentRootY += 220;
                    rootIdx++;
                }

                const branchColor = getBranchColor(note.parentId || note.id, rootIdx);

                const nodeObj = {
                    id: note.id,
                    note: note,
                    title: note.title || '',
                    content: note.content || '',
                    tags: note.tags || [],
                    isRoot: isRoot,
                    isOrphan: isOrphan,
                    x: posX,
                    y: posY,
                    color: branchColor,
                    element: null
                };

                if (nodesLayer && window.App.stickerCard) {
                    const card = window.App.stickerCard.createCard(note, 0);
                    card.style.position = 'absolute';
                    card.style.left = posX + 'px';
                    card.style.top = posY + 'px';
                    card.dataset.boardNodeId = note.id;

                    this.attachCardDragEvents(card, nodeObj);
                    nodesLayer.appendChild(card);
                    nodeObj.element = card;
                }

                nodes.push(nodeObj);
            });

            // Будуємо ієрархічні зв'язки
            nodes.forEach(node => {
                if (node.note.parentId && notesMap.has(node.note.parentId)) {
                    const parentNode = nodes.find(n => n.id === node.note.parentId);
                    if (parentNode) {
                        edges.push({
                            id: `hier-${parentNode.id}-${node.id}`,
                            source: parentNode.id,
                            target: node.id,
                            type: 'hierarchy',
                            color: parentNode.color,
                            sourceNode: parentNode,
                            targetNode: node
                        });
                    }
                }
            });

            // Зв'язки спільних тегів (якщо увімкнено)
            if (showTagLinks) {
                const tagMap = new Map();
                nodes.forEach(node => {
                    if (node.tags && Array.isArray(node.tags)) {
                        node.tags.forEach(tag => {
                            const tagText = typeof tag === 'string' ? tag : (tag.text || '');
                            if (!tagText) return;
                            if (!tagMap.has(tagText)) tagMap.set(tagText, []);
                            tagMap.get(tagText).push(node);
                        });
                    }
                });

                tagMap.forEach((tagNodes, tagText) => {
                    if (tagNodes.length > 1) {
                        for (let i = 0; i < tagNodes.length; i++) {
                            for (let j = i + 1; j < tagNodes.length; j++) {
                                const n1 = tagNodes[i];
                                const n2 = tagNodes[j];
                                edges.push({
                                    id: `tag-${n1.id}-${n2.id}-${tagText}`,
                                    source: n1.id,
                                    target: n2.id,
                                    type: 'tag',
                                    tag: tagText,
                                    color: '#f59e0b',
                                    sourceNode: n1,
                                    targetNode: n2
                                });
                            }
                        }
                    }
                });
            }

            const counterEl = container ? container.querySelector('#board-nodes-counter') : null;
            if (counterEl) counterEl.textContent = `${nodes.length} стікерів`;

            const orphansEl = container ? container.querySelector('#board-orphans-counter') : null;
            if (orphansEl) orphansEl.textContent = String(nodes.filter(n => n.isOrphan).length);
        },

        attachCardDragEvents(cardEl, node) {
            const handle = cardEl.querySelector('.sticker-header') || cardEl;

            handle.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.sticker-menu-trigger') || e.target.closest('button') || e.target.closest('input') || e.target.closest('[contenteditable="true"]')) {
                    return;
                }
                e.stopPropagation();

                isDraggingNode = true;
                draggedNode = node;

                const interaction = window.App.boardInteraction;
                const world = interaction.screenToWorld(e.clientX, e.clientY, canvas);
                node.dragOffsetX = world.x - node.x;
                node.dragOffsetY = world.y - node.y;

                cardEl.classList.add('is-dragging');
            });
        },

        bindEvents() {
            const interaction = window.App.boardInteraction;

            // Зум та панорамування полотна
            canvas.addEventListener('pointerdown', (e) => {
                if (e.button === 2) return; // правий клік обробляється окремо
                isDraggingCanvas = true;
                startMousePos = { x: e.clientX, y: e.clientY };
                lastMousePos = { x: e.clientX, y: e.clientY };
            });

            boundPointerMove = (e) => {
                if (isDraggingNode && draggedNode) {
                    const world = interaction.screenToWorld(e.clientX, e.clientY, canvas);
                    draggedNode.x = world.x - (draggedNode.dragOffsetX || 0);
                    draggedNode.y = world.y - (draggedNode.dragOffsetY || 0);

                    if (draggedNode.element) {
                        draggedNode.element.style.left = draggedNode.x + 'px';
                        draggedNode.element.style.top = draggedNode.y + 'px';
                    }
                    this.draw();
                } else if (isDraggingCanvas) {
                    const dx = e.clientX - lastMousePos.x;
                    const dy = e.clientY - lastMousePos.y;
                    interaction.camera.x += dx;
                    interaction.camera.y += dy;
                    lastMousePos = { x: e.clientX, y: e.clientY };
                    this.draw();
                }
            };

            boundPointerUp = () => {
                if (isDraggingNode && draggedNode) {
                    if (draggedNode.element) {
                        draggedNode.element.classList.remove('is-dragging');
                    }
                    this.saveNodePosition(draggedNode);
                    isDraggingNode = false;
                    draggedNode = null;
                }
                isDraggingCanvas = false;
            };

            boundWheel = (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1.1 : 0.9;
                interaction.zoomAt(delta, e.clientX, e.clientY, canvas);
                this.draw();
            };

            boundCanvasContextMenu = (e) => {
                e.preventDefault();
                const world = interaction.screenToWorld(e.clientX, e.clientY, canvas);
                if (window.App.boardContextMenu) {
                    window.App.boardContextMenu.show(e.clientX, e.clientY, world.x, world.y, {
                        onCreateNote: (wx, wy) => this.createNoteAtWorldPosition(wx, wy),
                        onAutoLayout: () => this.runAutoLayout(),
                        onResetZoom: () => {
                            interaction.resetCamera(canvas);
                            this.draw();
                        }
                    });
                }
            };

            window.addEventListener('pointermove', boundPointerMove);
            window.addEventListener('pointerup', boundPointerUp);
            canvas.addEventListener('wheel', boundWheel, { passive: false });
            canvas.addEventListener('contextmenu', boundCanvasContextMenu);

            boundResize = () => {
                this.resizeCanvas();
                this.draw();
            };
            window.addEventListener('resize', boundResize);

            // Кнопки тулбара
            const layoutBtn = container.querySelector('#board-auto-layout-btn');
            if (layoutBtn) {
                layoutBtn.addEventListener('click', () => this.runAutoLayout());
            }

            const orphansBtn = container.querySelector('#board-filter-orphans');
            if (orphansBtn) {
                orphansBtn.addEventListener('click', () => {
                    isOrphansOnly = !isOrphansOnly;
                    orphansBtn.classList.toggle('is-active', isOrphansOnly);
                    this.applyFilters();
                });
            }

            const tagLinksBtn = container.querySelector('#board-toggle-tag-links');
            if (tagLinksBtn) {
                tagLinksBtn.addEventListener('click', () => {
                    showTagLinks = !showTagLinks;
                    tagLinksBtn.classList.toggle('is-active', showTagLinks);
                    this.buildBoardData();
                    this.draw();
                });
            }

            // Пошук
            if (searchInput) {
                const clearBtn = container.querySelector('#board-search-clear-btn');
                const searchIcon = container.querySelector('#board-search-icon-right');

                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
                    if (searchIcon) searchIcon.style.display = searchQuery ? 'none' : 'flex';
                    this.applyFilters();
                });

                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        searchInput.value = '';
                        searchQuery = '';
                        clearBtn.style.display = 'none';
                        if (searchIcon) searchIcon.style.display = 'flex';
                        this.applyFilters();
                    });
                }
            }

            // Зум кнопки
            const zoomInBtn = container.querySelector('#board-zoom-in');
            const zoomOutBtn = container.querySelector('#board-zoom-out');
            const zoomResetBtn = container.querySelector('#board-zoom-reset');

            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', () => {
                    const rect = canvas.getBoundingClientRect();
                    interaction.zoomAt(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2, canvas);
                    this.draw();
                });
            }
            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', () => {
                    const rect = canvas.getBoundingClientRect();
                    interaction.zoomAt(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2, canvas);
                    this.draw();
                });
            }
            if (zoomResetBtn) {
                zoomResetBtn.addEventListener('click', () => {
                    interaction.resetCamera(canvas);
                    this.draw();
                });
            }
        },

        saveNodePosition(node) {
            if (!node || !node.id) return;
            const state = window.App.state;
            if (!state || !state.notes) return;

            const n = state.notes.find(item => item.id === node.id);
            if (n) {
                n.boardX = Math.round(node.x);
                n.boardY = Math.round(node.y);
                if (window.App.storage) {
                    window.App.storage.saveNotes(state.notes);
                }
            }
        },

        runAutoLayout() {
            if (window.App.boardLayout) {
                window.App.boardLayout.autoLayout(nodes, edges, {
                    onUpdate: () => this.draw(),
                    onComplete: () => {
                        nodes.forEach(n => this.saveNodePosition(n));
                        this.draw();
                    }
                });
            }
        },

        createNoteAtWorldPosition(worldX, worldY) {
            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            if (window.App.noteManager && window.App.noteManager.createNote) {
                const newNote = window.App.noteManager.createNote(currentBoard.id, null, 'Нова нотатка');
                if (newNote) {
                    newNote.boardX = Math.round(worldX);
                    newNote.boardY = Math.round(worldY);
                    const state = window.App.state;
                    if (state && window.App.storage) {
                        window.App.storage.saveNotes(state.notes);
                    }
                    this.buildBoardData();
                    this.draw();
                }
            }
        },

        applyFilters() {
            nodes.forEach(node => {
                if (!node.element) return;
                const matchSearch = !searchQuery || node.title.toLowerCase().includes(searchQuery) || node.content.toLowerCase().includes(searchQuery);
                const matchOrphan = !isOrphansOnly || node.isOrphan;
                const matchTag = !activeTagFilter || (node.tags && node.tags.some(t => (typeof t === 'string' ? t : (t.text || '')) === activeTagFilter));

                const isMatch = matchSearch && matchOrphan && matchTag;
                node.element.classList.toggle('is-faded', !isMatch);
                node.element.classList.toggle('is-match', isMatch && (searchQuery || isOrphansOnly || activeTagFilter));
            });
            this.draw();
        },

        draw() {
            if (!ctx || !canvas) return;

            const interaction = window.App.boardInteraction;
            const camera = interaction.camera;
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            ctx.clearRect(0, 0, width, height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-width / 2, -height / 2);

            // Малюємо сітку фонових точок
            const gridSize = 40;
            const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize;
            const endX = startX + (width / camera.zoom) + gridSize * 2;
            const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize;
            const endY = startY + (height / camera.zoom) + gridSize * 2;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            for (let x = startX; x <= endX; x += gridSize) {
                for (let y = startY; y <= endY; y += gridSize) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Оновлюємо шляхи та малюємо кабелі
            if (window.App.boardCables) {
                edges.forEach(edge => {
                    edge.cachedPath = window.App.boardCables.calculatePath(edge.sourceNode, edge.targetNode);
                });
                window.App.boardCables.drawCables(ctx, edges, camera, {
                    draggedNode: draggedNode,
                    activeTagFilter: activeTagFilter
                });
            }

            // Трансформуємо шар HTML-карток синхронно з камерою
            if (nodesLayer) {
                nodesLayer.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom}) translate(${-width / 2}px, ${-height / 2}px)`;
            }

            ctx.restore();
        },

        cleanup() {
            if (boundPointerMove) {
                window.removeEventListener('pointermove', boundPointerMove);
                boundPointerMove = null;
            }
            if (boundPointerUp) {
                window.removeEventListener('pointerup', boundPointerUp);
                boundPointerUp = null;
            }
            if (boundResize) {
                window.removeEventListener('resize', boundResize);
                boundResize = null;
            }
            if (canvas && boundWheel) {
                canvas.removeEventListener('wheel', boundWheel);
                boundWheel = null;
            }
            if (canvas && boundCanvasContextMenu) {
                canvas.removeEventListener('contextmenu', boundCanvasContextMenu);
                boundCanvasContextMenu = null;
            }
            if (window.App.boardContextMenu) {
                window.App.boardContextMenu.close();
            }
            nodes = [];
            edges = [];
            draggedNode = null;
            isDraggingNode = false;
            isDraggingCanvas = false;
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
        }
    };
})();
