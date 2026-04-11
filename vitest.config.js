import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // 测试文件匹配模式
    include: ['packages/**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // 全局测试 API
    globals: true,
    // 测试环境
    environment: 'node',
    // 使用 forks 池以获得更好的 IDE 兼容性
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // 单线程运行
    maxConcurrency: 1,
    // 禁用文件并行
    fileParallelism: false,
    // 禁用隔离以提高 IDE 兼容性
    isolate: false,
    // 增加超时
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    // 配置路径别名
    alias: {
      'shared/utils': path.resolve(__dirname, 'packages/shared/utils.ts'),
      shared: path.resolve(__dirname, 'packages/shared'),
      scheduler: path.resolve(__dirname, 'packages/scheduler/src'),
      react: path.resolve(__dirname, 'packages/react/src'),
      'react-dom': path.resolve(__dirname, 'packages/react-dom/src'),
      'react-reconciler': path.resolve(__dirname, 'packages/react-reconciler/src'),
    },
  },
})
