/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Comma-separated Google emails allowed to open the Development/Sandbox profile in production. */
  readonly VITE_DEV_ACCESS_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
