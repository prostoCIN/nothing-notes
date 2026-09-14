// js/supabaseClient.js - Ініціалізація клієнта Supabase для хмарної синхронізації
import { createClient } from '@supabase/supabase-js';

window.App = window.App || {};
window.supabase = window.supabase || { createClient };

(function() {
    const SUPABASE_URL = 'https://sycegfwlajxdaoahqzfp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Y2VnZndsYWp4ZGFvYWhxemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTAyMDUsImV4cCI6MjEwMzY4NjIwNX0.h4G6QzUpxZmnjo8F4DYNkelfAE4WKTR4Z3-JA68BFQc';

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

    window.App.supabaseConfig = {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        storageBucket: 'note-images',
        initClient
    };
})();
