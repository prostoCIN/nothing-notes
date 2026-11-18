import { describe, it, expect, beforeEach } from 'vitest';
import '../js/eventBus.js';
import '../js/historyManager.js';

describe('HistoryManager (Undo/Redo with Smart Diff & Deduplication)', () => {
    let hm;

    beforeEach(() => {
        window.App.state = {
            activeBoardId: 'board-1',
            notes: [
                { id: 'note-1', boardId: 'board-1', title: 'Original Title', content: 'Original Content' }
            ]
        };
        window.App.storage = {
            saveNotes: () => {}
        };
        hm = window.App.historyManager;
    });

    it('should record distinct states and not record duplicates', () => {
        // First record
        hm.recordState('first edit');
        
        // Mutate note
        window.App.state.notes[0].title = 'Updated Title';
        hm.recordState('second edit');

        // Recording again without mutations should be deduplicated
        hm.recordState('duplicate edit');

        // Undo once should revert to 'Original Title'
        hm.undo();
        const noteAfterUndo = window.App.state.notes.find(n => n.id === 'note-1');
        expect(noteAfterUndo.title).toBe('Original Title');

        // Redo should restore 'Updated Title'
        hm.redo();
        const noteAfterRedo = window.App.state.notes.find(n => n.id === 'note-1');
        expect(noteAfterRedo.title).toBe('Updated Title');
    });

    it('should isolate undo/redo history between different boards', () => {
        // Board 1 edit
        window.App.state.activeBoardId = 'board-1';
        hm.recordState('b1 initial');
        window.App.state.notes[0].title = 'Board 1 Updated';
        hm.recordState('b1 modified');

        // Switch to Board 2
        window.App.state.activeBoardId = 'board-2';
        window.App.state.notes.push({ id: 'note-2', boardId: 'board-2', title: 'Board 2 Original' });
        hm.recordState('b2 initial');

        // Board 2 has no previous states to undo to
        hm.undo();
        expect(window.App.state.notes.find(n => n.id === 'note-2').title).toBe('Board 2 Original');

        // Switch back to Board 1
        window.App.state.activeBoardId = 'board-1';
        hm.undo();
        expect(window.App.state.notes.find(n => n.id === 'note-1').title).toBe('Original Title');
    });
});
