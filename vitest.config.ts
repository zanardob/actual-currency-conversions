import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
})