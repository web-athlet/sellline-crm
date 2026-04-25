import base from './packages/config-eslint/base.js';
import nest from './packages/config-eslint/nest.js';
import next from './packages/config-eslint/next.js';
import react from './packages/config-eslint/react.js';

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
      // Build-tool configs — linting adds no value and they trigger "no
      // matching configuration" noise under flat-config discovery.
      '**/tsup.config.ts',
      '**/vitest.config.ts',
      '**/playwright.config.ts',
      '**/next.config.mjs',
      '**/postcss.config.mjs',
      '**/tailwind.config.ts',
    ],
  },
  ...scope(['apps/api/**/*.ts'], nest),
  ...scope(['apps/web/**/*.{ts,tsx,jsx}'], next),
  ...scope(['packages/shared-types/src/**/*.ts'], base),
  ...scope(['packages/ui-components/src/**/*.{ts,tsx}'], react),
  // shadcn/ui primitives + shadcn-managed hooks track upstream; disabling the
  // rules they can't satisfy keeps them close to the registry. This block sits
  // last so it overrides the earlier `next` rule set for matching files.
  {
    files: [
      'apps/web/components/ui/**/*.{ts,tsx}',
      'apps/web/lib/hooks/use-toast.ts',
      'apps/web/lib/hooks/use-mobile.tsx',
    ],
    rules: {
      'import/order': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'unicorn/filename-case': 'off',
      'react/display-name': 'off',
      'react/no-unknown-property': 'off',
    },
  },
];
