import { authAPI, type AuthSession } from './api';
import { clearStoredAuthSession, getStoredAuthSession, getWorkspaceId, setStoredAuthSession } from './authStorage';
import { runtimeConfig } from './runtime';

export async function ensureWorkspaceSession(name = 'Workspace User'): Promise<AuthSession | null> {
  if (runtimeConfig.persistenceMode === 'local') return null;

  const existing = getStoredAuthSession();
  if (existing?.token) return existing;

  const session = await authAPI.bootstrapWorkspace(getWorkspaceId(), name);
  setStoredAuthSession(session);
  return session;
}

export function resetWorkspaceSession() {
  clearStoredAuthSession();
}