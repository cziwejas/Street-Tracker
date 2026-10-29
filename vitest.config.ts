import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/db/testSetup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
