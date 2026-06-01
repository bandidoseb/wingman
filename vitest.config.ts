import { defineConfig } from "vitest/config";

// Unit tests for Wingman's pure logic (no network, no DB, no Electron).
// Tests import the modules under test via relative paths; the lib files'
// only `@/...` imports are type-only and erased at runtime, so no path
// alias resolution is required here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
