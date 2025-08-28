import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      less: {
        // 如果需要，你可以在这里添加一些LESS的选项，例如指定JavaScript启用的选项等。
        // 例如，如果你想要在LESS中使用JavaScript表达式，可以设置为 { javascriptEnabled: true }
        javascriptEnabled: true, // 允许在LESS中使用JavaScript表达式（例如 `@{json['color']}`)
      },
    },
  },
})
