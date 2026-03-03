import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from './lib/supabase';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { queryClient } from './lib/queryClient';

// Initialize Capacitor App lifecycle
CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
    console.log('[CAPACITOR] App state changed. Is active:', isActive);

    if (isActive) {
        // Refresh session when app becomes active to maintain login state
        try {
            // First check if we actually have a session to refresh
            const { data: sessionData } = await supabase.auth.getSession();

            if (sessionData.session) {
                const { data, error } = await supabase.auth.refreshSession();

                if (error) {
                    // Ignore "Auth session missing" errors as they are expected if logged out
                    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
                        console.log('[AUTH] ℹ️ No active session to refresh (Session missing)');
                    } else {
                        console.error('[AUTH] Failed to refresh session on app resume:', error);
                    }
                } else if (data.session) {
                    console.log('[AUTH] ✅ Session refreshed successfully on app resume');
                }
            } else {
                console.log('[AUTH] ℹ️ No active session to refresh');
            }
        } catch (err: any) {
            // Silently handle common session missing errors
            if (err.name === 'AuthSessionMissingError' || err.message?.includes('Auth session missing')) {
                console.log('[AUTH] ℹ️ No active session to refresh (Catch)');
            } else {
                console.error('[AUTH] Unexpected error refreshing session:', err);
            }
        }

        // 2. Forcefully refetch all active queries to ensure data (attendance, subjects, etc.) 
        // is fresh when the phone is turned back on.
        try {
            queryClient.invalidateQueries();
            queryClient.refetchQueries({ type: 'active', stale: true });

            // Trigger focus refetch for visible queries
            window.dispatchEvent(new FocusEvent('focus'));
        } catch (queryErr) {
            console.error('[QUERY] Error refetching queries on resume:', queryErr);
        }
    }
});

// Render React app
createRoot(document.getElementById("root")!).render(
    <LanguageProvider>
        <App />
    </LanguageProvider>
);
