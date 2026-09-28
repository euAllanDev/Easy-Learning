import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.vitest.ts"] },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
