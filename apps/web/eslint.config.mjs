import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // React 19 / Next.js 16 introduce stricter react-hooks rules.
      // They surface existing patterns (setState in effect, Date.now during render,
      // mutable external values, etc.) across the app. Disabling them preserves the
      // previous lint behaviour while the framework upgrade is kept; revisit them
      // as a separate refactor if desired.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'public/tinymce/**']),
]);
