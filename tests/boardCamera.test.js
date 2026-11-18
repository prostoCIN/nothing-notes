import { describe, it, expect, beforeEach } from 'vitest';
import '../js/board/boardInteraction.js';
import '../js/board/boardCameraStorage.js';

describe('BoardCameraStorage & Viewport Mathematics', () => {
    let cameraStorage;

    beforeEach(() => {
        window.localStorage.clear();
        cameraStorage = window.App.boardCameraStorage;
    });

    it('should save and retrieve camera coordinates for boards', () => {
        const boardId = 'board-alpha';
        const cam = { x: 120, y: -45, zoom: 0.85 };

        cameraStorage.saveCamera(boardId, cam, true);
        expect(cameraStorage.hasSavedCamera(boardId)).toBe(true);
        expect(cameraStorage.hasSavedCamera('unknown-board')).toBe(false);

        const retrieved = cameraStorage.getSavedCamera(boardId);
        expect(retrieved).toEqual(cam);
    });

    it('should calculate areNotesInViewport correctly', () => {
        const container = {
            getBoundingClientRect: () => ({ width: 1000, height: 800 })
        };
        const canvas = { width: 1000, height: 800 };
        const camera = { x: 500, y: 400, zoom: 1 };

        // Notes located near the center
        const nodesNearCenter = [
            { x: 450, y: 350, width: 200, height: 100 }
        ];
        expect(cameraStorage.areNotesInViewport(nodesNearCenter, container, canvas, camera)).toBe(true);

        // Notes located thousands of pixels away
        const nodesFarAway = [
            { x: 10000, y: 15000, width: 200, height: 100 }
        ];
        expect(cameraStorage.areNotesInViewport(nodesFarAway, container, canvas, camera)).toBe(false);
    });

    it('should center camera on nodes and fit bounding box', () => {
        const container = {
            getBoundingClientRect: () => ({ width: 1000, height: 800 })
        };
        const canvas = { width: 1000, height: 800 };
        const camera = { x: 0, y: 0, zoom: 1 };

        const nodes = [
            { x: 100, y: 100, width: 300, height: 200 },
            { x: 700, y: 500, width: 300, height: 200 }
        ];

        let drawn = false;
        cameraStorage.centerCameraOnAllNodes({
            nodes,
            container,
            canvas,
            camera,
            onResize: () => {},
            onDraw: () => { drawn = true; },
            boardId: 'board-fit-test'
        });

        expect(drawn).toBe(true);
        expect(camera.zoom).toBeGreaterThan(0.2);
        expect(camera.zoom).toBeLessThanOrEqual(1.0);
        expect(cameraStorage.hasSavedCamera('board-fit-test')).toBe(true);
    });
});
