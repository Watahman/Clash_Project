import { createClient } from '@supabase/supabase-js';

const LEGACY_USER_ID_KEY = 'id';
let client;

export class AuthConfigurationError extends Error {
    constructor() {
        super('Supabase Auth is niet geconfigureerd.');
        this.name = 'AuthConfigurationError';
    }
}

function authConfig() {
    return {
        url: String(import.meta.env.VITE_SUPABASE_URL || '').trim(),
        key: String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
    };
}

export function isAuthConfigured() {
    const config = authConfig();
    return Boolean(config.url && config.key);
}

export function getAuthClient() {
    if (!isAuthConfigured()) throw new AuthConfigurationError();
    if (!client) {
        const config = authConfig();
        client = createClient(config.url, config.key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }
    return client;
}

function rememberUser(user) {
    if (user?.id) localStorage.setItem(LEGACY_USER_ID_KEY, user.id);
    else localStorage.removeItem(LEGACY_USER_ID_KEY);
}

export async function syncAuthSession() {
    if (!isAuthConfigured()) return null;
    const { data, error } = await getAuthClient().auth.getSession();
    if (error) throw error;
    rememberUser(data.session?.user);
    return data.session || null;
}

export async function getAccessToken() {
    const session = await syncAuthSession();
    return session?.access_token || null;
}

export async function signInWithPassword(email, password) {
    const { data, error } = await getAuthClient().auth.signInWithPassword({
        email: String(email || '').trim(),
        password
    });
    if (error) throw error;
    rememberUser(data.user);
    return data;
}

export async function signUpWithPassword(name, email, password) {
    const { data, error } = await getAuthClient().auth.signUp({
        email: String(email || '').trim(),
        password,
        options: {
            data: { display_name: String(name || '').trim() }
        }
    });
    if (error) throw error;
    rememberUser(data.user && data.session ? data.user : null);
    return data;
}

export async function requestPasswordReset(email) {
    const redirectTo = new URL('./login.html', window.location.href).href;
    const { data, error } = await getAuthClient().auth.resetPasswordForEmail(
        String(email || '').trim(),
        { redirectTo }
    );
    if (error) throw error;
    return data;
}

export async function signInWithGoogle() {
    const redirectTo = new URL('../index.html', window.location.href).href;
    const { data, error } = await getAuthClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
    if (error) throw error;
    return data;
}

export async function changeAuthenticatedPassword(currentPassword, newPassword) {
    const client = getAuthClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const email = userData.user?.email;
    if (!email) throw new Error('Geen e-mailadres gevonden voor deze sessie.');

    const { error: verifyError } = await client.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) throw verifyError;

    const { data, error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
}

export async function signOut() {
    if (isAuthConfigured()) {
        const { error } = await getAuthClient().auth.signOut();
        if (error) throw error;
    }
    rememberUser(null);
}

export function onAuthStateChange(callback) {
    if (!isAuthConfigured()) return () => {};
    const { data } = getAuthClient().auth.onAuthStateChange((_event, session) => {
        rememberUser(session?.user);
        callback?.(session || null);
    });
    return () => data.subscription.unsubscribe();
}
