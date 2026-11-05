// js/graph/graphSimulation.js - Симуляція сил розташування вузлів графа
window.App = window.App || {};

(function() {
    window.App.graphSimulation = {
        step(nodes, edges, options = {}) {
            if (!nodes || nodes.length === 0) return;

            const {
                draggedNode = null,
                centerX = 400,
                centerY = 300
            } = options;

            // Більш простора симуляція з виразними відстанями між вершинами
            const repulsionConstant = 18000;
            const springConstant = 0.025;
            const springLength = 190;
            const centerGravity = 0.0018;
            const damping = 0.86;

            // Відштовхування (Кулон) + уникнення накладання кіл та підписів
            for (let i = 0; i < nodes.length; i++) {
                const n1 = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const n2 = nodes[j];
                    const dx = n2.x - n1.x;
                    const dy = n2.y - n1.y;
                    const distSq = dx * dx + dy * dy + 1;
                    const dist = Math.sqrt(distSq);

                    const force = repulsionConstant / (distSq + 100);
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

                    // Додатковий буфер розведення вузлів проти злипання кіл і текстових підписів
                    const minAllowedDist = (n1.isRoot || n2.isRoot) ? 125 : 100;
                    if (dist < minAllowedDist && dist > 0.001) {
                        const overlap = minAllowedDist - dist;
                        const push = (overlap / minAllowedDist) * 1.5;
                        const cx = (dx / dist) * push;
                        const cy = (dy / dist) * push;
                        if (n1 !== draggedNode) {
                            n1.vx -= cx;
                            n1.vy -= cy;
                        }
                        if (n2 !== draggedNode) {
                            n2.vx += cx;
                            n2.vy += cy;
                        }
                    }
                }
            }

            // Пружність зв'язків (Гук)
            edges.forEach(edge => {
                const n1 = edge.sourceNode;
                const n2 = edge.targetNode;
                if (!n1 || !n2) return;

                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const displacement = dist - (edge.type === 'tag' ? springLength * 1.5 : (edge.type === 'bookmark' ? springLength * 1.3 : springLength));

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

            // Центрування навколо реального центру
            nodes.forEach(node => {
                if (node === draggedNode) return;

                node.vx -= (node.x - centerX) * centerGravity;
                node.vy -= (node.y - centerY) * centerGravity;

                node.vx *= damping;
                node.vy *= damping;

                node.x += node.vx;
                node.y += node.vy;

                const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                const maxSpeed = 16;
                if (speed > maxSpeed) {
                    node.vx = (node.vx / speed) * maxSpeed;
                    node.vy = (node.vy / speed) * maxSpeed;
                }
            });
        }
    };
})();
