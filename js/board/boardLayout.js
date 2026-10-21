// js/board/boardLayout.js - Алгоритми автоматичного ієрархічного розміщення карток на дошці
window.App = window.App || {};

(function() {
    window.App.boardLayout = {
        autoLayout(nodes, edges, options = {}) {
            if (!nodes || nodes.length === 0) return;

            const {
                animate = true,
                onUpdate = null,
                onComplete = null
            } = options;

            const CARD_WIDTH = 380;
            const HORIZONTAL_GAP = 70;
            const VERTICAL_GAP = 28;

            const childrenMap = new Map();
            const rootNodes = [];
            nodes.forEach(n => childrenMap.set(n.id, []));

            nodes.forEach(n => {
                if (n.parentId && childrenMap.has(n.parentId)) {
                    childrenMap.get(n.parentId).push(n);
                } else {
                    rootNodes.push(n);
                }
            });

            const getNodeHeight = (node) => {
                if (node.element && node.element.offsetHeight > 40) {
                    return node.element.offsetHeight;
                }
                return 150;
            };

            const subtreeHeightMap = new Map();
            const calcSubtreeHeight = (nodeId) => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return 0;
                const myH = getNodeHeight(node);
                const children = childrenMap.get(nodeId) || [];
                if (children.length === 0) {
                    subtreeHeightMap.set(nodeId, myH);
                    return myH;
                }
                let totalChildH = 0;
                children.forEach((child, i) => {
                    if (i > 0) totalChildH += VERTICAL_GAP;
                    totalChildH += calcSubtreeHeight(child.id);
                });
                const finalH = Math.max(myH, totalChildH);
                subtreeHeightMap.set(nodeId, finalH);
                return finalH;
            };

            rootNodes.forEach(r => calcSubtreeHeight(r.id));

            let currentRootY = 60;
            const startX = 60;

            const layoutNode = (node, x, startY) => {
                const subH = subtreeHeightMap.get(node.id) || getNodeHeight(node);
                const myH = getNodeHeight(node);

                node.targetX = x;
                node.targetY = startY + Math.max(0, (subH - myH) / 6);

                const children = childrenMap.get(node.id) || [];
                let childY = startY;
                const nextX = x + CARD_WIDTH + HORIZONTAL_GAP;

                children.forEach(child => {
                    const childSubH = subtreeHeightMap.get(child.id) || getNodeHeight(child);
                    layoutNode(child, nextX, childY);
                    childY += childSubH + VERTICAL_GAP;
                });
            };

            rootNodes.forEach(root => {
                const rootH = subtreeHeightMap.get(root.id) || 160;
                layoutNode(root, startX, currentRootY);
                currentRootY += rootH + 50;
            });

            if (!animate) {
                nodes.forEach(n => {
                    n.x = n.targetX;
                    n.y = n.targetY;
                    if (n.element) {
                        n.element.style.left = n.x + 'px';
                        n.element.style.top = n.y + 'px';
                    }
                });
                if (typeof onUpdate === 'function') onUpdate();
                if (typeof onComplete === 'function') onComplete();
                return;
            }

            const startTime = performance.now();
            const duration = 320;
            const startPositions = nodes.map(n => ({ x: n.x, y: n.y }));

            const animateStep = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / duration);
                const ease = 1 - Math.pow(1 - progress, 3);

                nodes.forEach((n, idx) => {
                    n.x = startPositions[idx].x + (n.targetX - startPositions[idx].x) * ease;
                    n.y = startPositions[idx].y + (n.targetY - startPositions[idx].y) * ease;
                    if (n.element) {
                        n.element.style.left = n.x + 'px';
                        n.element.style.top = n.y + 'px';
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
