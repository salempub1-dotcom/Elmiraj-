/// <reference types="vite/client" />

interface ImportMetaEnv {
  // No admin credentials here — authentication is handled server-side via /api/auth
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
