// js/graph/graphSimulation.js - Симуляція фізики розташування вузлів графа (Force-Directed Graph)
window.App = window.App || {};

(function() {
    window.App.graphSimulation = {
        /**
         * Один крок розрахунку фізики сил тяжіння та відштовхування
         */
        step(nodes, edges, options = {}) {
            if (!nodes || nodes.length === 0) return;

            const {
                draggedNode = null,
                width = 800,
                height = 600
            } = options;

            const repulsionConstant = 1200;
            const springConstant = 0.04;
            const springLength = 110;
            const centerGravity = 0.008;
            const damping = 0.85;

            // 1. Сила відштовхування між усіма парами вузлів (Кулонівська сила)
            for (let i = 0; i < nodes.length; i++) {
                const n1 = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const n2 = nodes[j];
                    const dx = n2.x - n1.x;
                    const dy = n2.y - n1.y;
                    const distSq = dx * dx + dy * dy + 1;
                    const dist = Math.sqrt(distSq);

                    const force = repulsionConstant / (distSq + 20);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

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

            // 2. Сила пружності зв'язків між з'єднаними вузлами (Закон Гука)
            edges.forEach(edge => {
                const n1 = edge.sourceNode;
                const n2 = edge.targetNode;
                if (!n1 || !n2) return;

                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const displacement = dist - (edge.type === 'tag' ? springLength * 1.4 : springLength);

                const force = springConstant * displacement;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (n1 !== draggedNode) {
                    n1.vx += fx;
                    n1.vy += fy;
                }
                if (n2 !== draggedNode) {
                    n2.vx -= fx;
                    n2.vy -= fy;
                }
            });

            // 3. Сила тяжіння до центру координат (0, 0)
            nodes.forEach(node => {
                if (node === draggedNode) return;

                node.vx -= node.x * centerGravity;
                node.vy -= node.y * centerGravity;

                // Застосування швидкості з демпфуванням
                node.vx *= damping;
                node.vy *= damping;

                node.x += node.vx;
                node.y += node.vy;

                // Обмеження максимальної швидкості
                const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                const maxSpeed = 15;
                if (speed > maxSpeed) {
                    node.vx = (node.vx / speed) * maxSpeed;
                    node.vy = (node.vy / speed) * maxSpeed;
                }
            });
        }
    };
})();
