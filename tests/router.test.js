import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/router.js';

describe('HashRouter', () => {
    let router;

    beforeEach(() => {
        router = new window.App.HashRouter();
    });

    it('should parse route params correctly', () => {
        const handler = vi.fn();
        router.add('/board/:boardId', handler);

        router._dispatch('#/board/board_abc123');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
            params: { boardId: 'board_abc123' }
        }));
    });

    it('should parse multi-level params and mode', () => {
        const handler = vi.fn();
        router.add('/board/:boardId/:mode', handler);

        router._dispatch('#/board/board_999/canvas');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
            params: { boardId: 'board_999', mode: 'canvas' }
        }));
    });

    it('should parse query strings correctly', () => {
        const handler = vi.fn();
        router.add('/share/:token', handler);

        router._dispatch('#/share/sh_xyz123?subnotes=1&readonly=true');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
            params: { token: 'sh_xyz123' },
            query: { subnotes: '1', readonly: 'true' }
        }));
    });

    it('should safely ignore unmatched routes without errors', () => {
        const handler = vi.fn();
        router.add('/board/:boardId', handler);

        const matched = router._dispatch('#/unknown/path');
        expect(matched).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });
});
