import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/eventBus.js';
import '../js/state.js';
import '../js/board/boardCables.js';
import '../js/board/boardLayout.js';
import '../js/noteManager.js';

describe('Board Performance & Batch Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should save multiple board positions in a single batch operation', () => {
        const storage = window.App.storage;
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        const positions = [
            { id: 'note-1', canvasX: 100, canvasY: 150 },
            { id: 'note-2', canvasX: 300, canvasY: 450 },
            { id: 'note-3', canvasX: 600, canvasY: 200 }
        ];

        storage.saveBoardPositionsBatch(positions);

        // setItem for minimal_board_positions must be called exactly once
        const boardPositionCalls = setItemSpy.mock.calls.filter(call => call[0] === 'minimal_board_positions');
        expect(boardPositionCalls.length).toBe(1);

        const savedMap = JSON.parse(localStorage.getItem('minimal_board_positions'));
        expect(savedMap['note-1'].canvasX).toBe(100);
        expect(savedMap['note-2'].canvasX).toBe(300);
        expect(savedMap['note-3'].canvasY).toBe(200);

        setItemSpy.mockRestore();
    });

    it('should calculate cable paths smoothly for hierarchical connections', () => {
        const cables = window.App.boardCables;
        const sourceNode = { id: 'root', x: 100, y: 100, width: 380, height: 140 };
        const targetNode = { id: 'child', x: 100, y: 350, width: 380, height: 140 };

        const path = cables.calculatePath(sourceNode, targetNode);
        expect(path).toBeDefined();
        expect(path.x1).toBe(sourceNode.x + 190);
        expect(path.y1).toBe(sourceNode.y + 140);
        expect(path.x2).toBe(targetNode.x + 190);
        expect(path.y2).toBe(targetNode.y);
    });

    it('should assign canvas coordinates at creation time in noteManager', () => {
        const state = window.App.state;
        state.activeBoardId = 'default_board';
        state.notes = [];

        const note = window.App.noteManager.createNewNote(null, false, {
            canvasX: 250,
            canvasY: 420
        });

        expect(note).toBeDefined();
        expect(note.canvasX).toBe(250);
        expect(note.canvasY).toBe(420);
        expect(note.boardX).toBe(250);
        expect(note.boardY).toBe(420);
    });

    it('should perform autoLayout without animation and update node coordinates immediately', () => {
        const nodes = [
            { id: 'p1', x: 0, y: 0, width: 380, height: 140, parentId: null },
            { id: 'c1', x: 0, y: 0, width: 380, height: 140, parentId: 'p1' }
        ];
        let completed = false;

        window.App.boardLayout.autoLayout(nodes, [], {
            animate: false,
            onComplete: () => { completed = true; }
        });

        expect(completed).toBe(true);
        expect(typeof nodes[0].x).toBe('number');
        expect(nodes[0].x).toBeGreaterThanOrEqual(60);
        expect(typeof nodes[1].y).toBe('number');
        expect(nodes[1].y).toBeGreaterThan(nodes[0].y);
    });
});
