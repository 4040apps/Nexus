import { defineConfig } from 'tsup';
import { createBuildOriginDefine } from '../../packages/environment/src/index.js';

export default defineConfig({
  define: createBuildOriginDefine(process.env.NEXUS_ENVIRONMENT),
  minify: process.env.NEXUS_ENVIRONMENT === 'PRODUCTION',
  entry: ['src/index.ts', 'src/browser.ts', 'src/server.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  dts: true,
  splitting: false,
  noExternal: ['@nexus/environment', '@nexus/provider-template', '@nexus/webmcp'],
});
