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

    // Кеш для фокусованих піддерев (уникнення повторних алокацій у кожному кадрі)
    let lastFocusNodeId = null;
    let cachedSubtreeIds = null;

    // Збережені прив'язки подій для чистого unbind
    let boundPointerMove = null;
    let boundPointerUp = null;
    let boundKeyDown = null;
    let boundResize = null;

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
                    <div class="graph-title-pill">
                        <span class="graph-title-icon">🕸️</span>
                        <span class="graph-title-text">${currentBoard.name}</span>
                        <span class="graph-nodes-count" id="graph-nodes-counter">0 зв'язків</span>
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
                            <button class="graph-search-clear-btn" id="graph-search-clear-btn" style="display: none;">×</button>
                        </div>
                    </div>
                </div>

                <canvas class="graph-canvas" id="graph-canvas"></canvas>
                <div class="graph-nodes-layer" id="graph-nodes-layer"></div>

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
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>

                <div class="graph-legend-pill">
                    <div class="graph-legend-item">
                        <span class="graph-legend-dot root"></span>
                        <span>Рівень 0 (Корінь)</span>
                    </div>
                    <div class="graph-legend-item">
                        <span class="graph-legend-dot subnote"></span>
                        <span>Рівні 1+ (Піднотатки)</span>
                    </div>
                    <span class="graph-legend-hint">Наведення фокусує гілку вниз, клік відкриває нотатку</span>
                </div>
            `;

            parentEl.appendChild(container);

            canvas = container.querySelector('#graph-canvas');
            ctx = canvas.getContext('2d');
            nodesLayer = container.querySelector('#graph-nodes-layer');
            searchInput = container.querySelector('#graph-search-input');

            this.bindDOMEvents();
        },

        bindDOMEvents() {
            this.unbindDOMEvents();

            const clearBtn = container.querySelector('#graph-search-clear-btn');
            const searchIconRight = container.querySelector('#graph-search-icon-right');

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

            // Canvas події
            canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
            canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

            // Глобальні події вікна з можливістю чистого відписування
            boundPointerMove = this.onPointerMove.bind(this);
            boundPointerUp = this.onPointerUp.bind(this);
            boundResize = this.onResize.bind(this);

            window.addEventListener('pointermove', boundPointerMove);
            window.addEventListener('pointerup', boundPointerUp);
            window.addEventListener('pointercancel', boundPointerUp);
            window.addEventListener('keydown', boundKeyDown);
            window.addEventListener('resize', boundResize);
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
                    tags: Array.isArray(note.tags) ? note.tags : (note.tag ? [note.tag.text || note.tag] : []),
                    radius: radius,
                    x: centerX + Math.cos(angle) * dist,
                    y: centerY + Math.sin(angle) * dist,
                    vx: 0,
                    vy: 0,
                    childCount: 0
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
                        length: 90 + Math.random() * 20
                    });
                }
            });

            // Оновлюємо лічильник зв'язків
            const counter = container.querySelector('#graph-nodes-counter');
            if (counter) {
                counter.textContent = `${nodes.length} нотаток, ${edges.length} зв'язків`;
            }

            // Центруємо камеру на старті
            this.resetCamera();

            // Warm-up Physics: розгортаємо граф за кілька швидких ітерацій
            for (let i = 0; i < 40; i++) {
                this.updatePhysics();
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
                    let dist = Math.sqrt(dx * dx + dy * dy) || 1;

                    if (dist < 320) {
                        let force = (repulsion / (dist * dist));
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

            // 2. Сила пружин по зв'язках (Hooke's Law)
            edges.forEach(edge => {
                const s = edge.source;
                const t = edge.target;
                let dx = t.x - s.x;
                let dy = t.y - s.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                let displacement = dist - edge.length;
                let force = displacement * springK;

                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                if (s !== draggedNode) {
                    s.vx += fx;
                    s.vy += fy;
                }
                if (t !== draggedNode) {
                    t.vx += fx;
                    t.vy += fy;
                }
            });

            // 3. Застосування швидкості та затухання з розрахунком сумарної енергії
            let totalMovement = 0;
            nodes.forEach(node => {
                if (node === draggedNode) return;

                node.vx *= damping;
                node.vy *= damping;

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
                const isHighlighted = !!(activeSubtreeIds &&
                    activeSubtreeIds.has(edge.source.id) &&
                    activeSubtreeIds.has(edge.target.id));
                const branchColor = edge.color || edge.source.branchColor || '#10b981';

                ctx.beginPath();
                ctx.moveTo(edge.source.x, edge.source.y);
                ctx.lineTo(edge.target.x, edge.target.y);

                if (isHighlighted) {
                    ctx.strokeStyle = branchColor;
                    ctx.lineWidth = (draggedNode ? 3.0 : 2.5) / camera.zoom;
                    ctx.shadowColor = branchColor;
                    ctx.shadowBlur = 14;
                } else if (activeSubtreeIds) {
                    ctx.strokeStyle = branchColor + '15';
                    ctx.lineWidth = 0.8 / camera.zoom;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.strokeStyle = branchColor + '40';
                    ctx.lineWidth = 1.2 / camera.zoom;
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            // 2. Оновлення стану та позицій HTML-вершин
            nodes.forEach(node => {
                if (!node.element) return;

                const isMatch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery) || node.content.toLowerCase().includes(searchQuery);
                const isDragging = (draggedNode === node);
                const isHovered = (hoveredNode === node && !draggedNode);
                const isInSubtree = activeSubtreeIds && activeSubtreeIds.has(node.id);
                const isConnected = isInSubtree && !isHovered && !isDragging;

                node.element.classList.toggle('is-dragging', isDragging);
                node.element.classList.toggle('is-hovered', isHovered);
                node.element.classList.toggle('is-connected', isConnected);
                node.element.classList.toggle('is-match', isMatch && searchQuery !== '');
                node.element.classList.toggle('is-faded', searchQuery ? !isMatch : (activeSubtreeIds && !isInSubtree));

                node.element.style.left = node.x + 'px';
                node.element.style.top = node.y + 'px';
            });

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
            nodes = [];
            edges = [];
            hoveredNode = null;
            draggedNode = null;
            lastFocusNodeId = null;
            cachedSubtreeIds = null;
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
            if (e.button !== 0 && e.button !== 1) return;

            const targetNode = this.getNodeAt(e.clientX, e.clientY);
            startMousePos = { x: e.clientX, y: e.clientY };
            lastMousePos = { x: e.clientX, y: e.clientY };

            if (targetNode) {
                isDraggingNode = true;
                draggedNode = targetNode;
                hoveredNode = targetNode;
                this.wakeUpSimulation();
            } else {
                isDraggingCanvas = true;
                hoveredNode = null;
                draggedNode = null;
                this.draw();
            }
        },

        onPointerMove(e) {
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
                this.wakeUpSimulation();
            } else if (isDraggingCanvas) {
                camera.x += dx;
                camera.y += dy;
                this.draw();
            } else {
                const isTouchDevice = e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches || window.innerWidth <= 768;
                if (!isTouchDevice) {
                    const hovered = this.getNodeAt(e.clientX, e.clientY);
                    if (hovered !== hoveredNode) {
                        hoveredNode = hovered;
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
            const distMoved = Math.sqrt(Math.pow(e.clientX - startMousePos.x, 2) + Math.pow(e.clientY - startMousePos.y, 2));
            const isTouchDevice = e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches || window.innerWidth <= 768;

            if (distMoved < 6 && draggedNode) {
                const clickedNoteId = draggedNode.id;
                this.openNoteInWorkspace(clickedNoteId);
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
