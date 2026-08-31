import { defineConfig } from 'vitest/config';
import { createBuildOriginDefine } from './packages/environment/src/index.js';

export default defineConfig({
  define: createBuildOriginDefine('LOCAL'),
});
