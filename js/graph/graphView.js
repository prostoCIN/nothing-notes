// js/graph/graphView.js - Головний контролер інтерактивного графа зв'язків (Obsidian Graph View)
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
    let isRunning = false;

    let isDraggingCanvas = false;
    let isDraggingNode = false;
    let draggedNode = null;
    let hoveredNode = null;
    let lastMousePos = { x: 0, y: 0 };
    let searchQuery = '';

    let isOrphansOnly = false;
    let showTagLinks = true;
    let showBookmarkLinks = true;
    let activeTagFilter = null;
    let cachedSubtreeIds = null;

    let boundPointerMove = null;
    let boundPointerUp = null;
    let boundResize = null;
    let boundWheel = null;
    let boundTouchStart = null;
    let boundTouchMove = null;
    let boundTouchEnd = null;
    let isPinching = false;
    let touchPinchDist = 0;
    let touchPinchCenter = null;

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

    window.App.graphView = {
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
                                    <circle cx="6" cy="6" r="3"></circle>
                                    <circle cx="18" cy="6" r="3"></circle>
                                    <circle cx="12" cy="18" r="3"></circle>
                                    <line x1="8.5" y1="7.5" x2="10.5" y2="15.5"></line>
                                    <line x1="15.5" y1="7.5" x2="13.5" y2="15.5"></line>
                                </svg>
                            </span>
                            <span class="graph-title-text">${currentBoard.name}</span>
                            <span class="graph-nodes-count" id="graph-nodes-counter">0 вузлів</span>
                        </div>

                        <div class="graph-toolbar-filters">
                            <button class="graph-toolbar-filter-btn is-orphans-btn" id="graph-filter-orphans" title="Показати лише ізольовані нотатки">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="3.5" fill="currentColor"></circle>
                                    <circle cx="12" cy="12" r="8" stroke-dasharray="2 3"></circle>
                                </svg>
                                <span>Острови</span>
                                <span class="graph-nodes-count" id="graph-orphans-counter" style="border:none;padding:0;">0</span>
                            </button>
                            <button class="graph-toolbar-filter-btn is-active" id="graph-toggle-tag-links" title="Увімкнути/вимкнути зв'язки спільних тегів">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                <span>Зв'язки тегів</span>
                            </button>
                            <button class="graph-toolbar-filter-btn is-active" id="graph-toggle-bookmark-links" title="Увімкнути/вимкнути зв'язки закладок">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                                </svg>
                                <span>Закладки</span>
                            </button>
                        </div>
                    </div>

                    <div class="graph-top-actions">
                        <div class="graph-search-box">
                            <input type="text" class="graph-search-input" id="graph-search-input" placeholder="Пошук у графі..." autocomplete="off">
                            <span class="graph-search-icon-right" id="graph-search-icon-right">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <button class="graph-search-clear-btn" id="graph-search-clear-btn" style="display: none;">✕</button>
                        </div>
                        <button class="graph-export-btn" id="graph-export-btn" title="Експорт графу для ШІ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>Експорт</span>
                        </button>
                    </div>
                </div>

                <canvas class="graph-canvas"></canvas>
                <div class="graph-nodes-layer"></div>

                <div class="graph-controls-panel">
                    <button class="graph-ctrl-btn" id="graph-zoom-in" title="Збільшити (+)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="graph-ctrl-btn" id="graph-zoom-out" title="Зменшити (-)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="graph-ctrl-btn" id="graph-zoom-reset" title="Скинути положення">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>

                <div class="graph-legend-pill">
                    <span>💡 Клікніть на вузол для переходу до нотатки</span>
                    <span>•</span>
                    <span>Наведення підсвічує зв'язки</span>
                </div>
            `;

            parentEl.appendChild(container);

            canvas = container.querySelector('.graph-canvas');
            ctx = canvas.getContext('2d');
            nodesLayer = container.querySelector('.graph-nodes-layer');
            searchInput = container.querySelector('#graph-search-input');

            if (window.App.graphPreview) {
                window.App.graphPreview.init(container);
            }

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

        buildGraphData() {
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

            const rect = container ? container.getBoundingClientRect() : { width: 800, height: 600 };
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const total = boardNotes.length;

            const interaction = window.App.graphInteraction;
            interaction.initCamera(rect.width, rect.height);

            boardNotes.forEach((note, idx) => {
                const angle = (idx / (total || 1)) * Math.PI * 2;
                const dist = 50 + (idx % 4) * 45;
                const isRoot = !note.parentId || !notesMap.has(note.parentId);
                const hasChildren = boardNotes.some(child => child.parentId === note.id);
                const hasBookmarks = (Array.isArray(note.linkedNoteIds) && note.linkedNoteIds.length > 0)
                    || boardNotes.some(other => Array.isArray(other.linkedNoteIds) && other.linkedNoteIds.includes(note.id));
                const isOrphan = isRoot && !hasChildren && !hasBookmarks;

                const posX = centerX + Math.cos(angle) * dist;
                const posY = centerY + Math.sin(angle) * dist;
                const branchColor = getBranchColor(note.parentId || note.id, idx);

                const nodeObj = {
                    id: note.id,
                    note: note,
                    title: note.title || 'Нотатка',
                    content: note.content || '',
                    tags: noteManager ? noteManager.getNoteTags(note) : (note.tags || []),
                    isRoot: isRoot,
                    isOrphan: isOrphan,
                    parentId: note.parentId || null,
                    x: posX,
                    y: posY,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    color: branchColor,
                    element: null
                };

                if (nodesLayer) {
                    const nodeEl = document.createElement('div');
                    nodeEl.className = 'graph-html-node' + (isRoot ? ' is-root' : '') + (isOrphan ? ' is-orphan' : '');
                    nodeEl.style.setProperty('--node-branch-color', branchColor);

                    const icon = note.icon || '📄';
                    nodeEl.innerHTML = `
                        <div class="graph-html-node-circle" style="border-color: ${branchColor}; background: ${branchColor}22;">
                            ${icon}
                        </div>
                        <div class="graph-html-node-label">${nodeObj.title}</div>
                    `;

                    this.attachNodeEvents(nodeEl, nodeObj);
                    nodesLayer.appendChild(nodeEl);
                    nodeObj.element = nodeEl;
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

            // Зв'язки закладок (Bookmarks) — пунктирні зв'язки смарагдового кольору
            if (showBookmarkLinks) {
                const addedBookmarkPairs = new Set();
                nodes.forEach(node => {
                    const noteObj = node.note;
                    const linkedIds = Array.isArray(noteObj.linkedNoteIds) ? noteObj.linkedNoteIds : [];
                    linkedIds.forEach(targetId => {
                        if (targetId && targetId !== node.id && notesMap.has(targetId)) {
                            const targetNode = nodes.find(n => n.id === targetId);
                            if (targetNode) {
                                const pairKey = `bm-${node.id}-${targetNode.id}`;
                                if (!addedBookmarkPairs.has(pairKey)) {
                                    addedBookmarkPairs.add(pairKey);
                                    edges.push({
                                        id: pairKey,
                                        source: node.id,
                                        target: targetNode.id,
                                        type: 'bookmark',
                                        color: '#10b981',
                                        sourceNode: node,
                                        targetNode: targetNode
                                    });
                                }
                            }
                        }
                    });
                });
            }

            const counterEl = container ? container.querySelector('#graph-nodes-counter') : null;
            if (counterEl) counterEl.textContent = `${nodes.length} вузлів`;

            const orphansEl = container ? container.querySelector('#graph-orphans-counter') : null;
            if (orphansEl) orphansEl.textContent = String(nodes.filter(n => n.isOrphan).length);
        },

        attachNodeEvents(nodeEl, node) {
            nodeEl.style.pointerEvents = 'auto';
            nodeEl.style.cursor = 'grab';

            let isDraggingThis = false;
            let hasDragged = false;
            let dragThresholdPassed = false;
            let startPointerX = 0;
            let startPointerY = 0;
            let startNodeX = 0;
            let startNodeY = 0;

            const onMove = (ev) => {
                if (isPinching) {
                    onUp();
                    return;
                }

                const dist = Math.hypot(ev.clientX - startPointerX, ev.clientY - startPointerY);
                if (!dragThresholdPassed && dist > 5) {
                    dragThresholdPassed = true;
                    hasDragged = true;
                    isDraggingThis = true;
                    isDraggingNode = true;
                    draggedNode = node;
                    nodeEl.style.cursor = 'grabbing';
                    if (window.App.graphPreview) {
                        window.App.graphPreview.hide();
                    }
                }

                if (dragThresholdPassed) {
                    const interaction = window.App.graphInteraction;
                    const zoom = (interaction && interaction.camera && interaction.camera.zoom) ? interaction.camera.zoom : 1;
                    node.x = startNodeX + (ev.clientX - startPointerX) / zoom;
                    node.y = startNodeY + (ev.clientY - startPointerY) / zoom;
                    node.vx = 0;
                    node.vy = 0;
                }
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                nodeEl.style.cursor = 'grab';

                if (isDraggingThis) {
                    isDraggingNode = false;
                    draggedNode = null;
                    isDraggingThis = false;
                }

                if (hasDragged) {
                    // Запобігаємо спрацьовуванню кліку після завершення перетягування
                    setTimeout(() => {
                        hasDragged = false;
                        dragThresholdPassed = false;
                    }, 120);
                }
            };

            nodeEl.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 || isPinching) return; // Тільки ліва кнопка миші і якщо не щипок
                e.stopPropagation();

                hasDragged = false;
                dragThresholdPassed = false;
                isDraggingThis = false;
                startPointerX = e.clientX;
                startPointerY = e.clientY;
                startNodeX = node.x;
                startNodeY = node.y;

                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
                window.addEventListener('pointercancel', onUp);
            });

            nodeEl.addEventListener('pointerenter', (e) => {
                if (isDraggingNode || hasDragged) return;
                hoveredNode = node;
                cachedSubtreeIds = this.getSubtreeIds(node.id);

                if (window.App.graphPreview) {
                    window.App.graphPreview.show(node, e.clientX, e.clientY);
                }
            });

            nodeEl.addEventListener('pointerleave', () => {
                if (isDraggingNode || hasDragged) return;
                hoveredNode = null;
                cachedSubtreeIds = null;
                if (window.App.graphPreview) {
                    window.App.graphPreview.hide();
                }
            });

            nodeEl.addEventListener('click', (e) => {
                if (hasDragged || dragThresholdPassed) {
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }

                if (window.App.graphPreview) {
                    window.App.graphPreview.hide();
                }

                if (window.App.store) {
                    window.App.store.setViewMode('columns');
                } else if (window.App.state) {
                    window.App.state.viewMode = 'columns';
                }

                if (window.App.workspaceView) {
                    if (window.App.workspaceView.scrollToNote) {
                        window.App.workspaceView.scrollToNote(node.id);
                    } else {
                        window.App.workspaceView.render();
                    }
                }
            });
        },

        getSubtreeIds(nodeId) {
            const set = new Set();
            set.add(nodeId);

            const addDescendants = (id) => {
                edges.filter(e => e.source === id && e.type === 'hierarchy').forEach(e => {
                    if (!set.has(e.target)) {
                        set.add(e.target);
                        addDescendants(e.target);
                    }
                });
            };

            const addAncestors = (id) => {
                edges.filter(e => e.target === id && e.type === 'hierarchy').forEach(e => {
                    if (!set.has(e.source)) {
                        set.add(e.source);
                        addAncestors(e.source);
                    }
                });
            };

            addDescendants(nodeId);
            addAncestors(nodeId);

            // Додаємо зв'язані закладками нотатки для підсвічування при наведенні
            edges.filter(e => (e.source === nodeId || e.target === nodeId) && e.type === 'bookmark').forEach(e => {
                set.add(e.source);
                set.add(e.target);
            });

            return set;
        },

        bindEvents() {
            const interaction = window.App.graphInteraction;

            // 1. Жест масштабування двома пальцями (Pinch-to-zoom) на смартфонах і сенсорних екранах
            boundTouchStart = (e) => {
                if (e.touches.length >= 2) {
                    e.preventDefault();
                    isPinching = true;
                    isDraggingCanvas = false;
                    isDraggingNode = false;
                    draggedNode = null;

                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    touchPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                    touchPinchCenter = {
                        x: (t1.clientX + t2.clientX) / 2,
                        y: (t1.clientY + t2.clientY) / 2
                    };
                }
            };

            boundTouchMove = (e) => {
                if (e.touches.length >= 2 && touchPinchDist > 0) {
                    e.preventDefault();
                    isPinching = true;
                    isDraggingCanvas = false;

                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                    const currentCenter = {
                        x: (t1.clientX + t2.clientX) / 2,
                        y: (t1.clientY + t2.clientY) / 2
                    };

                    if (currentDist > 0 && touchPinchDist > 0) {
                        const factor = currentDist / touchPinchDist;
                        // М'який плавний зум без різких ривків
                        const clampedFactor = Math.min(1.3, Math.max(0.7, factor));
                        interaction.zoomAt(clampedFactor, currentCenter.x, currentCenter.y, canvas);

                        if (touchPinchCenter) {
                            const panDx = currentCenter.x - touchPinchCenter.x;
                            const panDy = currentCenter.y - touchPinchCenter.y;
                            interaction.camera.x += panDx;
                            interaction.camera.y += panDy;
                        }
                    }

                    touchPinchDist = currentDist;
                    touchPinchCenter = currentCenter;
                }
            };

            boundTouchEnd = (e) => {
                if (e.touches.length < 2) {
                    touchPinchDist = 0;
                    touchPinchCenter = null;
                    if (e.touches.length === 1) {
                        // Якщо залишився 1 палець — перемикаємо на плавне переміщення без ривків
                        isPinching = false;
                        lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                        isDraggingCanvas = true;
                    } else {
                        isPinching = false;
                        isDraggingCanvas = false;
                    }
                }
            };

            container.addEventListener('touchstart', boundTouchStart, { passive: false });
            window.addEventListener('touchmove', boundTouchMove, { passive: false });
            window.addEventListener('touchend', boundTouchEnd);
            window.addEventListener('touchcancel', boundTouchEnd);

            canvas.addEventListener('pointerdown', (e) => {
                if (isPinching) return;
                isDraggingCanvas = true;
                lastMousePos = { x: e.clientX, y: e.clientY };
            });

            boundPointerMove = (e) => {
                if (isPinching) return;
                if (isDraggingCanvas) {
                    const dx = e.clientX - lastMousePos.x;
                    const dy = e.clientY - lastMousePos.y;
                    interaction.camera.x += dx;
                    interaction.camera.y += dy;
                    lastMousePos = { x: e.clientX, y: e.clientY };
                }
            };

            boundPointerUp = () => {
                if (!isPinching) {
                    isDraggingCanvas = false;
                }
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
            };

            window.addEventListener('pointermove', boundPointerMove);
            window.addEventListener('pointerup', boundPointerUp);
            window.addEventListener('pointercancel', boundPointerUp);
            container.addEventListener('wheel', boundWheel, { passive: false });

            boundResize = () => {
                this.resizeCanvas();
            };
            window.addEventListener('resize', boundResize);

            // Кнопки тулбара
            const orphansBtn = container.querySelector('#graph-filter-orphans');
            if (orphansBtn) {
                orphansBtn.addEventListener('click', () => {
                    isOrphansOnly = !isOrphansOnly;
                    orphansBtn.classList.toggle('is-active', isOrphansOnly);
                });
            }

            const tagLinksBtn = container.querySelector('#graph-toggle-tag-links');
            if (tagLinksBtn) {
                tagLinksBtn.addEventListener('click', () => {
                    showTagLinks = !showTagLinks;
                    tagLinksBtn.classList.toggle('is-active', showTagLinks);
                    this.buildGraphData();
                });
            }

            const bookmarkLinksBtn = container.querySelector('#graph-toggle-bookmark-links');
            if (bookmarkLinksBtn) {
                bookmarkLinksBtn.addEventListener('click', () => {
                    showBookmarkLinks = !showBookmarkLinks;
                    bookmarkLinksBtn.classList.toggle('is-active', showBookmarkLinks);
                    this.buildGraphData();
                });
            }

            const exportBtn = container.querySelector('#graph-export-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    const currentBoard = window.App.boardManager ? window.App.boardManager.getActiveBoard() : null;
                    if (window.App.graphExport) {
                        window.App.graphExport.show(nodes, edges, currentBoard);
                    }
                });
            }

            // Пошук
            if (searchInput) {
                const clearBtn = container.querySelector('#graph-search-clear-btn');
                const searchIcon = container.querySelector('#graph-search-icon-right');

                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
                    if (searchIcon) searchIcon.style.display = searchQuery ? 'none' : 'flex';
                });

                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        searchInput.value = '';
                        searchQuery = '';
                        clearBtn.style.display = 'none';
                        if (searchIcon) searchIcon.style.display = 'flex';
                    });
                }
            }

            // Зум кнопки
            const zoomInBtn = container.querySelector('#graph-zoom-in');
            const zoomOutBtn = container.querySelector('#graph-zoom-out');
            const zoomResetBtn = container.querySelector('#graph-zoom-reset');

            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', () => {
                    const rect = canvas.getBoundingClientRect();
                    interaction.zoomAt(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2, canvas);
                });
            }
            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', () => {
                    const rect = canvas.getBoundingClientRect();
                    interaction.zoomAt(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2, canvas);
                });
            }
            if (zoomResetBtn) {
                zoomResetBtn.addEventListener('click', () => {
                    const rect = container.getBoundingClientRect();
                    interaction.resetCamera(rect.width, rect.height);
                });
            }
        },

        startSimulation() {
            isRunning = true;
            const rect = container ? container.getBoundingClientRect() : { width: 800, height: 600 };
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const loop = () => {
                if (!isRunning) return;

                if (window.App.graphSimulation) {
                    window.App.graphSimulation.step(nodes, edges, {
                        draggedNode: draggedNode,
                        centerX: centerX,
                        centerY: centerY
                    });
                }

                if (window.App.graphRenderer) {
                    const interaction = window.App.graphInteraction;
                    window.App.graphRenderer.render(ctx, canvas, nodes, edges, interaction.camera, {
                        draggedNode: draggedNode,
                        hoveredNode: hoveredNode,
                        searchQuery: searchQuery,
                        isOrphansOnly: isOrphansOnly,
                        activeTagFilter: activeTagFilter,
                        activeSubtreeIds: cachedSubtreeIds
                    });
                }

                if (nodesLayer && canvas) {
                    const interaction = window.App.graphInteraction;
                    const r = canvas.getBoundingClientRect();
                    nodesLayer.style.transform = `translate(${interaction.camera.x}px, ${interaction.camera.y}px) scale(${interaction.camera.zoom}) translate(${-r.width / 2}px, ${-r.height / 2}px)`;
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
        },

        cleanup() {
            this.stopSimulation();
            if (boundPointerMove) {
                window.removeEventListener('pointermove', boundPointerMove);
                boundPointerMove = null;
            }
            if (boundPointerUp) {
                window.removeEventListener('pointerup', boundPointerUp);
                window.removeEventListener('pointercancel', boundPointerUp);
                boundPointerUp = null;
            }
            if (container && boundTouchStart) {
                container.removeEventListener('touchstart', boundTouchStart);
                boundTouchStart = null;
            }
            if (boundTouchMove) {
                window.removeEventListener('touchmove', boundTouchMove);
                boundTouchMove = null;
            }
            if (boundTouchEnd) {
                window.removeEventListener('touchend', boundTouchEnd);
                window.removeEventListener('touchcancel', boundTouchEnd);
                boundTouchEnd = null;
            }
            isPinching = false;
            touchPinchDist = 0;
            touchPinchCenter = null;
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
            if (window.App.graphPreview) {
                window.App.graphPreview.hide();
            }
            if (window.App.graphExport) {
                window.App.graphExport.close();
            }
            nodes = [];
            edges = [];
            draggedNode = null;
            hoveredNode = null;
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
