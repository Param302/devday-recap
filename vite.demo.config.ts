import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL("./demo", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  envDir: projectRoot,
  resolve: {
    alias: { "/src": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { outDir: "../dist-demo", emptyOutDir: true },
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    fs: { allow: [projectRoot] },
  },
});
