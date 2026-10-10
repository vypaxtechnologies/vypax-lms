import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist/site',
    emptyOutDir: false,
    lib: {
      entry: 'src/learning-pdf.js',
      formats: ['es'],
      fileName: () => 'learning-pdf.js'
    }
  }
});
