import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'

// Tailwind v3 emits many rules without per-declaration `source.input.file`. Vite's CSS URL rewriter
// warns once when it sees any such node, even though relative url() resolution still uses the entry CSS file.
// See: vite UrlRewritePostcssPlugin (declaration.source?.input.file).
const logger = createLogger()
const postcssFromWarn =
  'PostCSS plugin did not pass the `from` option to `postcss.parse`'
const origWarnOnce = logger.warnOnce.bind(logger)
logger.warnOnce = (msg, options) => {
  if (msg.includes(postcssFromWarn)) return
  origWarnOnce(msg, options)
}

// https://vite.dev/config/
export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/test/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
})
