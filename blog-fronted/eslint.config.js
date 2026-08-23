import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactCompiler from 'eslint-plugin-react-compiler';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Next.js 官方规则（Babel parser + 67 条规则；parser 会被后面的 TS 块覆盖）
  ...nextVitals,

  // 全局忽略
  { ignores: ['.next', 'dist', 'node_modules'] },

  // Next.js App Router 文件（layout/page 可导出 metadata 等非组件符号，无需 fast refresh）
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // 基础 JS/TS 规则
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js', 'prettier.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-compiler': reactCompiler,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // React Compiler：编译期自动记忆化，hook 规则由编译器校验（memo 等手动优化不再需要）
      'react-compiler/react-compiler': 'error',
      // hooks v7 新增规则：既有代码在 effect 中同步 setState 是既定模式，保持行为不变
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // iconfont 字体走 public/ 静态资源 link（Next CSS import 无法引用 public 文件）
      '@next/next/no-css-tags': 'off',
      // SafeImg 是自定义图片组件（加载失败占位等），保持 <img> 而非 next/image
      '@next/next/no-img-element': 'off',
      'react/no-unknown-property': ['error', { ignore: ['className'] }],

      // Import 排序
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // TypeScript 调整（在 strictTypeChecked 之上放宽部分规则）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // React 19 + TS 中 prop-types 不再需要
      'react/prop-types': 'off',
      // 允许不显式声明返回类型（TS 推导足够好）
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // Next.js App Router 文件（layout/page 可导出 metadata 等非组件符号，无需 fast refresh）
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Prettier 覆盖（必须放在最后）
  prettier,
);
