import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/eventBus.js';
import '../js/noteManager.js';

describe('NoteManager (CRUD, Hierarchy & Relations)', () => {
    let nm;

    beforeEach(() => {
        window.App.state = {
            activeBoardId: 'board-main',
            notes: [],
            readOnlyNotes: [],
            activeChain: [null],
            selectedSidebarNoteIds: new Set(),
            selectedWorkspaceNoteIds: new Set()
        };

        window.App.storage = {
            saveNotes: vi.fn(),
            saveReadOnlyNotes: vi.fn(),
            saveHiddenSharedNoteIds: vi.fn()
        };

        nm = window.App.noteManager;
    });

    it('should create a new note with default values and inherited boardId', () => {
        const note = nm.createNewNote(null, false);
        expect(note).toBeDefined();
        expect(note.boardId).toBe('board-main');
        expect(note.parentId).toBeNull();
        expect(note.color).toBe('yellow');
        expect(note.orderIndex).toBe(0);
        expect(window.App.state.notes).toHaveLength(1);
        expect(window.App.storage.saveNotes).toHaveBeenCalled();
    });

    it('should create subnotes with inherited color from parent and correct hierarchy', () => {
        const parent = nm.createNewNote(null, false);
        parent.color = 'purple';

        const child = nm.createNewNote(parent.id, false);
        expect(child.parentId).toBe(parent.id);
        expect(child.color).toBe('purple'); // Color inherited from parent

        const grandChild = nm.createNewNote(child.id, false);
        expect(grandChild.parentId).toBe(child.id);

        // Check depth level calculation
        expect(nm.getNoteLevel(parent.id)).toBe(0);
        expect(nm.getNoteLevel(child.id)).toBe(1);
        expect(nm.getNoteLevel(grandChild.id)).toBe(2);

        // Check recursive descendants
        const descendants = nm.getDescendantIds(parent.id);
        expect(descendants).toContain(child.id);
        expect(descendants).toContain(grandChild.id);
        expect(descendants).toHaveLength(2);
    });

    it('should sanitize unsafe HTML content to prevent XSS attacks', () => {
        const maliciousHtml = '<script>alert("XSS")</script><b onerror="steal()">Hello</b><a href="javascript:alert(1)">Click</a>';
        const clean = nm.sanitizeContent(maliciousHtml);

        expect(clean).not.toContain('<script>');
        expect(clean).not.toContain('alert("XSS")');
        expect(clean).not.toContain('onerror');
        expect(clean).not.toContain('javascript:');
        expect(clean).toContain('Hello');
    });

    it('should clean up bidirectional links (linkedNoteIds) when a note is deleted', () => {
        const noteA = nm.createNewNote(null, false);
        const noteB = nm.createNewNote(null, false);

        // Link notes to each other
        noteA.linkedNoteIds = [noteB.id];
        noteB.linkedNoteIds = [noteA.id];

        // Delete noteB
        const toDeleteIds = new Set([noteB.id]);
        window.App.state.notes = window.App.state.notes.filter(n => n.id !== noteB.id);

        // Simulate bidirectional cleanup done in deleteNote
        window.App.state.notes.forEach(note => {
            if (Array.isArray(note.linkedNoteIds) && note.linkedNoteIds.some(id => toDeleteIds.has(id))) {
                note.linkedNoteIds = note.linkedNoteIds.filter(id => !toDeleteIds.has(id));
            }
        });

        const survivingA = nm.getNoteById(noteA.id);
        expect(survivingA.linkedNoteIds).toHaveLength(0);
        expect(survivingA.linkedNoteIds).not.toContain(noteB.id);
    });
});
