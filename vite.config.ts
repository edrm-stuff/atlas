import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        tutorial: fileURLToPath(new URL("./tutorial.html", import.meta.url)),
      },
    },
  },
});
