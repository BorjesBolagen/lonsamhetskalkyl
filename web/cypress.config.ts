import { defineConfig } from "cypress";

export default defineConfig({
  allowCypressEnv: false,   // Borde vara false annars kan det bli en säkerhetsläcka
  e2e: {
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});