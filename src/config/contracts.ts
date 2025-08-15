export const SUBSCRIPTION_MANAGER_ADDRESS = (import.meta.env.VITE_SUBSCRIPTION_MANAGER_ADDRESS || '').toString();
export const CREATOR_REGISTRY_ADDRESS = (import.meta.env.VITE_CREATOR_REGISTRY_ADDRESS || '').toString();
export const DEMO_CREATOR_ADDRESS = (import.meta.env.VITE_DEMO_CREATOR_ADDRESS || '').toString();

if (!SUBSCRIPTION_MANAGER_ADDRESS) {
  // eslint-disable-next-line no-console
  console.warn('[contracts] VITE_SUBSCRIPTION_MANAGER_ADDRESS is not set');
}

if (!CREATOR_REGISTRY_ADDRESS) {
  // eslint-disable-next-line no-console
  console.warn('[contracts] VITE_CREATOR_REGISTRY_ADDRESS is not set');
}
