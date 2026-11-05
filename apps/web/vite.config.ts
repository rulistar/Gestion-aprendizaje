import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Resuelve @aprendizaje/shared a su código fuente TS (Vite lo compila directamente)
    conditions: ['@aprendizaje/source', ...defaultClientConditions],
    // "@/components/ui/button" → src/components/ui/button (convención de shadcn/ui)
    alias: { '@': '/src' },
  },
  server: {
    port: 5174,
    // En desarrollo, /api/* se reenvía a la API: mismo origen, sin problemas de CORS ni cookies
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
