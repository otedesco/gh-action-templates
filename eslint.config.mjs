import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**", "tmp/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
      "no-useless-escape": "off",
    },
  },
];
