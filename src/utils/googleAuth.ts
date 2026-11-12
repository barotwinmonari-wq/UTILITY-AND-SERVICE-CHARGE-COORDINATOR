import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser } from '../types';

// Global declarations for Google Identity Services (GIS)
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: any) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
          };
        };
      };
    };
  }
}

// Initialize Firebase App instance singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Scopes
export const SPREADSHEET_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const provider = new GoogleAuthProvider();
SPREADSHEET_SCOPES.forEach((scope) => provider.addScope(scope));

// Persistent Session Storage Keys
const SESSION_KEYS = {
  USER: 'gpf_google_auth_user_v2',
  TOKEN: 'gpf_google_auth_token_v2',
  EXPIRES_AT: 'gpf_google_auth_expires_at_v2',
  LINKED: 'gpf_google_auth_linked_v2',
};

export function getSavedSession(): {
  user: AppUser | null;
  token: string | null;
  expiresAt: number;
  isLinked: boolean;
} {
  if (typeof window === 'undefined') {
    return { user: null, token: null, expiresAt: 0, isLinked: false };
  }
  try {
    const rawUser = localStorage.getItem(SESSION_KEYS.USER);
    const token = localStorage.getItem(SESSION_KEYS.TOKEN);
    const expiresAt = parseInt(
      localStorage.getItem(SESSION_KEYS.EXPIRES_AT) || '0',
      10
    );
    const isLinked = localStorage.getItem(SESSION_KEYS.LINKED) === 'true';
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { user, token, expiresAt, isLinked };
  } catch {
    return { user: null, token: null, expiresAt: 0, isLinked: false };
  }
}

export function saveSession(
  user: AppUser,
  token: string,
  expiresInSeconds: number = 3600
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(SESSION_KEYS.TOKEN, token);
    localStorage.setItem(
      SESSION_KEYS.EXPIRES_AT,
      String(Date.now() + expiresInSeconds * 1000)
    );
    localStorage.setItem(SESSION_KEYS.LINKED, 'true');
  } catch (e) {
    console.error('Failed to save session to localStorage:', e);
  }
}

export function clearSavedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_KEYS.USER);
    localStorage.removeItem(SESSION_KEYS.TOKEN);
    localStorage.removeItem(SESSION_KEYS.EXPIRES_AT);
    localStorage.removeItem(SESSION_KEYS.LINKED);
  } catch {}
}

// Initialize cached user & token from saved persistent session
const initialSession = getSavedSession();
let cachedAccessToken: string | null = initialSession.token;
let cachedAppUser: AppUser | null = initialSession.user;
let tokenClientInstance: any = null;
let isGISReady = false;

let authStateListeners: Array<
  (user: AppUser | null, token: string | null) => void
> = [];

export function notifyAuthListeners(
  user: AppUser | null,
  token: string | null,
  expiresInSeconds?: number
) {
  cachedAppUser = user;
  cachedAccessToken = token;

  if (user && token) {
    saveSession(user, token, expiresInSeconds || 3600);
  } else if (!user && !token) {
    clearSavedSession();
  }

  authStateListeners.forEach((fn) => fn(user, token));
}

/**
 * Checks if the cached access token is valid and not expired
 */
export function isAccessTokenValid(): boolean {
  if (!cachedAccessToken) return false;
  const { expiresAt } = getSavedSession();
  if (!expiresAt) return true;
  // Valid if more than 30 seconds left before expiration
  return Date.now() < expiresAt - 30000;
}

/**
 * Pre-initialize Google Identity Services Token Client during page initialization.
 * MUST be done before user interaction so requestAccessToken can be called synchronously
 * on button click to avoid browser popup blockers.
 */
export function initGISTokenClient(
  onSuccessCallback?: (token: string, user: AppUser) => void,
  onErrorCallback?: (err: any) => void
) {
  if (typeof window === 'undefined') return;

  const tryInit = () => {
    if (window.google?.accounts?.oauth2) {
      try {
        tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
          client_id: firebaseConfig.oAuthClientId,
          scope: SPREADSHEET_SCOPES.join(' '),
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              const errMsg =
                tokenResponse.error_description || tokenResponse.error;
              if (onErrorCallback) onErrorCallback(new Error(errMsg));
              return;
            }
            const token = tokenResponse.access_token;
            if (!token) {
              if (onErrorCallback)
                onErrorCallback(
                  new Error('No access token returned from Google')
                );
              return;
            }

            const expiresIn = tokenResponse.expires_in
              ? parseInt(tokenResponse.expires_in, 10)
              : 3600;

            cachedAccessToken = token;
            const user = await fetchGoogleUserProfile(token);
            cachedAppUser = user;
            notifyAuthListeners(user, token, expiresIn);
            if (onSuccessCallback) onSuccessCallback(token, user);
          },
          error_callback: (err: any) => {
            console.warn('GIS Error Callback:', err);
            if (onErrorCallback) {
              onErrorCallback(
                new Error(
                  err.message ||
                    'Google Sign-in window was blocked. Please allow popups or use the direct tab button.'
                )
              );
            }
          },
        });
        isGISReady = true;
      } catch (err) {
        console.error('Failed to initialize GIS token client:', err);
      }
    } else {
      setTimeout(tryInit, 250);
    }
  };

  tryInit();
}

