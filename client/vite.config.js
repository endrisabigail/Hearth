import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          firebase: ["firebase/app", "firebase/auth"],
          vendor: ["react", "react-dom", "react-router-dom", "motion/react", "axios", "socket.io-client"],
        },
      },
    },
  },
});
