/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_REGION: string;
  readonly VITE_GOOGLE_OAUTH_ENABLED: string;
  readonly VITE_RECAPTCHA_SITE_KEY: string;
  readonly VITE_MEDIAHUB_AUTH_DECOMMISSIONED: string;
  readonly VITE_DISABLE_AUTH: string;
  readonly VITE_USE_DEV_AUTH: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
