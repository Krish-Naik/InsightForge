import type { AuthSession } from './api';

const WORKSPACE_ID_KEY = 'sp_workspace_id_v1';
const AUTH_SESSION_KEY = 'sp_workspace_auth_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function createWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getWorkspaceId(): string {
  if (!isBrowser()) return 'server-render';

  const existing = window.localStorage.getItem(WORKSPACE_ID_KEY);
  if (existing) return existing;

  const nextId = createWorkspaceId();
  window.localStorage.setItem(WORKSPACE_ID_KEY, nextId);
  return nextId;
}

export function getStoredAuthSession(): AuthSession | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function setStoredAuthSession(session: AuthSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}