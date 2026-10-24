import tseslint from 'typescript-eslint';
import sharedRules from './packages/eslint-config/index.mjs';
export default tseslint.config(
  ...tseslint.configs.recommended,
  sharedRules,
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] }
);