// js/graph/graphSimulation.worker.js - Фоновий Web Worker фізичної симуляції графа
import { stepPhysics } from './graphPhysics.js';

let workerNodes = [];
let workerEdges = [];
let idToIndex = new Map();

self.onmessage = function(e) {
    const data = e.data;
    if (!data) return;

    switch (data.type) {
        case 'init': {
            workerNodes = (data.nodes || []).map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                vx: n.vx || 0,
                vy: n.vy || 0,
                isRoot: !!n.isRoot
            }));

            idToIndex = new Map();
            workerNodes.forEach((n, idx) => idToIndex.set(n.id, idx));

            workerEdges = (data.edges || []).map(edge => ({
                source: edge.source,
                target: edge.target,
                type: edge.type,
                sourceNode: workerNodes[idToIndex.get(edge.source)],
                targetNode: workerNodes[idToIndex.get(edge.target)]
            }));
            break;
        }

        case 'step': {
            if (workerNodes.length === 0) return;

            const {
                draggedNodeId,
                draggedX,
                draggedY,
                centerX = 400,
                centerY = 300
            } = data;

            // Якщо вузол перетягується користувачем, оновлюємо координати у воркері
            if (draggedNodeId && idToIndex.has(draggedNodeId)) {
                const idx = idToIndex.get(draggedNodeId);
                workerNodes[idx].x = draggedX;
                workerNodes[idx].y = draggedY;
                workerNodes[idx].vx = 0;
                workerNodes[idx].vy = 0;
            }

            // Розрахунок сил
            stepPhysics(workerNodes, workerEdges, {
                draggedNodeId,
                centerX,
                centerY
            });

            // Пакуємо x, y, vx, vy у Float32Array для надшвидкої передачі без копіювання
            const count = workerNodes.length;
            const buffer = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) {
                const n = workerNodes[i];
                buffer[i * 4] = n.x;
                buffer[i * 4 + 1] = n.y;
                buffer[i * 4 + 2] = n.vx;
                buffer[i * 4 + 3] = n.vy;
            }

            self.postMessage({
                type: 'tick',
                buffer: buffer.buffer
            }, [buffer.buffer]);
            break;
        }

        case 'stop': {
            workerNodes = [];
            workerEdges = [];
            idToIndex.clear();
            break;
        }
    }
};
