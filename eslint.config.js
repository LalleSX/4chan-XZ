import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'builds/**', 'dist/**', 'node_modules/**', 'benchmarks/**', '.cache/**', 'coverage/**',
    // Historical concatenation fragments, not standalone modules.
    'src/meta/fbegin.js', 'src/meta/fend.js', 'src/meta/newline.js',
  ]),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  },
  {
    files: ['src/**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.greasemonkey,
        chrome: 'readonly',
        cloneInto: 'readonly',
        XPCNativeWrapper: 'readonly',
      },
    },
  },
  {
    files: ['tools/**/*.js', '*.config.js', 'src/meta/metadata.js', 'src/meta/manifestJson.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      // TypeScript handles undeclared names; ESLint cannot resolve type declarations.
      'no-undef': 'off',
    },
  },
);
