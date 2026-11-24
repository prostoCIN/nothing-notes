// js/supabaseClient.js - Ініціалізація клієнта Supabase для хмарної синхронізації
import { createClient } from '@supabase/supabase-js';

window.App = window.App || {};
window.supabase = window.supabase || { createClient };

(function() {
    const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://sycegfwlajxdaoahqzfp.supabase.co';
    const SUPABASE_ANON_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Y2VnZndsYWp4ZGFvYWhxemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTAyMDUsImV4cCI6MjEwMzY4NjIwNX0.h4G6QzUpxZmnjo8F4DYNkelfAE4WKTR4Z3-JA68BFQc';

    function initClient() {
        const factory = (window.supabase && window.supabase.createClient) || createClient;
        if (factory) {
            window.App.supabase = factory(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
        }
    }

    initClient();

    function isAuthExpiredError(error) {
        if (!error) return false;
        const msg = String(error.message || error.error_description || error.details || '').toLowerCase();
        const code = String(error.code || '');
        const status = Number(error.status || 0);
        return (
            code === 'PGRST303' ||
            status === 401 ||
            msg.includes('jwt expired') ||
            msg.includes('token expired') ||
            msg.includes('invalid jwt')
        );
    }

    let isRefreshing = false;
    let refreshPromise = null;

    async function refreshAuthSession() {
        if (isRefreshing && refreshPromise) {
            return refreshPromise;
        }
        const supabase = window.App?.supabase;
        if (!supabase || !supabase.auth) return null;

        isRefreshing = true;
        refreshPromise = (async () => {
            try {
                console.log('[CloudSync] 🔄 JWT token expired or unauthorized. Attempting silent session refresh...');
                const { data, error } = await supabase.auth.refreshSession();
                if (error || !data?.session) {
                    console.warn('[CloudSync] ⚠️ Silent session refresh failed:', error?.message);
                    if (window.App.events) {
                        window.App.events.emit('auth:session_expired', error);
                    }
                    return null;
                }
                console.log('[CloudSync] ✅ Session successfully refreshed silently!');
                if (window.App.accountManager && data.session) {
                    window.App.accountManager.saveAccountFromSession(data.session);
                }
                if (window.App.events) {
                    window.App.events.emit('auth:session_refreshed', data.session);
                }
                return data.session;
            } catch (e) {
                console.error('[CloudSync] Exception during refreshSession:', e);
                if (window.App.events) {
                    window.App.events.emit('auth:session_expired', e);
                }
                return null;
            } finally {
                isRefreshing = false;
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    }

    async function safeSupabaseQuery(queryFn) {
        if (typeof queryFn !== 'function') return null;
        const doRefresh = () => (window.App.supabaseConfig?.refreshAuthSession ? window.App.supabaseConfig.refreshAuthSession() : refreshAuthSession());
        try {
            let result = await queryFn();
            if (result && isAuthExpiredError(result.error)) {
                const session = await doRefresh();
                if (session) {
                    result = await queryFn();
                }
            }
            return result;
        } catch (err) {
            if (isAuthExpiredError(err)) {
                const session = await doRefresh();
                if (session) {
                    return await queryFn();
                }
            }
            throw err;
        }
    }

    window.App.supabaseConfig = {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        storageBucket: 'note-images',
        initClient,
        isAuthExpiredError,
        refreshAuthSession,
        safeSupabaseQuery
    };
})();
