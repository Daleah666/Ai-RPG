import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { attachChatProxy } from "./server/chat-proxy";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "chat-proxy",
      configureServer(server) {
        attachChatProxy(server.middlewares);
      },
      configurePreviewServer(server) {
        attachChatProxy(server.middlewares);
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
