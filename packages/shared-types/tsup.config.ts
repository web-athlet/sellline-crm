import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/env/web.ts', 'src/env/api.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  splitting: false,
});
