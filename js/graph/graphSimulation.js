// js/graph/graphSimulation.js - Клієнт фізичної симуляції графа з підтримкою Web Worker та синхронним Fallback
import { stepPhysics, PHYSICS_CONFIG } from './graphPhysics.js';

window.App = window.App || {};

(function() {
    let workerInstance = null;
    let isWorkerBusy = false;
    let hasWorkerFailed = false;
    let activeNodesRef = null;
    let activeEdgesRef = null;
    let currentDraggedNodeId = null;

    function getOrCreateWorker() {
        if (workerInstance || hasWorkerFailed) return workerInstance;

        try {
            if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
                workerInstance = new Worker(new URL('./graphSimulation.worker.js', import.meta.url), {
                    type: 'module'
                });

                workerInstance.onmessage = function(e) {
                    isWorkerBusy = false;
                    const data = e.data;
                    if (data && data.type === 'tick' && data.buffer && activeNodesRef) {
                        const arr = new Float32Array(data.buffer);
                        const count = Math.min(activeNodesRef.length, Math.floor(arr.length / 4));
                        for (let i = 0; i < count; i++) {
                            const node = activeNodesRef[i];
                            // Не перезаписуємо вузол, якщо його зараз тягне користувач на головному потоці
                            if (node && node.id !== currentDraggedNodeId) {
                                node.x = arr[i * 4];
                                node.y = arr[i * 4 + 1];
                                node.vx = arr[i * 4 + 2];
                                node.vy = arr[i * 4 + 3];
                            }
                        }
                    }
                };

                workerInstance.onerror = function(err) {
                    console.warn('[GraphSimulation] Web Worker encountered an error, switching to sync mode:', err);
                    hasWorkerFailed = true;
                    if (workerInstance) {
                        workerInstance.terminate();
                        workerInstance = null;
                    }
                };
            }
        } catch (err) {
            console.warn('[GraphSimulation] Cannot create Web Worker, using sync simulation:', err);
            hasWorkerFailed = true;
            workerInstance = null;
        }

        return workerInstance;
    }

    const graphSimulation = {
        CONFIG: PHYSICS_CONFIG,

        // Прямий розрахунок фізики (для тестів та синхронного використання)
        stepSync(nodes, edges, options = {}) {
            stepPhysics(nodes, edges, options);
        },

        // Ініціалізувати воркер списком вузлів та зв'язків
        init(nodes, edges) {
            activeNodesRef = nodes;
            activeEdgesRef = edges;
            isWorkerBusy = false;
            currentDraggedNodeId = null;

            const w = getOrCreateWorker();
            if (w && Array.isArray(nodes) && nodes.length > 0) {
                try {
                    w.postMessage({
                        type: 'init',
                        nodes: nodes.map(n => ({
                            id: n.id,
                            x: n.x,
                            y: n.y,
                            vx: n.vx || 0,
                            vy: n.vy || 0,
                            isRoot: !!n.isRoot
                        })),
                        edges: (edges || []).map(e => ({
                            source: e.source,
                            target: e.target,
                            type: e.type
                        }))
                    });
                } catch (err) {
                    console.warn('[GraphSimulation] Failed to post init message to worker:', err);
                }
            }
        },

        // Крок симуляції (викликається в requestAnimationFrame loop)
        step(nodes, edges, options = {}) {
            if (!nodes || nodes.length === 0) return;

            // Якщо масив вузлів змінився, але init не викликали окремо
            if (activeNodesRef !== nodes) {
                this.init(nodes, edges);
            }

            const draggedNode = options.draggedNode;
            currentDraggedNodeId = (draggedNode && draggedNode.id) ? draggedNode.id : null;

            const w = getOrCreateWorker();
            if (w && !hasWorkerFailed) {
                if (!isWorkerBusy) {
                    isWorkerBusy = true;
                    w.postMessage({
                        type: 'step',
                        draggedNodeId: currentDraggedNodeId,
                        draggedX: draggedNode ? draggedNode.x : 0,
                        draggedY: draggedNode ? draggedNode.y : 0,
                        centerX: options.centerX || 400,
                        centerY: options.centerY || 300
                    });
                }
            } else {
                // Fallback: прямий синхронний розрахунок
                stepPhysics(nodes, edges, options);
            }
        },

        stop() {
            isWorkerBusy = false;
            currentDraggedNodeId = null;
            if (workerInstance) {
                try {
                    workerInstance.postMessage({ type: 'stop' });
                } catch {}
            }
        },

        destroy() {
            this.stop();
            if (workerInstance) {
                workerInstance.terminate();
                workerInstance = null;
            }
            activeNodesRef = null;
            activeEdgesRef = null;
            isWorkerBusy = false;
            currentDraggedNodeId = null;
        },

        isWorkerActive() {
            return !!(workerInstance && !hasWorkerFailed);
        }
    };

    window.App.graphSimulation = graphSimulation;
})();

export { stepPhysics, PHYSICS_CONFIG };
