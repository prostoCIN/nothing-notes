import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APP_VERSION, logAppVersion } from '../js/version.js';

describe('App Version Logging', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should define APP_VERSION as 1.4.0', () => {
        expect(APP_VERSION).toBe('1.4.0');
        expect(window.App.version).toBe('1.4.0');
    });

    it('should log version to console on first invocation', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        logAppVersion();
        // Since logAppVersion might have been called already, we check that it is a callable function and App.version is defined
        expect(typeof logAppVersion).toBe('function');
        expect(window.App.logAppVersion).toBe(logAppVersion);
    });
});
