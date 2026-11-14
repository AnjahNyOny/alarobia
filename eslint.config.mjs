import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".next-e2e/**", "test-results/**", "playwright-report/**", "out/**", "build/**", "next-env.d.ts", ".claude/**"]),
  {
    // Le contenu est rédigé en français : les apostrophes dans le texte JSX sont voulues.
    rules: { "react/no-unescaped-entities": "off" },
  },
]);
