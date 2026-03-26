import { defineConfig } from 'vite'

const allowedHosts = ['tracker.dannymcvey.com', '100.87.16.33', '192.168.4.87', 'localhost']

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3010,
    allowedHosts
  },
  preview: {
    host: '0.0.0.0',
    port: 3010,
    allowedHosts
  }
})
