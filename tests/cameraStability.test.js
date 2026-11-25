// tests/cameraStability.test.js - Unit tests for Camera Preservation on Undo/Redo & Tab Resume
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/board/boardInteraction.js';
import '../js/board/boardCameraStorage.js';
import '../js/board/boardView.js';

describe('Camera & Scroll Stability (Tab Resume & Undo/Redo)', () => {
    let boardView;
    let cameraStorage;

    beforeEach(() => {
        window.localStorage.clear();
        boardView = window.App.boardView;
        cameraStorage = window.App.boardCameraStorage;

        window.App.state = {
            viewMode: 'board',
            activeBoardId: 'b_stability_test',
            notes: [
                { id: 'n1', boardId: 'b_stability_test', title: 'Note 1', x: 200, y: 1500, width: 380, height: 140 }
            ]
        };
        window.App.boardManager = {
            getActiveBoard: () => ({ id: 'b_stability_test', name: 'Test Board' })
        };
    });

    it('preserves camera coordinates when preserveCamera option is true', () => {
        const boardId = 'b_stability_test';
        const customCam = { x: 340, y: -800, zoom: 0.9 };
        cameraStorage.saveCamera(boardId, customCam, true);

        const interaction = window.App.boardInteraction;
        interaction.camera.x = customCam.x;
        interaction.camera.y = customCam.y;
        interaction.camera.zoom = customCam.zoom;

        // Calling buildBoardData with preserveCamera: true must NOT reset camera
        boardView.buildBoardData({ preserveCamera: true });

        expect(interaction.camera.x).toBe(customCam.x);
        expect(interaction.camera.y).toBe(customCam.y);
        expect(interaction.camera.zoom).toBe(customCam.zoom);
    });

    it('centerCameraOnAllNodes is only invoked when explicitly requested or on fresh load without saved camera', () => {
        const spyCenter = vi.spyOn(boardView, 'centerCameraOnAllNodes');

        // With preserveCamera: true, centerCameraOnAllNodes should NOT be called
        boardView.buildBoardData({ preserveCamera: true });
        expect(spyCenter).not.toHaveBeenCalled();

        spyCenter.mockRestore();
    });
});
