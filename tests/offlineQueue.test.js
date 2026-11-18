import { describe, it, expect, beforeEach } from 'vitest';
import '../js/sync/offlineQueue.js';

describe('OfflineQueue & Tombstone Retention', () => {
    let q;

    beforeEach(() => {
        window.localStorage.clear();
        q = window.App.offlineQueue;
    });

    it('should track offline created notes and persist to storage', () => {
        q.markOfflineCreated('note-123');
        expect(q.isOfflineCreated('note-123')).toBe(true);
        expect(q.isOfflineCreated('note-456')).toBe(false);

        const stored = JSON.parse(window.localStorage.getItem('minimal_offline_created_ids'));
        expect(stored).toContain('note-123');

        q.unmarkOfflineCreated('note-123');
        expect(q.isOfflineCreated('note-123')).toBe(false);
    });

    it('should retain locally deleted IDs (tombstones) to prevent resurrection', () => {
        q.persistDeletedId('deleted-note-999');
        expect(q.isLocallyDeleted('deleted-note-999')).toBe(true);
        expect(q.isLocallyDeleted('alive-note-111')).toBe(false);

        const stored = JSON.parse(window.localStorage.getItem('minimal_locally_deleted_ids'));
        expect(stored).toContain('deleted-note-999');
    });

    it('should manage offline sync action queue (enqueue and deduplicate)', () => {
        q.queueOfflineAction({ id: 'note-1', type: 'update', data: { title: 'First' } });
        q.queueOfflineAction({ id: 'note-1', type: 'update', data: { title: 'Second' } });

        const queue = q.getOfflineQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].data.title).toBe('Second');

        q.removeOfflineAction('note-1');
        expect(q.getOfflineQueue()).toHaveLength(0);
    });
});
