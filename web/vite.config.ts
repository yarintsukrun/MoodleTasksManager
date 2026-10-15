import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /MoodleTasksManager/; routing is hash-based so no 404 fallback is needed.
export default defineConfig({
  base: '/MoodleTasksManager/',
  plugins: [react()],
});
