/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module '*.svg' {
  const content: string;
  export default content;
}
