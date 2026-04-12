export const runtimeConfig = {
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  persistenceMode: process.env.NEXT_PUBLIC_PERSISTENCE_MODE || 'local',
};

export function isLocalPersistenceMode(): boolean {
  return runtimeConfig.persistenceMode === 'local';
}