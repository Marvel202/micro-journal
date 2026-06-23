import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Build/output/dependency folders
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",

    // Local planning/prototype material — keep checks scoped to this app.
    "phase-3-verify/**",
    "plans/**",

    // Dev-only verification harness. It is useful locally, but it should not
    // block production app lint integrity.
    "src/verify/**",
    "src/app/_verify/**",
  ]),
]);

export default eslintConfig;
