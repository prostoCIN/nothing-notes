import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/eventBus.js';
import '../js/state.js';

describe('State & Store (Observable State & Proxy)', () => {
    let store;
    let state;

    beforeEach(() => {
        store = window.App.store;
        state = window.App.state;
    });

    it('should notify subscribers when viewMode is updated via store', () => {
        const subscriber = vi.fn();
        const unsubscribe = store.subscribe('viewMode', subscriber);

        store.setViewMode('board', false);
        expect(state.viewMode).toBe('board');
        expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({ value: 'board' }));

        store.setViewMode('graph', false);
        expect(state.viewMode).toBe('graph');
        expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({ value: 'graph' }));

        unsubscribe();
        store.setViewMode('columns', false);
        expect(subscriber).toHaveBeenCalledTimes(2);
    });

    it('should manage column layouts per parent key', () => {
        store.setColumnLayout('col-root', 'grid', false);
        expect(state.columnLayouts['col-root']).toBe('grid');

        store.setColumnLayout('col-sub-1', 'list', false);
        expect(state.columnLayouts['col-sub-1']).toBe('list');
    });

    it('should reset ephemeral state without corrupting persistent notes or boards', () => {
        state.isWorkspaceSelectMode = true;
        state.selectedWorkspaceNoteIds.add('note-test-99');
        state.activeNoteId = 'note-test-99';

        store.resetEphemeral();

        expect(state.isWorkspaceSelectMode).toBe(false);
        expect(state.selectedWorkspaceNoteIds.size).toBe(0);
        expect(state.activeNoteId).toBeNull();
    });
});
