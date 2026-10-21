// js/graph/graphRenderer.js - Малювання круглих вузлів, ребер та ліній зв'язків на Canvas
window.App = window.App || {};

(function() {
    window.App.graphRenderer = {
        /**
         * Малювання всього кадру графа на Canvas
         */
        render(ctx, canvas, nodes, edges, camera, options = {}) {
            if (!ctx || !canvas) return;

            const {
                draggedNode = null,
                hoveredNode = null,
                searchQuery = '',
                isOrphansOnly = false,
                activeTagFilter = null,
                activeSubtreeIds = null
            } = options;

            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            ctx.clearRect(0, 0, width, height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-width / 2, -height / 2);

            // 1. Точкова сітка
            const gridSize = 40;
            const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize;
            const endX = startX + (width / camera.zoom) + gridSize * 2;
            const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize;
            const endY = startY + (height / camera.zoom) + gridSize * 2;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            for (let x = startX; x <= endX; x += gridSize) {
                for (let y = startY; y <= endY; y += gridSize) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 2. Лінії зв'язків (Edges)
            edges.forEach(edge => {
                const n1 = edge.sourceNode;
                const n2 = edge.targetNode;
                if (!n1 || !n2) return;

                const isTagEdge = (edge.type === 'tag');
                const branchColor = edge.color || '#10b981';

                const isConnectedToHover = activeSubtreeIds && (activeSubtreeIds.has(n1.id) && activeSubtreeIds.has(n2.id));
                const isFaded = activeSubtreeIds && !isConnectedToHover;

                ctx.beginPath();
                ctx.moveTo(n1.x, n1.y);
                ctx.lineTo(n2.x, n2.y);

                if (isTagEdge) {
                    ctx.setLineDash([5, 5]);
                } else {
                    ctx.setLineDash([]);
                }

                if (isFaded) {
                    ctx.strokeStyle = branchColor + '15';
                    ctx.lineWidth = 1 / camera.zoom;
                } else if (isConnectedToHover) {
                    ctx.strokeStyle = branchColor;
                    ctx.lineWidth = 2.5 / camera.zoom;
                    ctx.shadowColor = branchColor;
                    ctx.shadowBlur = 8;
                } else {
                    ctx.strokeStyle = branchColor + (isTagEdge ? '66' : '99');
                    ctx.lineWidth = (isTagEdge ? 1.2 : 1.8) / camera.zoom;
                }

                ctx.stroke();
                ctx.shadowBlur = 0;
            });

            ctx.setLineDash([]);

            // 3. Синхронізація позицій та класів HTML-вузлів
            nodes.forEach(node => {
                if (!node.element) return;

                const isSearchMatch = !searchQuery || node.title.toLowerCase().includes(searchQuery) || node.content.toLowerCase().includes(searchQuery);
                const isOrphanMatch = !isOrphansOnly || node.isOrphan;
                const isTagMatch = !activeTagFilter || (node.tags && node.tags.some(t => (typeof t === 'string' ? t : (t.text || '')) === activeTagFilter));

                const isMatch = isSearchMatch && isOrphanMatch && isTagMatch;
                const isFaded = activeSubtreeIds ? !activeSubtreeIds.has(node.id) : (searchQuery || isOrphansOnly || activeTagFilter) ? !isMatch : false;

                node.element.classList.toggle('is-faded', isFaded);
                node.element.classList.toggle('is-match', isMatch && (searchQuery || isOrphansOnly || activeTagFilter));
                node.element.classList.toggle('is-hovered', hoveredNode === node);
                node.element.classList.toggle('is-dragging', draggedNode === node);

                node.element.style.left = node.x + 'px';
                node.element.style.top = node.y + 'px';
            });

            ctx.restore();
        }
    };
})();
