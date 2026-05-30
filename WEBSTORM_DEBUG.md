# 调试断点行错位问题（已定位 + 已修复）

## 现象

在 WebStorm 里调试，从 `syncTaskQueue.ts` 的 `syncQueue.forEach((callback) => callback())`
步进进入 `performSyncWorkOnRoot` 时，高亮行错位（停在 `markUpdateFromFiberToRoot`
的 `return null` 附近），调用栈其实是对的。注释掉 `scheduleCallback`（改用 `setTimeout`）
就正常。

## 真正原因（已用 source map 实测确认）

不是 `scheduler` 版本不兼容，也不是 WebStorm 步进设置问题。

`scheduler@0.23.0` 是 **CommonJS** 包。`workLoop.ts` 里用的是 **多行具名导入**：

```ts
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority
} from 'scheduler';
```

Vite 3 dev 把 CJS 具名导入改写成 `__vite__cjsImport..._scheduler` 这种 interop 形式时，
**没有为这次改写生成正确的 source map**。结果从这一行往下，整个文件的 source map
行号整体偏移了约 5 行（实测：`performSyncWorkOnRoot` 被映射到源码第 88 行而不是第 93 行）。

`setTimeout` 之所以正常，是因为去掉 `scheduleCallback` 后 `scheduler` 这个 CJS 导入
也没有了，CJS interop 改写消失，source map 自然恢复对齐。

## 修复

把 `scheduler` 的具名导入写成 **一行**（源码已改）：

```ts
import { unstable_scheduleCallback as scheduleCallback, unstable_NormalPriority as NormalPriority } from 'scheduler';
```

一行源码 → 一行生成代码，CJS interop 改写不再造成行号偏移，source map 完全对齐。
业务代码继续用 `scheduleCallback`，无需改成 `setTimeout`。

实测修复后：`performSyncWorkOnRoot` 正确映射到其所在源码行，步进高亮不再错位。

> 注意：以后从其它 **CJS 包** 引入时，也尽量用单行具名导入，避免同样的 source map 偏移。
> 根治方案是升级 Vite（新版修复了 CJS interop 的 source map），但单行导入是最小改动。

## 运行配置

项目内含两个 WebStorm 运行配置：

- `React-P1: demo`：启动 `pnpm demo`（dev server，默认 http://localhost:5173）。
- `React-P1: WebStorm Debug`：以 JavaScript 调试方式打开 http://localhost:5173。

先跑 `React-P1: demo`，再跑 `React-P1: WebStorm Debug`。
