// js/board/boardView.js - Головний контролер інтерактивної дошки стікерів (Canvas Sticky Board)
window.App = window.App || {};

(function() {
    let container = null;
    let canvas = null;
    let ctx = null;
    let nodesLayer = null;
    let searchInput = null;

    let nodes = [];
    let edges = [];

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
                    <button class="board-ctrl-btn" id="board-zoom-reset" title="Вирівняти та центрувати">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>

                <div class="board-legend-pill">
                    <span>💡 Перетягуйте картки за шапку</span>
                    <span>•</span>
                    <span>Правий клік для створення нової нотатки</span>
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

        buildBoardData(options = {}) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const allNotes = noteManager ? noteManager.getAllNotes() : (state ? state.notes || [] : []);

            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            const boardNotes = allNotes.filter(n => String(n.boardId) === String(currentBoard.id));
            const notesMap = new Map();
            boardNotes.forEach(n => notesMap.set(n.id, n));

            if (nodesLayer) nodesLayer.innerHTML = '';
            nodes = [];
            edges = [];

            let anyMissingPosition = false;

            boardNotes.forEach((note, idx) => {
                const isRoot = !note.parentId || !notesMap.has(note.parentId);
                const hasChildren = boardNotes.some(child => child.parentId === note.id);
                const isOrphan = isRoot && !hasChildren;

                let posX = 0;
                let posY = 0;

                const rawX = typeof note.canvasX === 'number' ? note.canvasX : (typeof note.boardX === 'number' ? note.boardX : null);
                const rawY = typeof note.canvasY === 'number' ? note.canvasY : (typeof note.boardY === 'number' ? note.boardY : null);

                if (rawX !== null && rawY !== null) {
                    posX = rawX;
                    posY = rawY;
                } else {
                    anyMissingPosition = true;
                }

                const branchColor = getBranchColor(note.parentId || note.id, idx);

                const nodeObj = {
                    id: note.id,
                    note: note,
                    title: note.title || '',
                    content: note.content || '',
                    tags: noteManager ? noteManager.getNoteTags(note) : (note.tags || []),
                    isRoot: isRoot,
                    isOrphan: isOrphan,
                    parentId: note.parentId || null,
                    x: posX,
                    y: posY,
                    width: 380,
                    height: 140,
                    color: branchColor,
                    element: null
                };

                if (nodesLayer && window.App.stickerCard) {
                    const card = window.App.stickerCard.createCard(note, 0);
                    card.style.position = 'absolute';
                    card.style.left = posX + 'px';
                    card.style.top = posY + 'px';
                    card.dataset.boardNodeId = note.id;

                    this.attachCardDrag(card, nodeObj);
                    if (window.App.boardConnect) {
                        window.App.boardConnect.attachConnectionHandles(card, nodeObj, this);
                    }
                    nodesLayer.appendChild(card);
                    nodeObj.element = card;
                    if (card.offsetWidth > 0) {
                        nodeObj.width = card.offsetWidth;
                        nodeObj.height = card.offsetHeight;
                    }
                }

                nodes.push(nodeObj);
            });

            // Ієрархічні зв'язки
            nodes.forEach(node => {
                if (node.parentId && notesMap.has(node.parentId)) {
                    const parentNode = nodes.find(n => n.id === node.parentId);
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

            // Зв'язки спільних тегів
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

            if (anyMissingPosition && window.App.boardLayout) {
                window.App.boardLayout.autoLayout(nodes, edges, {
                    animate: false,
                    onUpdate: () => this.draw(),
                    onComplete: () => {
                        nodes.forEach(n => this.saveNodePosition(n));
                        if (!options || !options.preserveCamera) {
                            this.centerCameraOnAllNodes();
                        } else {
                            this.draw();
                        }
                    }
                });
            } else {
                if (!options || !options.preserveCamera) {
                    this.centerCameraOnAllNodes();
                } else {
                    this.draw();
                }
            }
        },

        centerCameraOnAllNodes() {
            if (nodes.length === 0 || !canvas || !container) {
                if (canvas && container) {
                    const rect = container.getBoundingClientRect();
                    window.App.boardInteraction.initCamera(rect.width, rect.height);
                    this.draw();
                }
                return;
            }

            const rect = container.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                const nw = n.width || (n.element ? (n.element.offsetWidth || 380) : 380);
                const nh = n.height || (n.element ? (n.element.offsetHeight || 140) : 140);
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x + nw);
                maxY = Math.max(maxY, n.y + nh);
            });

            const bboxW = Math.max(100, maxX - minX);
            const bboxH = Math.max(100, maxY - minY);
            const padding = 100;

            const interaction = window.App.boardInteraction;
            const targetZoom = Math.max(interaction.camera.minZoom, Math.min(1.0, Math.min((w - padding * 2) / bboxW, (h - padding * 2) / bboxH)));
            const bboxCenterX = minX + bboxW / 2;
            const bboxCenterY = minY + bboxH / 2;

            interaction.camera.x = (w / 2) - (bboxCenterX - (w / 2)) * targetZoom;
            interaction.camera.y = (h / 2) - (bboxCenterY - (h / 2)) * targetZoom;
            interaction.camera.zoom = targetZoom;

            this.draw();
        },

        attachCardDrag(cardEl, node) {
            cardEl.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.board-connect-handle')) {
                    return;
                }
                if (e.button !== 0) return;

                // Shift + ЛКМ: виділення нотатки (додавання/зняття з мульти-вибору)
                if (e.shiftKey) {
                    e.stopPropagation();
                    e.preventDefault();
                    this.handleShiftSelect(node.id);
                    return;
                }

                if (e.target.closest('.sticker-title, .sticker-content, button, input, .sticker-menu-dropdown, .sticker-tag-dropdown, .sticker-emoji-picker-dropdown, .color-swatch-btn, a, .subnote-preview-item')) {
                    return;
                }
                e.stopPropagation();

                isDraggingNode = true;
                draggedNode = node;
                const startX = e.clientX;
                const startY = e.clientY;

                cardEl.classList.add('is-dragging');

                const interaction = window.App.boardInteraction;

                // Групове перетягування якщо виділено декілька нотаток
                const state = window.App.state;
                const isMulti = state && state.selectedWorkspaceNoteIds && state.selectedWorkspaceNoteIds.has(node.id) && state.selectedWorkspaceNoteIds.size > 1;
                const dragNodes = isMulti
                    ? nodes.filter(n => state.selectedWorkspaceNoteIds.has(n.id))
                    : [node];
                const initialPositions = dragNodes.map(n => ({ node: n, x: n.x, y: n.y }));

                dragNodes.forEach(n => {
                    if (n.element) n.element.classList.add('is-dragging');
                });

                const onMove = (ev) => {
                    const dx = (ev.clientX - startX) / interaction.camera.zoom;
                    const dy = (ev.clientY - startY) / interaction.camera.zoom;
                    initialPositions.forEach(item => {
                        item.node.x = item.x + dx;
                        item.node.y = item.y + dy;
                        if (item.node.element) {
                            item.node.element.style.left = item.node.x + 'px';
                            item.node.element.style.top = item.node.y + 'px';
                        }
                    });
                    this.draw();
                };

                const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                    dragNodes.forEach(n => {
                        if (n.element) n.element.classList.remove('is-dragging');
                        this.saveNodePosition(n);
                    });
                    isDraggingNode = false;
                    draggedNode = null;
                };

                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
            });
        },

        handleShiftSelect(noteId) {
            const selBar = window.App.workspaceSelectionBar;
            const state = window.App.state;
            if (!selBar || !state) return;

            if (!state.isWorkspaceSelectMode) {
                selBar.enterSelectMode();
            }
            selBar.toggleNoteSelection(noteId);

            if (state.selectedWorkspaceNoteIds.size === 0) {
                selBar.exitSelectMode();
            }
        },

        bindEvents() {
            const interaction = window.App.boardInteraction;

            canvas.addEventListener('pointerdown', (e) => {
                if (e.button === 2) return;
                isDraggingCanvas = true;
                startMousePos = { x: e.clientX, y: e.clientY };
                lastMousePos = { x: e.clientX, y: e.clientY };
            });

            boundPointerMove = (e) => {
                if (window.App.boardConnect && window.App.boardConnect.isConnecting()) {
                    window.App.boardConnect.handleConnectingMove(e, this);
                    return;
                }
                if (isDraggingCanvas) {
                    const dx = e.clientX - lastMousePos.x;
                    const dy = e.clientY - lastMousePos.y;
                    interaction.camera.x += dx;
                    interaction.camera.y += dy;
                    lastMousePos = { x: e.clientX, y: e.clientY };
                    this.draw();
                }
            };

            boundPointerUp = (e) => {
                if (window.App.boardConnect && window.App.boardConnect.isConnecting()) {
                    window.App.boardConnect.handleConnectingUp(e, this);
                    return;
                }
                if (isDraggingCanvas && startMousePos) {
                    const dx = Math.abs(e.clientX - startMousePos.x);
                    const dy = Math.abs(e.clientY - startMousePos.y);
                    if (dx < 5 && dy < 5 && !e.shiftKey) {
                        const state = window.App.state;
                        if (state && state.isWorkspaceSelectMode && window.App.workspaceSelectionBar) {
                            window.App.workspaceSelectionBar.exitSelectMode();
                        }
                    }
                }
                isDraggingCanvas = false;
            };

            boundWheel = (e) => {
                e.preventDefault();
                if (e.target.closest('input, textarea, button')) {
                    if (!e.ctrlKey && !e.metaKey) return;
                }
                const isTrackpadPinch = (e.ctrlKey || e.metaKey) && e.deltaMode === 0 && Math.abs(e.deltaY) < 50;
                const delta = isTrackpadPinch
                    ? Math.exp(-e.deltaY * 0.005)
                    : (e.deltaY < 0 ? 1.1 : 0.9);
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
                        onResetZoom: () => this.centerCameraOnAllNodes()
                    });
                }
            };

            window.addEventListener('pointermove', boundPointerMove);
            window.addEventListener('pointerup', boundPointerUp);
            container.addEventListener('wheel', boundWheel, { passive: false });
            canvas.addEventListener('contextmenu', boundCanvasContextMenu);

            boundResize = () => {
                this.resizeCanvas();
                this.draw();
            };
            window.addEventListener('resize', boundResize);

            // Кнопки тулбара
            const layoutBtn = container.querySelector('#board-auto-layout-btn');
            if (layoutBtn) layoutBtn.addEventListener('click', () => this.runAutoLayout());

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
                zoomResetBtn.addEventListener('click', () => this.centerCameraOnAllNodes());
            }
        },

        saveNodePosition(node) {
            if (!node || !node.id) return;
            const state = window.App.state;
            if (!state || !state.notes) return;

            const n = state.notes.find(item => item.id === node.id);
            if (n) {
                n.canvasX = Math.round(node.x);
                n.canvasY = Math.round(node.y);
                n.boardX = Math.round(node.x);
                n.boardY = Math.round(node.y);
                if (window.App.storage) {
                    window.App.storage.saveNotes(state.notes);
                }
                if (window.App.cloudSync && window.App.cloudSync.syncNote) {
                    window.App.cloudSync.syncNote(n);
                }
            }
        },

        runAutoLayout() {
            if (window.App.boardLayout) {
                window.App.boardLayout.autoLayout(nodes, edges, {
                    animate: true,
                    onUpdate: () => this.draw(),
                    onComplete: () => {
                        nodes.forEach(n => this.saveNodePosition(n));
                        this.centerCameraOnAllNodes();
                    }
                });
            }
        },

        createNoteAtWorldPosition(worldX, worldY) {
            const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
            if (!currentBoard) return;

            if (window.App.noteManager && window.App.noteManager.createNewNote) {
                const newNote = window.App.noteManager.createNewNote(null, false);
                if (newNote) {
                    newNote.canvasX = Math.round(worldX - 190);
                    newNote.canvasY = Math.round(worldY - 70);
                    newNote.boardX = newNote.canvasX;
                    newNote.boardY = newNote.canvasY;
                    const state = window.App.state;
                    if (state && window.App.storage) {
                        window.App.storage.saveNotes(state.notes);
                    }
                    this.buildBoardData();
                }
            }
        },

        createSubnoteForNode(parentId) {
            const parentNode = nodes.find(n => n.id === parentId);
            if (!parentNode) return;

            const state = window.App.state;
            const noteManager = window.App.noteManager;
            if (!noteManager) return;

            const newNote = noteManager.createNewNote(parentId, false);
            if (!newNote) return;

            const existingChildren = nodes.filter(n => n.parentId === parentId);
            const ph = parentNode.element ? (parentNode.element.offsetHeight || 140) : 140;

            // Розміщуємо нову піднотатку вертикально під батьківською карткою
            newNote.canvasX = parentNode.x + (existingChildren.length * 30);
            newNote.canvasY = parentNode.y + ph + 40 + (existingChildren.length * 150);
            newNote.boardX = newNote.canvasX;
            newNote.boardY = newNote.canvasY;

            if (window.App.storage) {
                window.App.storage.saveNotes(state.notes);
            }

            this.buildBoardData();
            this.draw();

            setTimeout(() => {
                if (nodesLayer) {
                    const newCard = nodesLayer.querySelector(`.note-sticker[data-note-id="${newNote.id}"]`);
                    if (newCard) {
                        const titleEl = newCard.querySelector('.sticker-title');
                        if (titleEl) titleEl.focus();
                    }
                }
            }, 80);
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

            // Оновлення режиму низької деталізації (LOD) при сильному віддаленні камери
            if (container) {
                container.classList.toggle('board-lod-compact', camera.zoom < 0.45);
            }

            // Viewport Culling: приховуємо картки за межами екрану для максимальної швидкодії DOM
            this.updateViewportCulling(width, height, camera);

            ctx.clearRect(0, 0, width, height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-width / 2, -height / 2);

            // Малюємо сітку фонових точок
            const gridSize = 40;
            const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize - gridSize;
            const endX = Math.ceil(((width - camera.x) / camera.zoom) / gridSize) * gridSize + gridSize;
            const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize - gridSize;
            const endY = Math.ceil(((height - camera.y) / camera.zoom) / gridSize) * gridSize + gridSize;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            for (let x = startX; x <= endX; x += gridSize) {
                for (let y = startY; y <= endY; y += gridSize) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Малюємо кабелі
            if (window.App.boardCables) {
                edges.forEach(edge => {
                    edge.cachedPath = window.App.boardCables.calculatePath(edge.sourceNode, edge.targetNode);
                });
                window.App.boardCables.drawCables(ctx, edges, camera, {
                    draggedNode: draggedNode,
                    activeTagFilter: activeTagFilter
                });

                // Малюємо активний кабель створення зв'язку від плюсика
                const connectState = window.App.boardConnect ? window.App.boardConnect.getState() : null;
                if (connectState && connectState.isConnecting && connectState.startPos && connectState.currentPos && window.App.boardCables.drawDraftCable) {
                    window.App.boardCables.drawDraftCable(
                        ctx,
                        connectState.startPos,
                        connectState.currentPos,
                        connectState.targetNode,
                        connectState.isValid,
                        connectState.sourceSide,
                        camera
                    );
                }
            }

            // Синхронізація шару карток (округлення цілих пікселів для запобігання розмиттю тексту)
            if (nodesLayer) {
                const tx = Math.round(camera.x);
                const ty = Math.round(camera.y);
                const cx = Math.round(-width / 2);
                const cy = Math.round(-height / 2);
                nodesLayer.style.transform = `translate(${tx}px, ${ty}px) scale(${camera.zoom}) translate(${cx}px, ${cy}px)`;
            }

            ctx.restore();
        },

        updateViewportCulling(width, height, camera) {
            if (!nodes || nodes.length === 0) return;

            // Світові межі видимого екрану камери
            const worldLeft = (0 - camera.x) / camera.zoom + (width / 2);
            const worldTop = (0 - camera.y) / camera.zoom + (height / 2);
            const worldRight = (width - camera.x) / camera.zoom + (width / 2);
            const worldBottom = (height - camera.y) / camera.zoom + (height / 2);

            // Запас 250px у світових одиницях, щоб картки з'являлись плавно без раптового виринання
            const buffer = 250 / camera.zoom;
            const minX = Math.min(worldLeft, worldRight) - buffer;
            const maxX = Math.max(worldLeft, worldRight) + buffer;
            const minY = Math.min(worldTop, worldBottom) - buffer;
            const maxY = Math.max(worldTop, worldBottom) + buffer;

            const activeEl = document.activeElement;
            const connectState = window.App.boardConnect ? window.App.boardConnect.getState() : null;

            nodes.forEach(node => {
                if (!node.element) return;

                // Кешуємо розміри, поки картка видима в DOM
                if (node.element.offsetWidth > 0) {
                    node.width = node.element.offsetWidth;
                    node.height = node.element.offsetHeight;
                }
                const nw = node.width || 380;
                const nh = node.height || 140;

                // Перевірка AABB перетину картки з видимим вікном
                const inViewport = (
                    (node.x + nw) >= minX &&
                    node.x <= maxX &&
                    (node.y + nh) >= minY &&
                    node.y <= maxY
                );

                // Якщо картка перетягується, з'єднується або містить поточний фокус редагування — не приховуємо її
                const isDraggingThis = isDraggingNode && draggedNode === node;
                const isConnectingThis = connectState && connectState.isConnecting && (connectState.sourceNode === node || connectState.targetNode === node);
                const hasFocus = activeEl && node.element.contains(activeEl);

                const shouldShow = inViewport || isDraggingThis || isConnectingThis || hasFocus;
                const targetDisplay = shouldShow ? '' : 'none';

                if (node.element.style.display !== targetDisplay) {
                    node.element.style.display = targetDisplay;
                }
            });
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
            if (container && boundWheel) {
                container.removeEventListener('wheel', boundWheel);
                boundWheel = null;
            } else if (canvas && boundWheel) {
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
            if (container) {
                container.classList.remove('board-lod-compact');
                container.classList.remove('is-connecting-mode');
            }
            if (window.App.boardConnect) {
                window.App.boardConnect.reset();
            }
            if (window.App.state && window.App.state.isWorkspaceSelectMode && window.App.workspaceSelectionBar) {
                window.App.workspaceSelectionBar.exitSelectMode();
            }
            nodes = [];
            edges = [];
            draggedNode = null;
            isDraggingNode = false;
            isDraggingCanvas = false;
        },

        getContainer() {
            return container;
        },

        getCanvas() {
            return canvas;
        },

        getNodes() {
            return nodes;
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
