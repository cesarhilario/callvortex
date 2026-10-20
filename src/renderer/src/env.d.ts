/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** URL (na allowlist do Supabase) para onde o e-mail de redefinição aponta. Opcional. */
  readonly VITE_PASSWORD_RESET_REDIRECT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
