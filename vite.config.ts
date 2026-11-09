import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base '/' — the site is hosted at the root on Cloudflare Pages
export default defineConfig({ plugins: [react()], base: '/' })