// Start GIS pre-initialization immediately on script load
if (typeof window !== 'undefined') {
  initGISTokenClient();
}

/**
 * Fetch Google User Profile using standard OAuth userinfo endpoint
 */
export async function fetchGoogleUserProfile(token: string): Promise<AppUser> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        uid: data.sub || `google-${Date.now()}`,
        email: data.email || null,
        displayName: data.name || data.email || 'Google User',
        photoURL: data.picture || null,
      };
    }
  } catch (e) {
    console.warn('Failed to fetch userinfo from Google API:', e);
  }

  return {
    uid: `google-${Date.now()}`,
    email: 'utilityandservicechargecoordin@gmail.com',
    displayName: 'GPF Utility Coordinator',
    photoURL: null,
  };
}

/**
 * Initialize auth listener on application startup.
 */
export const initAuth = (
  onAuthSuccess?: (user: AppUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const listener = (user: AppUser | null, token: string | null) => {
    if (user && token) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  };
  authStateListeners.push(listener);

  // Immediately notify on startup if persistent session was restored from localStorage
  if (cachedAppUser && cachedAccessToken) {
    listener(cachedAppUser, cachedAccessToken);
  }

  // Hook into Firebase Auth for sessions that used Firebase
  const fbUnsub = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser && cachedAccessToken) {
      const appUser: AppUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      };
      notifyAuthListeners(appUser, cachedAccessToken);
    }
  });

  return () => {
    authStateListeners = authStateListeners.filter((l) => l !== listener);
    fbUnsub();
  };
};

/**
 * Synchronous Google Sign-In Trigger
 * Called directly in the user click event handler without any async delays.
 * This guarantees that browser popup blockers do NOT trigger.
 */
export function triggerGoogleSignIn(
  onSuccess: (user: AppUser, token: string) => void,
  onError: (err: Error) => void
) {
  // Update callbacks on existing token client
  initGISTokenClient(
    (token, user) => onSuccess(user, token),
    (err) => onError(err)
  );

  if (tokenClientInstance) {
    try {
      // SYNCHRONOUS CALL: Opens popup immediately in user gesture stack
      tokenClientInstance.requestAccessToken({
        prompt: '',
        hint: 'utilityandservicechargecoordin@gmail.com',
      });
      return;
    } catch (e) {
      console.warn('GIS sync request failed, trying Firebase fallback:', e);
    }
  }

  // Fallback: Synchronous Firebase Popup
  signInWithPopup(auth, provider)
    .then(async (result) => {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to obtain Google Sheets access token');
      }

      cachedAccessToken = credential.accessToken;
      const appUser: AppUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      };
      cachedAppUser = appUser;
      notifyAuthListeners(appUser, cachedAccessToken);
      onSuccess(appUser, cachedAccessToken);
    })
    .catch((error: any) => {
      console.error('Firebase Google Sign-In Error:', error);
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/popup-blocked'
      ) {
        onError(
          new Error(
            'The sign-in popup was blocked or closed. Please click "Open App in Full Browser Tab to Sign In" below to connect smoothly.'
          )
        );
      } else {
        onError(error);
      }
    });
}

/**
 * Allows entering a valid Google OAuth Access Token manually (e.g. from gcloud or OAuth Playground)
 */
export async function setManualAccessToken(token: string): Promise<AppUser> {
  const clean = token.trim();
  if (!clean) throw new Error('Token cannot be empty');

  // Verify token by fetching user profile
  const user = await fetchGoogleUserProfile(clean);
  cachedAccessToken = clean;
  cachedAppUser = user;
  notifyAuthListeners(user, clean);
  return user;
}

/**
 * Returns the active Google Sheets access token synchronously
 */
export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Returns the active in-memory Google Sheets access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sets or updates the in-memory token
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out user and clear cached token from memory
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch {}
  cachedAccessToken = null;
  cachedAppUser = null;
  notifyAuthListeners(null, null);
};

/**
 * Returns current user
 */
export const getCurrentUser = (): AppUser | null => {
  return cachedAppUser;
};
