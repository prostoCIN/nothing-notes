import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APP_VERSION, COMMIT_HASH, logAppVersion } from '../js/version.js';

describe('App Version & Commit Logging', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should define APP_VERSION as 1.4.0 and COMMIT_HASH', () => {
        expect(APP_VERSION).toBe('1.4.0');
        expect(window.App.version).toBe('1.4.0');
        expect(typeof COMMIT_HASH).toBe('string');
        expect(window.App.commit).toBe(COMMIT_HASH);
    });

    it('should log version and commit hash to console on invocation', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        logAppVersion();
        expect(typeof logAppVersion).toBe('function');
        expect(window.App.logAppVersion).toBe(logAppVersion);
    });
});
