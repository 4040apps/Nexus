import { defineConfig } from 'tsup';
import { createBuildOriginDefine } from '../../packages/environment/src/index.js';

export default defineConfig({
  define: createBuildOriginDefine(process.env.NEXUS_ENVIRONMENT),
  minify: process.env.NEXUS_ENVIRONMENT === 'PRODUCTION',
  entry: [
    'src/index.ts',
    'src/check-readiness.ts',
    'src/build-production.ts',
    'src/dashboard-preview.ts',
    'src/deploy-production.ts',
    'src/hero-demo.ts',
    'src/officepro-runtime-client.ts',
    'src/production-preflight.ts',
    'src/verify-production.ts',
  ],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  dts: true,
  splitting: false,
  noExternal: ['@nexus/environment', '@nexus/goal-state', '@nexus/intent-handoff', '@nexus/webmcp'],
});
