module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true,
  },
  extends: ["react-app", "react-app/jest"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "react/jsx-no-bind": ["warn", { allowArrowFunctions: true, allowFunctions: true }],
    "react/function-component-definition": ["warn", {
      namedComponents: "function-declaration",
      unnamedComponents: "arrow-function",
    }],
    "react-hooks/exhaustive-deps": "warn",
    "no-new-func": "warn",
    "import/order": ["warn", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc", "caseInsensitive": true }
    }],
    "valid-jsdoc": ["warn", {
      "requireReturn": false,
      "requireParamDescription": false,
      "requireReturnDescription": false
    }],
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx"],
      rules: {
        "testing-library/render-result-naming-convention": "off",
      },
    },
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
};
