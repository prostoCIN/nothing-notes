// js/graph/graphPhysics.js - Чиста фізична математика симуляції розташування вершин графа
export const PHYSICS_CONFIG = {
    repulsionConstant: 6800,
    springConstant: 0.032,
    springLength: 145,
    centerGravity: 0.0032,
    damping: 0.87,
    maxSpeed: 16,
    minDistThreshold: 0.001
};

/**
 * Виконує один крок симуляції сил:
 * 1. Відштовхування Кулона між усіма парами вершин O(N^2 / 2) + буфер проти накладання.
 * 2. Пружність зв'язків Гука вздовж ребер (ієрархія, теги, закладки).
 * 3. Центрування навколо центру екрана, загасання (damping) та інтеграція швидкості.
 *
 * @param {Array<Object>} nodes - Масив вузлів { id, x, y, vx, vy, isRoot }
 * @param {Array<Object>} edges - Масив ребер { source, target, type, sourceNode?, targetNode? }
 * @param {Object} options - Додаткові опції { draggedNode, draggedNodeId, centerX, centerY }
 */
export function stepPhysics(nodes, edges, options = {}) {
    if (!nodes || nodes.length === 0) return;

    const {
        draggedNode = null,
        draggedNodeId = (draggedNode && draggedNode.id) ? draggedNode.id : null,
        centerX = 400,
        centerY = 300,
        repulsionConstant = PHYSICS_CONFIG.repulsionConstant,
        springConstant = PHYSICS_CONFIG.springConstant,
        springLength = PHYSICS_CONFIG.springLength,
        centerGravity = PHYSICS_CONFIG.centerGravity,
        damping = PHYSICS_CONFIG.damping,
        maxSpeed = PHYSICS_CONFIG.maxSpeed
    } = options;

    const count = nodes.length;

    // 1. Відштовхування (Кулон) + м'яке запобігання накладанню кіл
    for (let i = 0; i < count; i++) {
        const n1 = nodes[i];
        const isDragged1 = (n1 === draggedNode || (draggedNodeId && n1.id === draggedNodeId));

        for (let j = i + 1; j < count; j++) {
            const n2 = nodes[j];
            const isDragged2 = (n2 === draggedNode || (draggedNodeId && n2.id === draggedNodeId));

            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy + 1;
            const dist = Math.sqrt(distSq);

            const force = repulsionConstant / (distSq + 64);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!isDragged1) {
                n1.vx -= fx;
                n1.vy -= fy;
            }
            if (!isDragged2) {
                n2.vx += fx;
                n2.vy += fy;
            }

            // М'який буфер проти прямого накладання кіл
            const minAllowedDist = (n1.isRoot || n2.isRoot) ? 85 : 68;
            if (dist < minAllowedDist && dist > PHYSICS_CONFIG.minDistThreshold) {
                const overlap = minAllowedDist - dist;
                const push = (overlap / minAllowedDist) * 0.9;
                const cx = (dx / dist) * push;
                const cy = (dy / dist) * push;
                if (!isDragged1) {
                    n1.vx -= cx;
                    n1.vy -= cy;
                }
                if (!isDragged2) {
                    n2.vx += cx;
                    n2.vy += cy;
                }
            }
        }
    }

    // Швидка мапа для O(1) пошуку вузлів при розрахунку пружності зв'язків
    let nodeMap = null;

    // 2. Пружність зв'язків (Гук)
    if (Array.isArray(edges) && edges.length > 0) {
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            let n1 = edge.sourceNode;
            let n2 = edge.targetNode;

            if (!n1 || !n2) {
                if (!nodeMap) {
                    nodeMap = new Map();
                    for (let k = 0; k < count; k++) {
                        nodeMap.set(nodes[k].id, nodes[k]);
                    }
                }
                n1 = n1 || nodeMap.get(edge.source);
                n2 = n2 || nodeMap.get(edge.target);
            }

            if (!n1 || !n2) continue;

            const isDragged1 = (n1 === draggedNode || (draggedNodeId && n1.id === draggedNodeId));
            const isDragged2 = (n2 === draggedNode || (draggedNodeId && n2.id === draggedNodeId));

            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || PHYSICS_CONFIG.minDistThreshold;
            const targetLen = edge.type === 'tag'
                ? springLength * 1.5
                : (edge.type === 'bookmark' ? springLength * 1.3 : springLength);
            const displacement = dist - targetLen;

            const force = springConstant * displacement;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!isDragged1) {
                n1.vx += fx;
                n1.vy += fy;
            }
            if (!isDragged2) {
                n2.vx -= fx;
                n2.vy -= fy;
            }
        }
    }

    // 3. Центрування навколо реального центру, загасання (damping) та інтеграція швидкості
    for (let i = 0; i < count; i++) {
        const node = nodes[i];
        if (node === draggedNode || (draggedNodeId && node.id === draggedNodeId)) continue;

        node.vx -= (node.x - centerX) * centerGravity;
        node.vy -= (node.y - centerY) * centerGravity;

        node.vx *= damping;
        node.vy *= damping;

        node.x += node.vx;
        node.y += node.vy;

        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > maxSpeed) {
            node.vx = (node.vx / speed) * maxSpeed;
            node.vy = (node.vy / speed) * maxSpeed;
        }
    }
}
