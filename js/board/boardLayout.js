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

            // Захист від циклічних посилань на себе
            nodes.forEach(n => {
                if (n.parentId === n.id) {
                    n.parentId = null;
                }
            });

            nodes.forEach(n => {
                if (n.parentId && childrenMap.has(n.parentId)) {
                    childrenMap.get(n.parentId).push(n);
                } else {
                    rootNodes.push(n);
                }
            });

            // Якщо всі нотатки замкнені в циклах і немає жодного явного кореня — беремо першу як корінь
            if (rootNodes.length === 0 && nodes.length > 0) {
                rootNodes.push(nodes[0]);
            }

            const getNodeHeight = (node) => {
                if (node.element && node.element.offsetHeight > 40) {
                    return node.element.offsetHeight;
                }
                return node.height || 150;
            };

            const subtreeWidthMap = new Map();
            const visitingInWidth = new Set();

            const calcSubtreeWidth = (nodeId) => {
                if (visitingInWidth.has(nodeId)) {
                    // Запобігаємо циклічному переповненню стеку
                    return CARD_WIDTH;
                }
                if (subtreeWidthMap.has(nodeId)) {
                    return subtreeWidthMap.get(nodeId);
                }

                visitingInWidth.add(nodeId);

                const children = childrenMap.get(nodeId) || [];
                if (children.length === 0) {
                    visitingInWidth.delete(nodeId);
                    subtreeWidthMap.set(nodeId, CARD_WIDTH);
                    return CARD_WIDTH;
                }

                let totalChildrenWidth = 0;
                children.forEach((child, i) => {
                    if (i > 0) totalChildrenWidth += HORIZONTAL_GAP;
                    totalChildrenWidth += calcSubtreeWidth(child.id);
                });

                visitingInWidth.delete(nodeId);

                const finalW = Math.max(CARD_WIDTH, totalChildrenWidth);
                subtreeWidthMap.set(nodeId, finalW);
                return finalW;
            };

            rootNodes.forEach(r => calcSubtreeWidth(r.id));

            const visitedInLayout = new Set();
            const layoutNode = (node, startX, y) => {
                if (!node || visitedInLayout.has(node.id)) return;
                visitedInLayout.add(node.id);

                const subW = subtreeWidthMap.get(node.id) || CARD_WIDTH;
                const myH = getNodeHeight(node);

                // Центруємо батька над його дітьми для красивої симетрії
                node.targetX = Math.round(startX + (subW - CARD_WIDTH) / 2);
                node.targetY = Math.round(y);

                const children = childrenMap.get(node.id) || [];
                let childX = startX;
                const nextY = Math.round(y + myH + VERTICAL_GAP);

                children.forEach(child => {
                    if (!visitedInLayout.has(child.id)) {
                        const childSubW = subtreeWidthMap.get(child.id) || CARD_WIDTH;
                        layoutNode(child, childX, nextY);
                        childX += childSubW + HORIZONTAL_GAP;
                    }
                });
            };

            let currentRootX = START_X;
            rootNodes.forEach(root => {
                const rootW = subtreeWidthMap.get(root.id) || CARD_WIDTH;
                layoutNode(root, currentRootX, START_Y);
                currentRootX += rootW + HORIZONTAL_GAP;
            });

            // Якщо якісь нотатки не потрапили в дерева коренів (наприклад, замкнені цикли або відірвані гілки)
            nodes.forEach(n => {
                if (!visitedInLayout.has(n.id)) {
                    calcSubtreeWidth(n.id);
                    const remW = subtreeWidthMap.get(n.id) || CARD_WIDTH;
                    layoutNode(n, currentRootX, START_Y);
                    currentRootX += remW + HORIZONTAL_GAP;
                }
            });

            // Гарантуємо, що кожна нотатка має валідні числові координати
            nodes.forEach(n => {
                if (typeof n.targetX !== 'number' || isNaN(n.targetX)) {
                    n.targetX = START_X;
                }
                if (typeof n.targetY !== 'number' || isNaN(n.targetY)) {
                    n.targetY = START_Y;
                }
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
