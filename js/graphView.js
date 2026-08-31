// js/graphView.js - Інтерактивний граф зв'язків нотаток (Obsidian Graph View)
window.App = window.App || {};

(function() {
    let container = null;
    let canvas = null;
    let ctx = null;
    let tooltip = null;
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

    // Взаємодія з мишею
    let isDraggingCanvas = false;
    let isDraggingNode = false;
    let draggedNode = null;
    let hoveredNode = null;
    let startMousePos = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    let searchQuery = '';

    // Кольорова палітра вузлів (зі збереженням теми стікерів)
    const colorMap = {
        yellow: '#fef08a',
        green: '#bbf7d0',
        blue: '#bae6fd',
        purple: '#e9d5ff',
        pink: '#fbcfe8',
        orange: '#fed7aa',
        gray: '#cbd5e1'
    };

    // Кеш для відрендерених емодзі-іконок (гарантує 100% піксельне центрування на iOS Safari)
    const emojiCache = new Map();

    function getEmojiSprite(icon, size) {
        const key = `${icon}_${size}`;
        if (emojiCache.has(key)) return emojiCache.get(key);

        const canvasOffscreen = document.createElement('canvas');
        const dpr = 2; // Висока чіткість для Retina-екранів iPhone
        canvasOffscreen.width = size * dpr;
        canvasOffscreen.height = size * dpr;
        const offCtx = canvasOffscreen.getContext('2d');
        offCtx.scale(dpr, dpr);

        offCtx.font = `${Math.round(size * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillText(icon, size / 2, size / 2);

        emojiCache.set(key, canvasOffscreen);
        return canvasOffscreen;
    }

    window.App.graphView = {
        init() {
            // Ініціалізація віджетів
        },

        render() {
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

            const currentBoard = window.App.boardManager.getActiveBoard();
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
                        <span>Головні нотатки</span>
                    </div>
                    <div class="graph-legend-item">
                        <span class="graph-legend-dot subnote"></span>
                        <span>Піднотатки</span>
                    </div>
                    <span class="graph-legend-hint">Клік по вершині відкриває нотатку</span>
                </div>

                <div class="graph-node-tooltip" id="graph-node-tooltip">
                    <div class="graph-tooltip-header">
                        <span class="graph-tooltip-icon" id="graph-tooltip-icon">📄</span>
                        <span class="graph-tooltip-title" id="graph-tooltip-title">Заголовок</span>
                    </div>
                    <div class="graph-tooltip-content" id="graph-tooltip-content">Текст...</div>
                    <div class="graph-tooltip-footer">
                        <span id="graph-tooltip-badge">0 піднотаток</span>
                        <span>Натисніть для перегляду ↗</span>
                    </div>
                </div>
            `;

            parentEl.appendChild(container);

            canvas = container.querySelector('#graph-canvas');
            ctx = canvas.getContext('2d');
            tooltip = container.querySelector('#graph-node-tooltip');
            searchInput = container.querySelector('#graph-search-input');

            this.bindDOMEvents();
        },

        bindDOMEvents() {
            const state = window.App.state;

            const clearBtn = container.querySelector('#graph-search-clear-btn');
            const searchIconRight = container.querySelector('#graph-search-icon-right');

            // Пошук
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase().trim();
                if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
                if (searchIconRight) searchIconRight.style.display = searchQuery ? 'none' : 'flex';
            });

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    searchQuery = '';
                    clearBtn.style.display = 'none';
                    if (searchIconRight) searchIconRight.style.display = 'flex';
                    searchInput.focus();
                });
            }

            // Шорткат '/' або Escape
            window.addEventListener('keydown', (e) => {
                if (e.key === '/' && document.activeElement !== searchInput && !document.activeElement.isContentEditable && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    if (window.App.state.isGraphView) {
                        e.preventDefault();
                        searchInput.focus();
                        searchInput.select();
                    }
                } else if (e.key === 'Escape' && document.activeElement === searchInput) {
                    searchInput.blur();
                }
            });

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

            // Canvas події (Pan, Zoom, Drag nodes, Hover)
            canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
            window.addEventListener('pointermove', this.onPointerMove.bind(this));
            window.addEventListener('pointerup', this.onPointerUp.bind(this));
            canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

            // Resize
            window.addEventListener('resize', this.onResize.bind(this));
        },

        buildGraphData() {
            const state = window.App.state;
            const currentBoard = window.App.boardManager.getActiveBoard();
            if (!currentBoard) return;

            const boardNotes = state.notes.filter(n => n.boardId === currentBoard.id);
            const notesMap = new Map();

            nodes = [];
            edges = [];

            const dpr = window.devicePixelRatio || 1;
            const width = (canvas && canvas.width > 0) ? (canvas.width / dpr) : (container ? container.clientWidth : 800);
            const height = (canvas && canvas.height > 0) ? (canvas.height / dpr) : (container ? container.clientHeight : 600);

            const centerX = width / 2;
            const centerY = height / 2;

            // 1. Формуємо вершини (Nodes) навколо реального центру полотна
            boardNotes.forEach((note) => {
                const isRoot = !note.parentId;
                const radius = isRoot ? 20 : 15;
                
                // Перетворюємо всі типи розривів рядків, списки та блоки у пробіли
                const rawContent = (note.content || '');
                const cleanContent = rawContent
                    .replace(/<br\s*[\/]?>/gi, ' ')
                    .replace(/<\/(div|p|li|h[1-6])>/gi, ' ')
                    .replace(/<div[^>]*>/gi, ' ')
                    .replace(/<p[^>]*>/gi, ' ')
                    .replace(/<li[^>]*>/gi, ' ')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/\r?\n+/g, ' ')
                    .replace(/\s+/g, ' ')
                // Стартова позиція акуратно навколо реального центру полотна
                const angle = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * (isRoot ? 80 : 150);

                const node = {
                    id: note.id,
                    title: (note.title && note.title.trim()) ? note.title.trim() : 'Без назви',
                    content: cleanContent,
                    icon: note.icon || (isRoot ? '🗒️' : '📄'),
                    color: colorMap[note.color] || '#fef08a',
                    rawColor: note.color || 'yellow',
                    isRoot: isRoot,
                    parentId: note.parentId || null,
                    tags: Array.isArray(note.tags) ? note.tags : (note.tag ? [note.tag.text || note.tag] : []),
                    radius: radius,
                    x: centerX + Math.cos(angle) * dist,
                    y: centerY + Math.sin(angle) * dist,
                    vx: 0,
                    vy: 0,
                    childCount: 0
                };

                nodes.push(node);
                notesMap.set(note.id, node);
            });

            // 2. Формуємо ребра (Edges) між батьківськими та дочірніми нотатками
            nodes.forEach(node => {
                if (node.parentId && notesMap.has(node.parentId)) {
                    const parentNode = notesMap.get(node.parentId);
                    parentNode.childCount++;
                    parentNode.radius = Math.min(26, parentNode.radius + 1.8); // Батьківські вершини з більшою кількістю дітей стають масивнішими

                    edges.push({
                        source: parentNode,
                        target: node,
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

            // Попередній швидкий прогін фізики (Warm-up Physics), щоб вершини з першого ж кадру були красиво розгорнуті в центрі
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
            if (window.App.state.isGraphView && isRunning) {
                this.resizeCanvas();
            }
        },

        resetCamera() {
            if (!canvas || !container) return;
            const rect = container.getBoundingClientRect();
            camera.x = rect.width / 2;
            camera.y = rect.height / 2;
            camera.zoom = 1;
        },

        smoothZoom(factor) {
            const newZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
            camera.zoom = newZoom;
        },

        // Фізична симуляція розташування вершин (Force-Directed Graph Simulation)
        updatePhysics() {
            const repulsion = 1200; // Сила відштовхування між вершинами
            const springK = 0.005; // Пружність зв'язків
            const damping = 0.88;  // Затухання швидкості
            const centerAttraction = 0.0008; // Сила тяжіння до центру

            const centerX = canvas ? (canvas.width / (window.devicePixelRatio || 1)) / 2 : 400;
            const centerY = canvas ? (canvas.height / (window.devicePixelRatio || 1)) / 2 : 300;

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
                    t.vx -= fx;
                    t.vy -= fy;
                }
            });

            // 3. Застосування швидкості та затухання
            nodes.forEach(node => {
                if (node === draggedNode) return;

                node.vx *= damping;
                node.vy *= damping;

                node.x += node.vx;
                node.y += node.vy;
            });
        },

        // Малювання патерну крапок на фоні графа (Адаптивний LOD для плавності 60 FPS при будь-якому зумі)
        drawDotGrid(width, height) {
            // При сильному віддаленні камери автоматично збільшуємо крок сітки, щоб не малювати десятки тисяч крапок одночасно
            let gridSize = 28;
            if (camera.zoom < 0.35) {
                gridSize = 112; // 4x крок
            } else if (camera.zoom < 0.65) {
                gridSize = 56;  // 2x крок
            }

            const dotRadius = Math.max(0.75, 1.0 / camera.zoom);
            
            // Межі видимої області у просторі світу
            const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize - gridSize;
            const endX = Math.ceil(((width - camera.x) / camera.zoom) / gridSize) * gridSize + gridSize;
            const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize - gridSize;
            const endY = Math.ceil(((height - camera.y) / camera.zoom) / gridSize) * gridSize + gridSize;

            // Безпечний ліміт: якщо кількість ітерацій надто велика — пропускаємо для миттєвого рендерингу
            const countX = (endX - startX) / gridSize;
            const countY = (endY - startY) / gridSize;
            if (countX * countY > 2500) return;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();

            for (let x = startX; x <= endX; x += gridSize) {
                for (let y = startY; y <= endY; y += gridSize) {
                    ctx.moveTo(x + dotRadius, y);
                    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                }
            }

            ctx.fill();
        },

        // Рендеринг кадру на Canvas
        draw() {
            if (!ctx || !canvas) return;

            const dpr = window.devicePixelRatio || 1;
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;

            ctx.clearRect(0, 0, width, height);

            ctx.save();
            // Трансформація камери
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);

            // 0. Малювання сітки фонових крапок
            this.drawDotGrid(width, height);

            ctx.translate(-width / 2, -height / 2);

            // 1. Малювання зв'язків (Edges)
            edges.forEach(edge => {
                const isHovered = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
                
                ctx.beginPath();
                ctx.moveTo(edge.source.x, edge.source.y);
                ctx.lineTo(edge.target.x, edge.target.y);

                if (isHovered) {
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 2.2 / camera.zoom;
                    ctx.shadowColor = '#10b981';
                    ctx.shadowBlur = 10;
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 1.2 / camera.zoom;
                    ctx.shadowBlur = 0;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            // 2. Малювання вершин (Nodes)
            nodes.forEach(node => {
                const isMatch = searchQuery === '' || node.title.toLowerCase().includes(searchQuery) || node.content.toLowerCase().includes(searchQuery);
                const isHovered = (hoveredNode === node);
                const isConnected = hoveredNode && edges.some(e => (e.source === hoveredNode && e.target === node) || (e.target === hoveredNode && e.source === node));

                const opacity = (searchQuery && !isMatch) ? 0.2 : (hoveredNode && !isHovered && !isConnected ? 0.35 : 1);

                ctx.save();
                // 3. Адаптивне малювання кружечка та емодзі через спрайт
                const icon = node.icon || (node.isRoot ? '🗒️' : '📄');
                const radius = node.isRoot ? 22 : 16;
                node.radius = radius;

                // Зовнішнє світіння для активних зв'язків
                if (isHovered || isConnected) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
                    ctx.fillStyle = isHovered ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)';
                    ctx.fill();
                }

                // Тіло кружечка
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = node.isRoot ? '#eab308' : (node.color || '#10b981');
                ctx.fill();

                ctx.lineWidth = 2 / camera.zoom;
                ctx.strokeStyle = isHovered ? '#ffffff' : (node.isRoot ? '#ca8a04' : 'rgba(255, 255, 255, 0.4)');
                ctx.stroke();

                // Малюємо емодзі-спрайт строго в центрі кружечка (без багів шрифтових метрик WebKit)
                const spriteSize = radius * 2;
                const emojiSprite = getEmojiSprite(icon, spriteSize);
                ctx.drawImage(emojiSprite, node.x - radius, node.y - radius, spriteSize, spriteSize);

                // 4. Підпис назви вершини (Text Label під кружком)
                if (camera.zoom > 0.45 || isHovered || isMatch) {
                    const fontSize = Math.max(10, Math.min(14, 12 / camera.zoom));
                    ctx.font = `600 ${fontSize}px "JetBrains Mono", sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';

                    // Підкладка для читабельності тексту
                    const text = node.title;
                    const textY = node.y + radius + 8;

                    ctx.fillStyle = isHovered ? '#34d399' : (isMatch && searchQuery ? '#fbbf24' : 'rgba(255, 255, 255, 0.85)');
                    ctx.fillText(text, node.x, textY);
                }

                ctx.restore();
            });

            ctx.restore();
        },

        // Головний цикл анімації
        startSimulation() {
            if (isRunning) return;
            isRunning = true;

            const loop = () => {
                if (!isRunning) return;
                this.updatePhysics();
                this.draw();

                // Якщо є активний hover на вершину (або її перетягують) — тултип синхронно рухається разом з нею
                if (hoveredNode) {
                    this.positionTooltip(hoveredNode);
                }

                animationFrameId = requestAnimationFrame(loop);
            };

            loop();
        },

        stopSimulation() {
            isRunning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        },

        // Перетворення екранних координат у координати простору графа
        screenToWorld(screenX, screenY) {
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

        // Події миші
        onPointerDown(e) {
            if (e.button !== 0 && e.button !== 1) return; // Ліва або середня кнопка

            const targetNode = this.getNodeAt(e.clientX, e.clientY);
            startMousePos = { x: e.clientX, y: e.clientY };
            lastMousePos = { x: e.clientX, y: e.clientY };

            if (targetNode) {
                isDraggingNode = true;
                draggedNode = targetNode;
                hoveredNode = targetNode;
                this.updateTooltip(hoveredNode);
            } else {
                isDraggingCanvas = true;
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
                this.positionTooltip(draggedNode);
            } else if (isDraggingCanvas) {
                camera.x += dx;
                camera.y += dy;
                if (hoveredNode) {
                    this.positionTooltip(hoveredNode);
                }
            } else {
                // Перевірка hover на вершину
                const hovered = this.getNodeAt(e.clientX, e.clientY);
                if (hovered !== hoveredNode) {
                    hoveredNode = hovered;
                    this.updateTooltip(hoveredNode);
                } else if (hoveredNode) {
                    this.positionTooltip(hoveredNode);
                }
            }
        },

        onPointerUp(e) {
            const distMoved = Math.sqrt(Math.pow(e.clientX - startMousePos.x, 2) + Math.pow(e.clientY - startMousePos.y, 2));

            // Якщо це був клік (без значного перетягування) по вершині — відкриваємо нотатку у вигляді колонок
            if (distMoved < 6 && draggedNode) {
                const clickedNoteId = draggedNode.id;
                this.openNoteInWorkspace(clickedNoteId);
            }

            isDraggingCanvas = false;
            isDraggingNode = false;
            draggedNode = null;
        },

        onWheel(e) {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const newZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));

            // Зум відносно поточної позиції курсору
            camera.x = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
            camera.y = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);
            camera.zoom = newZoom;
        },

        // Перетворення координат світу графа в екранні координати контейнера
        worldToScreen(worldX, worldY) {
            const dpr = window.devicePixelRatio || 1;
            const width = canvas ? (canvas.width / dpr) : (container ? container.clientWidth : 800);
            const height = canvas ? (canvas.height / dpr) : (container ? container.clientHeight : 600);

            const screenX = (worldX - (width / 2)) * camera.zoom + camera.x;
            const screenY = (worldY - (height / 2)) * camera.zoom + camera.y;
            return { x: screenX, y: screenY };
        },

        updateTooltip(node) {
            if (!tooltip) return;

            if (!node) {
                tooltip.classList.remove('active');
                return;
            }

            const titleEl = tooltip.querySelector('#graph-tooltip-title');
            const iconEl = tooltip.querySelector('#graph-tooltip-icon');
            const contentEl = tooltip.querySelector('#graph-tooltip-content');
            const badgeEl = tooltip.querySelector('#graph-tooltip-badge');

            titleEl.textContent = node.title;
            iconEl.textContent = node.icon;
            
            // Чистий текст з перетворенням нових рядків/блоків у комфортні пробіли
            let cleanText = (node.content || '')
                .replace(/<br\s*[\/]?>/gi, ' ')
                .replace(/<\/(div|p|li|h[1-6])>/gi, ' ')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            contentEl.textContent = cleanText || 'Немає вмісту нотатки...';
            badgeEl.textContent = node.isRoot ? `Головна нотатка (${node.childCount} піднотаток)` : `Піднотатка`;

            this.positionTooltip(node);
            tooltip.classList.add('active');
        },

        positionTooltip(node) {
            if (!tooltip || !node) return;
            const screenPos = this.worldToScreen(node.x, node.y);

            // Розміщуємо тултип строго над вершиною з відступом від її радіуса та тексту
            const offsetY = (node.radius + 12) * camera.zoom;
            tooltip.style.left = `${screenPos.x}px`;
            tooltip.style.top = `${screenPos.y - offsetY}px`;
        },

        // Відкриття ланцюжка нотатки при кліку на вершину графа
        openNoteInWorkspace(noteId) {
            const state = window.App.state;
            const noteManager = window.App.noteManager;
            const targetNote = noteManager.getNoteById(noteId);
            if (!targetNote) return;

            // Будуємо ланцюжок від кореня до цієї нотатки
            const chain = [null];
            const ancestors = [];
            let curr = targetNote;

            while (curr && curr.parentId) {
                ancestors.unshift(curr.parentId);
                curr = noteManager.getNoteById(curr.parentId);
            }

            chain.push(...ancestors);
            state.activeChain = chain;

            // Вимикаємо граф і перемикаємо на колонки
            this.stopSimulation();
            state.isGraphView = false;
            window.App.storage.saveGraphViewMode(false);
            window.App.workspaceView.render();

            // Скролимо та підсвічуємо вибрану нотатку
            setTimeout(() => {
                window.App.workspaceView.scrollToNote(noteId);
            }, 100);
        }
    };
})();
