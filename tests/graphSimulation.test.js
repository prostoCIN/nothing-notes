import { describe, it, expect, beforeEach } from 'vitest';
import { stepPhysics, PHYSICS_CONFIG } from '../js/graph/graphPhysics.js';
import '../js/graph/graphSimulation.js';

describe('Graph Simulation & Physics (Step 4)', () => {
    describe('Pure Physics (stepPhysics)', () => {
        it('should push two close nodes apart via Coulomb repulsion', () => {
            const nodes = [
                { id: '1', x: 100, y: 100, vx: 0, vy: 0, isRoot: false },
                { id: '2', x: 110, y: 100, vx: 0, vy: 0, isRoot: false }
            ];

            stepPhysics(nodes, [], { centerX: 400, centerY: 300 });

            // Node 1 should be pushed left (negative vx), Node 2 right (positive vx)
            expect(nodes[0].vx).toBeLessThan(0);
            expect(nodes[1].vx).toBeGreaterThan(0);
            expect(nodes[0].x).toBeLessThan(100);
            expect(nodes[1].x).toBeGreaterThan(110);
        });

        it('should apply extra buffer force when nodes are closer than minAllowedDist', () => {
            const nodesClose = [
                { id: '1', x: 200, y: 200, vx: 0, vy: 0, isRoot: false },
                { id: '2', x: 220, y: 200, vx: 0, vy: 0, isRoot: false } // dist = 20 < 68
            ];
            const nodesFar = [
                { id: '3', x: 200, y: 200, vx: 0, vy: 0, isRoot: false },
                { id: '4', x: 275, y: 200, vx: 0, vy: 0, isRoot: false } // dist = 75 > 68
            ];

            stepPhysics(nodesClose, [], { centerX: 400, centerY: 300 });
            stepPhysics(nodesFar, [], { centerX: 400, centerY: 300 });

            // Repulsion + overlap push on close nodes should be much stronger
            expect(Math.abs(nodesClose[0].vx)).toBeGreaterThan(Math.abs(nodesFar[0].vx));
        });

        it('should attract connected nodes when distance exceeds spring length', () => {
            const n1 = { id: 'a', x: 100, y: 200, vx: 0, vy: 0, isRoot: false };
            const n2 = { id: 'b', x: 400, y: 200, vx: 0, vy: 0, isRoot: false }; // dist = 300 > 145
            const nodes = [n1, n2];
            const edges = [
                { source: 'a', target: 'b', type: 'hierarchy', sourceNode: n1, targetNode: n2 }
            ];

            stepPhysics(nodes, edges, { centerX: 250, centerY: 200, repulsionConstant: 0 });

            // Because dist > springLength, spring pulls them towards each other:
            // n1 moves towards positive x, n2 moves towards negative x
            expect(n1.vx).toBeGreaterThan(0);
            expect(n2.vx).toBeLessThan(0);
        });

        it('should keep dragged node position unchanged while other nodes react', () => {
            const dragged = { id: 'd', x: 200, y: 200, vx: 0, vy: 0, isRoot: false };
            const freeNode = { id: 'f', x: 210, y: 200, vx: 0, vy: 0, isRoot: false };
            const nodes = [dragged, freeNode];

            stepPhysics(nodes, [], { draggedNode: dragged, centerX: 400, centerY: 300 });

            // Dragged node must stay exactly at (200, 200) with 0 velocity
            expect(dragged.x).toBe(200);
            expect(dragged.y).toBe(200);
            expect(dragged.vx).toBe(0);
            expect(dragged.vy).toBe(0);

            // Free node must have moved away
            expect(freeNode.vx).toBeGreaterThan(0);
            expect(freeNode.x).toBeGreaterThan(210);
        });

        it('should clamp velocity to maxSpeed', () => {
            const node = { id: 'fast', x: 1000, y: 1000, vx: 100, vy: 100, isRoot: false };
            stepPhysics([node], [], { centerX: 0, centerY: 0, maxSpeed: 16 });

            const speed = Math.hypot(node.vx, node.vy);
            expect(speed).toBeLessThanOrEqual(16.001);
        });
    });

    describe('Graph Simulation Facade (window.App.graphSimulation)', () => {
        it('should expose graphSimulation with step, init, stop, destroy methods', () => {
            const sim = window.App.graphSimulation;
            expect(sim).toBeDefined();
            expect(typeof sim.step).toBe('function');
            expect(typeof sim.init).toBe('function');
            expect(typeof sim.stop).toBe('function');
            expect(typeof sim.destroy).toBe('function');
            expect(typeof sim.stepSync).toBe('function');
        });

        it('should safely step synchronously in fallback mode when worker is unavailable in tests', () => {
            const sim = window.App.graphSimulation;
            const nodes = [
                { id: 'n1', x: 100, y: 100, vx: 0, vy: 0 },
                { id: 'n2', x: 120, y: 100, vx: 0, vy: 0 }
            ];

            expect(() => {
                sim.init(nodes, []);
                sim.step(nodes, [], { centerX: 400, centerY: 300 });
                sim.stop();
                sim.destroy();
            }).not.toThrow();
        });
    });
});
