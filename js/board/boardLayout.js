// js/board/boardLayout.js - Алгоритми автоматичного та ієрархічного розміщення стікерів
window.App = window.App || {};

(function() {
    window.App.boardLayout = {
        /**
         * Автоматичне впорядкування стікерів у вигляді ієрархічних колонок з анімацією
         */
        autoLayout(nodes, edges, options = {}) {
            if (!nodes || nodes.length === 0) return;

            const {
                onUpdate = null,
                onComplete = null
            } = options;

            const rootNodes = nodes.filter(n => n.isRoot);
            if (rootNodes.length === 0) return;

            const LEVEL_X_GAP = 420;
            const SIBLING_Y_GAP = 28;

            let currentRootY = 100;
            const START_X = 100;

            const getNodeHeight = (node) => {
                if (node.element && node.element.offsetHeight > 40) {
                    return node.element.offsetHeight;
                }
                return 150;
            };

            const getSubtreeHeight = (nodeId) => {
                const childEdges = edges.filter(e => e.source === nodeId && e.type === 'hierarchy');
                const thisHeight = getNodeHeight(nodes.find(n => n.id === nodeId) || {});
                if (childEdges.length === 0) {
                    return thisHeight;
                }
                let childrenTotal = 0;
                childEdges.forEach((e, idx) => {
                    childrenTotal += getSubtreeHeight(e.target);
                    if (idx < childEdges.length - 1) childrenTotal += SIBLING_Y_GAP;
                });
                return Math.max(thisHeight, childrenTotal);
            };

            const positionSubtree = (nodeId, level, startY) => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return startY;

                const nodeHeight = getNodeHeight(node);
                const subtreeH = getSubtreeHeight(nodeId);
                const nodeY = startY + Math.max(0, (subtreeH - nodeHeight) / 2);

                node.targetX = START_X + level * LEVEL_X_GAP;
                node.targetY = nodeY;

                const childEdges = edges.filter(e => e.source === nodeId && e.type === 'hierarchy');
                let childCurrentY = startY;

                childEdges.forEach((e) => {
                    const childH = getSubtreeHeight(e.target);
                    positionSubtree(e.target, level + 1, childCurrentY);
                    childCurrentY += childH + SIBLING_Y_GAP;
                });

                return startY + subtreeH;
            };

            rootNodes.forEach((root) => {
                const treeH = positionSubtree(root.id, 0, currentRootY);
                currentRootY = treeH + SIBLING_Y_GAP * 2;
            });

            // Плавна анімація переміщення карток до цільових координат
            const startPositions = nodes.map(n => ({ x: n.x, y: n.y }));
            const duration = 400;
            const startTime = performance.now();

            const animateStep = (time) => {
                const elapsed = time - startTime;
                const progress = Math.min(1, elapsed / duration);
                const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

                nodes.forEach((n, idx) => {
                    if (n.targetX !== undefined && n.targetY !== undefined) {
                        n.x = startPositions[idx].x + (n.targetX - startPositions[idx].x) * ease;
                        n.y = startPositions[idx].y + (n.targetY - startPositions[idx].y) * ease;
                        if (n.element) {
                            n.element.style.left = n.x + 'px';
                            n.element.style.top = n.y + 'px';
                        }
                    }
                });

                if (typeof onUpdate === 'function') onUpdate();

                if (progress < 1) {
                    requestAnimationFrame(animateStep);
                } else {
                    if (typeof onComplete === 'function') onComplete();
                }
            };

            requestAnimationFrame(animateStep);
        }
    };
})();
