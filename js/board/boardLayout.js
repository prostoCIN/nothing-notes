// js/board/boardLayout.js - Горизонтальне розміщення кореневих нотаток з каскадними піднотатками вниз
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
            const HORIZONTAL_GAP = 60;
            const VERTICAL_GAP = 36;
            const START_X = 60;
            const START_Y = 60;

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

            const subtreeWidthMap = new Map();
            const calcSubtreeWidth = (nodeId) => {
                const children = childrenMap.get(nodeId) || [];
                if (children.length === 0) {
                    subtreeWidthMap.set(nodeId, CARD_WIDTH);
                    return CARD_WIDTH;
                }

                let totalChildrenWidth = 0;
                children.forEach((child, i) => {
                    if (i > 0) totalChildrenWidth += HORIZONTAL_GAP;
                    totalChildrenWidth += calcSubtreeWidth(child.id);
                });

                const finalW = Math.max(CARD_WIDTH, totalChildrenWidth);
                subtreeWidthMap.set(nodeId, finalW);
                return finalW;
            };

            rootNodes.forEach(r => calcSubtreeWidth(r.id));

            const layoutNode = (node, startX, y) => {
                const subW = subtreeWidthMap.get(node.id) || CARD_WIDTH;
                const myH = getNodeHeight(node);

                // Центруємо батька над його дітьми для красивої симетрії
                node.targetX = startX + (subW - CARD_WIDTH) / 2;
                node.targetY = y;

                const children = childrenMap.get(node.id) || [];
                let childX = startX;
                const nextY = y + myH + VERTICAL_GAP;

                children.forEach(child => {
                    const childSubW = subtreeWidthMap.get(child.id) || CARD_WIDTH;
                    layoutNode(child, childX, nextY);
                    childX += childSubW + HORIZONTAL_GAP;
                });
            };

            let currentRootX = START_X;
            rootNodes.forEach(root => {
                const rootW = subtreeWidthMap.get(root.id) || CARD_WIDTH;
                layoutNode(root, currentRootX, START_Y);
                currentRootX += rootW + HORIZONTAL_GAP;
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
            const duration = 340;
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
