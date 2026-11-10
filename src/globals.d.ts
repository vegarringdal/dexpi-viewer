export {};

declare global {
  const __APP_VERSION__: string;
  interface ImportMetaEnv {
    readonly VITE_STORAGE_PREFIX?: string;
  }
}
