import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true, // ต้องตรงกับ Redirect URL ใน Supabase (http://localhost:5173/**)
  },
});
