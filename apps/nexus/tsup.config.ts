import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/check-readiness.ts',
    'src/dashboard-preview.ts',
    'src/hero-demo.ts',
    'src/officepro-runtime-client.ts',
  ],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  dts: true,
  splitting: false,
  noExternal: ['@nexus/goal-state', '@nexus/intent-handoff', '@nexus/webmcp'],
});
