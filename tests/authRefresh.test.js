import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/eventBus.js';
import '../js/supabaseClient.js';

describe('Auth Session Auto-Refresh and Safe Query (Step 1)', () => {
    let supabaseConfig;

    beforeEach(() => {
        vi.restoreAllMocks();
        supabaseConfig = window.App.supabaseConfig;
    });

    it('should correctly identify expired auth errors', () => {
        const { isAuthExpiredError } = supabaseConfig;

        expect(isAuthExpiredError(null)).toBe(false);
        expect(isAuthExpiredError({ message: 'Table not found' })).toBe(false);

        // PGRST303 error code
        expect(isAuthExpiredError({ code: 'PGRST303', message: 'JWT expired' })).toBe(true);
        // 401 HTTP status
        expect(isAuthExpiredError({ status: 401, message: 'Unauthorized' })).toBe(true);
        // Case insensitive message matching
        expect(isAuthExpiredError({ message: 'Error: jwt expired at timestamp' })).toBe(true);
        expect(isAuthExpiredError({ message: 'Token expired' })).toBe(true);
        expect(isAuthExpiredError({ details: 'invalid JWT token signature' })).toBe(true);
    });

    it('should execute normal query without refreshing if no auth error occurs', async () => {
        const mockQuery = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
        const refreshSpy = vi.spyOn(supabaseConfig, 'refreshAuthSession');

        const result = await supabaseConfig.safeSupabaseQuery(mockQuery);

        expect(result.data).toHaveLength(1);
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should automatically refresh session and retry query on JWT expired error', async () => {
        let callCount = 0;
        const mockQuery = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return { data: null, error: { code: 'PGRST303', message: 'JWT expired' } };
            }
            return { data: [{ id: 'refreshed_note' }], error: null };
        });

        const mockSession = { access_token: 'new_token', user: { id: 'u1' } };
        vi.spyOn(supabaseConfig, 'refreshAuthSession').mockResolvedValue(mockSession);

        const result = await supabaseConfig.safeSupabaseQuery(mockQuery);

        expect(result.data).toEqual([{ id: 'refreshed_note' }]);
        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(supabaseConfig.refreshAuthSession).toHaveBeenCalledTimes(1);
    });

    it('should emit auth:session_expired event when refresh fails', async () => {
        const eventSpy = vi.fn();
        window.App.events.on('auth:session_expired', eventSpy);

        window.App.supabase = {
            auth: {
                refreshSession: vi.fn().mockResolvedValue({
                    data: { session: null },
                    error: { message: 'Refresh token revoked' }
                })
            }
        };

        const result = await supabaseConfig.refreshAuthSession();

        expect(result).toBeNull();
        expect(eventSpy).toHaveBeenCalledTimes(1);
        expect(eventSpy.mock.calls[0][0].message).toBe('Refresh token revoked');
    });
});
