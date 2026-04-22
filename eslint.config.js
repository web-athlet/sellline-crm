import base from './packages/config-eslint/base.js';
import nest from './packages/config-eslint/nest.js';
import next from './packages/config-eslint/next.js';

const scope = (patterns, configs) =>
  configs.map((c) => {
    const keys = Object.keys(c);
    if (keys.length === 1 && keys[0] === 'ignores') return c;
    return { ...c, files: patterns };
  });

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/generated/**',
    ],
  },
  ...scope(['apps/api/**/*.ts'], nest),
  ...scope(['apps/web/**/*.{ts,tsx,jsx}'], next),
  ...scope(['packages/shared/src/**/*.ts', 'packages/database/src/**/*.ts'], base),
];
