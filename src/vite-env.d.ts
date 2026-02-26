/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_BUCKET: string;
  // NOTE: VITE_SUPABASE_ANON_KEY removed — uploads go through /api/upload-image (SERVICE_ROLE)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
