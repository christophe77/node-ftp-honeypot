const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-plugin-prettier/recommended");

module.exports = [
  { ignores: ["node_modules/", "pandora-box/", "black-box/"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: { "no-unused-vars": ["error", { caughtErrors: "none" }] },
  },
  prettier,
];
