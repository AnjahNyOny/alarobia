import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts") } },
  // Fuseau de la production : les fonctions Netlify tournent en UTC, pas à l'heure de Madagascar ni à celle de la machine.
  test: { include: ["src/**/*.test.ts"], environment: "node", env: { TZ: "UTC" } },
});
