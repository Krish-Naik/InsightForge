export const runtimeConfig = {
  persistenceMode: process.env.NEXT_PUBLIC_PERSISTENCE_MODE || 'cloud',
};

export function isLocalPersistenceMode(): boolean {
  return runtimeConfig.persistenceMode === 'local';
}