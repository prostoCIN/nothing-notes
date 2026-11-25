// tests/themeSync.test.js - Unit tests for theme presets synchronization, deletion, and resurrection prevention
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/settings/settingsThemeTab.js';

describe('Theme Presets Synchronization & Deletion (Tombstones)', () => {
    const TEST_UID = 'user_test_theme_sync_123';
    let themeTab;
    let mockSupabase;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('style');

        themeTab = window.App?.settingsThemeTab;
        expect(themeTab).toBeDefined();

        // Mock Supabase & Auth
        mockSupabase = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            id: TEST_UID,
                            user_metadata: {}
                        }
                    }
                }),
                updateUser: vi.fn().mockImplementation(async ({ data }) => {
                    return {
                        data: {
                            user: {
                                id: TEST_UID,
                                user_metadata: { ...data }
                            }
                        },
                        error: null
                    };
                })
            }
        };

        window.App.supabase = mockSupabase;
        window.App.cloudSync = {
            getCurrentUser: () => ({
                id: TEST_UID,
                user_metadata: {}
            }),
            currentUser: {
                id: TEST_UID,
                user_metadata: {}
            }
        };

        localStorage.setItem('nothing_notes_active_account_id', TEST_UID);
    });

    it('should create and save a new custom preset locally and sync to cloud', async () => {
        themeTab.setCustomColor('--accent-color', '#ff5500');

        const preset = themeTab.saveCurrentAsPreset('Warm Sunset');
        expect(preset).toBeDefined();
        expect(preset.name).toBe('Warm Sunset');
        expect(preset.isCustom).toBe(true);
        expect(preset.createdAt).toBeGreaterThan(0);
        expect(preset.colors['--accent-color']).toBe('#ff5500');

        const saved = themeTab.getSavedPresets(TEST_UID);
        expect(saved.length).toBe(1);
        expect(saved[0].id).toBe(preset.id);

        const activeId = themeTab.getActivePresetId();
        expect(activeId).toBe(preset.id);
    });

    it('should record tombstone when preset is deleted and reset active preset if deleted', () => {
        themeTab.setCustomColor('--accent-color', '#336699');
        const preset = themeTab.saveCurrentAsPreset('Ocean Blue');
        expect(themeTab.getActivePresetId()).toBe(preset.id);

        // Delete preset
        themeTab.deletePreset(preset.id);

        // 1. Preset is removed from saved presets
        const saved = themeTab.getSavedPresets(TEST_UID);
        expect(saved.find(p => p.id === preset.id)).toBeUndefined();

        // 2. Tombstone is stored
        const deletedIds = themeTab.getDeletedPresetIds(TEST_UID);
        expect(deletedIds).toContain(preset.id);

        // 3. Active preset resets safely to builtin_forest
        const activeKey = `nothing_notes_active_preset_${TEST_UID}`;
        expect(localStorage.getItem(activeKey)).toBe('builtin_forest');

        // 4. Custom colors cleared
        const colorsKey = `nothing_notes_custom_colors_${TEST_UID}`;
        expect(localStorage.getItem(colorsKey)).toBeNull();
    });

    it('prevents resurrection: Device B drops preset when receiving cloud metadata with tombstone', () => {
        const presetId = 'custom_test_resurrection_456';
        const preset = {
            id: presetId,
            name: 'Neon Violet',
            isCustom: true,
            createdAt: 100000,
            updatedAt: 100000,
            colors: { '--accent-color': '#a855f7' }
        };

        // Device B already has preset in local storage
        localStorage.setItem(`nothing_notes_theme_presets_${TEST_UID}`, JSON.stringify([preset]));
        expect(themeTab.getSavedPresets(TEST_UID).length).toBe(1);

        // Cloud state after Device A deleted the preset
        const mockUserFromCloud = {
            id: TEST_UID,
            user_metadata: {
                theme_presets: [],
                deleted_theme_preset_ids: [presetId],
                active_theme_preset_id: 'builtin_forest'
            }
        };

        // Device B syncs
        themeTab.loadThemesFromCloud(mockUserFromCloud);

        // Device B must NOT have the preset anymore
        const savedOnB = themeTab.getSavedPresets(TEST_UID);
        expect(savedOnB.find(p => p.id === presetId)).toBeUndefined();
        expect(savedOnB.length).toBe(0);

        // Device B must also have the tombstone
        const deletedOnB = themeTab.getDeletedPresetIds(TEST_UID);
        expect(deletedOnB).toContain(presetId);
    });

    it('prevents resurrection: preset created before last sync but missing in cloud is purged (even without cloud tombstone)', () => {
        const lastSync = 200000;
        localStorage.setItem(`nothing_notes_last_theme_sync_${TEST_UID}`, lastSync.toString());

        const olderPreset = {
            id: 'custom_old_missing_789',
            name: 'Old Theme',
            isCustom: true,
            createdAt: 150000, // Created BEFORE last sync
            colors: { '--accent-color': '#e11d48' }
        };

        localStorage.setItem(`nothing_notes_theme_presets_${TEST_UID}`, JSON.stringify([olderPreset]));

        // Cloud arrives with empty presets (deleted on another device) and empty tombstones
        const mockUserFromCloud = {
            id: TEST_UID,
            user_metadata: {
                theme_presets: [],
                deleted_theme_preset_ids: []
            }
        };

        themeTab.loadThemesFromCloud(mockUserFromCloud);

        // Preset created before last sync is recognized as deleted elsewhere, not resurrected
        const saved = themeTab.getSavedPresets(TEST_UID);
        expect(saved.length).toBe(0);
        expect(themeTab.getDeletedPresetIds(TEST_UID)).toContain('custom_old_missing_789');
    });

    it('preserves genuine offline preset created AFTER last sync', () => {
        const lastSync = 200000;
        localStorage.setItem(`nothing_notes_last_theme_sync_${TEST_UID}`, lastSync.toString());

        const offlinePreset = {
            id: 'custom_offline_new_111',
            name: 'Offline Theme',
            isCustom: true,
            createdAt: 250000, // Created AFTER last sync
            colors: { '--accent-color': '#06b6d4' }
        };

        localStorage.setItem(`nothing_notes_theme_presets_${TEST_UID}`, JSON.stringify([offlinePreset]));

        const mockUserFromCloud = {
            id: TEST_UID,
            user_metadata: {
                theme_presets: [],
                deleted_theme_preset_ids: []
            }
        };

        themeTab.loadThemesFromCloud(mockUserFromCloud);

        // Offline preset created after last sync is retained and merged!
        const saved = themeTab.getSavedPresets(TEST_UID);
        expect(saved.length).toBe(1);
        expect(saved[0].id).toBe('custom_offline_new_111');
    });

    it('cleans up active preset if it was deleted on another device', () => {
        const deletedPresetId = 'custom_active_remote_deleted_999';
        localStorage.setItem(`nothing_notes_active_preset_${TEST_UID}`, deletedPresetId);
        localStorage.setItem(`nothing_notes_custom_colors_${TEST_UID}`, JSON.stringify({
            '--accent-color': '#e11d48'
        }));

        const mockUserFromCloud = {
            id: TEST_UID,
            user_metadata: {
                theme_presets: [],
                deleted_theme_preset_ids: [deletedPresetId],
                active_theme_preset_id: 'builtin_forest'
            }
        };

        themeTab.loadThemesFromCloud(mockUserFromCloud);

        const activeKey = `nothing_notes_active_preset_${TEST_UID}`;
        expect(localStorage.getItem(activeKey)).toBe('builtin_forest');

        const colorsKey = `nothing_notes_custom_colors_${TEST_UID}`;
        expect(localStorage.getItem(colorsKey)).toBeNull();
    });

    it('protects built-in presets from being deleted or treated as custom', () => {
        const all = themeTab.getAllPresets();
        const forest = all.find(p => p.id === 'builtin_forest');
        expect(forest).toBeDefined();
        expect(forest.isCustom).toBe(false);

        // Attempting to delete built-in preset does nothing
        themeTab.deletePreset('builtin_forest');
        const allAfter = themeTab.getAllPresets();
        expect(allAfter.find(p => p.id === 'builtin_forest')).toBeDefined();
    });
});
