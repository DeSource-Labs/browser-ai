import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import sveltePlugin from 'eslint-plugin-svelte';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/.angular/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/.playwright-cli/**',
      '**/.svelte-kit/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**'
    ]
  },
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  ...sveltePlugin.configs['flat/recommended'],
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue,svelte}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        defineProps: 'readonly',
        withDefaults: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/singleline-html-element-content-newline': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,vue,svelte}'],
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } }
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parser: vueParser, parserOptions: { parser: tsParser, extraFileExtensions: ['.vue'] } }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { parserOptions: { parser: tsParser, extraFileExtensions: ['.svelte'] } },
    // Core control-flow analysis cannot track assignments across Svelte reactive statements.
    rules: { 'no-useless-assignment': 'off' }
  },
  {
    files: ['packages/browser-ai-react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' }
  },
  eslintConfigPrettier
];
