import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/provider.ts', 'src/consumer.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  noExternal: ['@nexus/provider-template'],
});
