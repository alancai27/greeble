import { defineConfig } from 'vite';

// GitHub Pages serves the site from https://<user>.github.io/greeble/, so the
// Pages workflow sets VITE_BASE=/greeble/. Local dev and other hosts keep '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
});
