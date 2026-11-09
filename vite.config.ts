import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base '/my-app/' so the built site works at https://bigdollarfc.github.io/my-app/
export default defineConfig({ plugins: [react()], base: '/my-app/' })