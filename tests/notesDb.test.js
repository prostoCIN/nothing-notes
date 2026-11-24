import { describe, it, expect, beforeEach } from 'vitest';
import '../js/notesDb.js';

describe('NotesDb (IndexedDB unlimited note storage)', () => {
    let db;

    beforeEach(() => {
        db = window.App.notesDb;
    });

    it('should save and retrieve a single note', async () => {
        const note = { id: 'note-test-1', title: 'Test 1', content: 'Long HTML content' };
        const saved = await db.saveNote(note);
        expect(saved).toBe(true);

        const all = await db.getAllNotes();
        const found = all.find(n => n.id === 'note-test-1');
        expect(found).toBeDefined();
        expect(found.content).toBe('Long HTML content');
    });

    it('should save batch of notes in one transaction', async () => {
        const notes = [
            { id: 'batch-1', title: 'B1', content: 'Content 1' },
            { id: 'batch-2', title: 'B2', content: 'Content 2' }
        ];

        const saved = await db.saveAllNotes(notes);
        expect(saved).toBe(true);

        const all = await db.getAllNotes();
        expect(all.some(n => n.id === 'batch-1')).toBe(true);
        expect(all.some(n => n.id === 'batch-2')).toBe(true);
    });

    it('should delete a note correctly', async () => {
        const note = { id: 'delete-me', title: 'Del' };
        await db.saveNote(note);

        const deleted = await db.deleteNote('delete-me');
        expect(deleted).toBe(true);

        const all = await db.getAllNotes();
        expect(all.some(n => n.id === 'delete-me')).toBe(false);
    });

    it('should hydrate empty local notes with content from IndexedDB', async () => {
        const idbNote = { id: 'hydrate-1', title: 'Hydrated Title', content: 'Stored in IDB' };
        await db.saveNote(idbNote);

        const localNotes = [{ id: 'hydrate-1', title: 'Hydrated Title', content: '' }];
        await db.hydrateNotes(localNotes);

        expect(localNotes[0].content).toBe('Stored in IDB');
    });
});
