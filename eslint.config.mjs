import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    rules: {
      // Too many false positives for valid synchronization patterns (init from server state, etc.)
      "react-hooks/set-state-in-effect": "warn",
      // Downgraded while TypeScript types are progressively improved
      "@typescript-eslint/no-explicit-any": "warn",
      // Downgraded while unused variables are cleaned up incrementally
      "@typescript-eslint/no-unused-vars": "warn",
      // React Compiler: warn while existing manual memoization is incrementally updated
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
