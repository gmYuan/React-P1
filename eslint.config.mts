import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
// @ts-ignore
import prettier from "eslint-plugin-prettier/recommended";

export default [
  // 基础推荐配置
  js.configs.recommended,
  
  // TypeScript 推荐配置
  ...tseslint.configs.recommended,
  
  // Prettier 配置（自动包含 eslint-config-prettier）
  prettier,
  
  // 自定义配置
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    
    rules: {
      "prettier/prettier": "error",
      "no-case-declarations": "off",
      "no-constant-condition": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];
