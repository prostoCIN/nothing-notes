import { describe, it, expect, beforeEach } from 'vitest';
import { eventBus, events } from '../js/eventBus.js';
import { imageDb } from '../js/imageDb.js';
import { notesDb } from '../js/notesDb.js';
import { HashRouter, router } from '../js/router.js';
import { state, storage, store, NOTE_COLORS, FONT_SIZES } from '../js/state.js';
import '../js/types.js';

describe('Architectural Modular Exports & window.App Facade (Step 5)', () => {
    describe('ES Module Direct Exports', () => {
        it('should export eventBus and events directly as singleton', () => {
            expect(eventBus).toBeDefined();
            expect(events).toBe(eventBus);
            expect(typeof eventBus.on).toBe('function');
            expect(typeof eventBus.emit).toBe('function');
        });

        it('should export imageDb directly with IndexedDB methods', () => {
            expect(imageDb).toBeDefined();
            expect(typeof imageDb.init).toBe('function');
            expect(typeof imageDb.getImage).toBe('function');
            expect(typeof imageDb.saveImage).toBe('function');
        });

        it('should export notesDb directly with full notes store methods', () => {
            expect(notesDb).toBeDefined();
            expect(typeof notesDb.init).toBe('function');
            expect(typeof notesDb.saveNote).toBe('function');
            expect(typeof notesDb.getAllNotes).toBe('function');
            expect(typeof notesDb.hydrateNotes).toBe('function');
        });

        it('should export HashRouter and router instance directly', () => {
            expect(HashRouter).toBeDefined();
            expect(router).toBeDefined();
            expect(typeof router.add).toBe('function');
            expect(typeof router.navigate).toBe('function');
        });

        it('should export state, storage, and store directly', () => {
            expect(state).toBeDefined();
            expect(storage).toBeDefined();
            expect(store).toBeDefined();
            expect(Array.isArray(NOTE_COLORS)).toBe(true);
            expect(Array.isArray(FONT_SIZES)).toBe(true);
        });
    });

    describe('window.App Facade Backwards Compatibility', () => {
        it('should maintain window.App facade identical to direct exports', () => {
            expect(window.App.eventBus).toBe(eventBus);
            expect(window.App.events).toBe(events);
            expect(window.App.imageDb).toBe(imageDb);
            expect(window.App.notesDb).toBe(notesDb);
            expect(window.App.router).toBe(router);
            expect(window.App.state).toBe(state);
            expect(window.App.storage).toBe(storage);
            expect(window.App.store).toBe(store);
        });
    });
});
