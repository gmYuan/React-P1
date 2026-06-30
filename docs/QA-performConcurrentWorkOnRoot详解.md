# Q1: performConcurrentWorkOnRoot 的宏观语义是什么？为什么它可以 return null，return null 后页面还能正常渲染吗？

<details>
<summary><strong>A:</strong>(点击展开/收起)</summary>

#### 完整时间线：通过具体例子理解

假设用户点击了"博客"tab，触发了一个低优先级更新：

```javascript
// 这是 transition 更新，优先级低（TransitionLane）
startTransition(() => {
  setTab('blog');  // 这会触发渲染 280 个慢组件
});
```

##### T0: 调度阶段
```
dispatchSetState
  → scheduleUpdateOnFiber(fiber, TransitionLane)
    → root.pendingLanes = TransitionLane  // 记录"有个低优先级更新待处理"
    → ensureRootIsScheduled(root)
      → scheduleCallback(NormalPriority, performConcurrentWorkOnRoot.bind(null, root))
      → root.callbackNode = Task1  // Scheduler 返回的任务句柄
```

现在 Scheduler 队列里有一个任务：`Task1 = performConcurrentWorkOnRoot(root)`

##### T1: Task1 开始执行（旧任务）
```
Scheduler 执行 Task1
  → performConcurrentWorkOnRoot(root)
    → renderRoot(root, TransitionLane, true)  // 可中断渲染
      → workLoopConcurrent()
        渲染第 1 个组件...
        渲染第 2 个组件...
        ...
        渲染第 50 个组件... ← 这时时间片用完了！
        unstable_shouldYield() === true
        → 返回 RootIncomplete（未完成）
```

此时：
- 只渲染了 50/280 个组件
- `workInProgress` 指向第 51 个待处理的 fiber
- `root.pendingLanes` 还是 TransitionLane（因为没 commit，更新未完成）

##### T2: 用户突然点击了另一个按钮（高优先级更新插入）
```
用户点击 <ul>（同步事件）
  → dispatchSetState
    → scheduleUpdateOnFiber(fiber, SyncLane)  // 同步优先级！
      → root.pendingLanes = SyncLane | TransitionLane  // 新增高优先级
      → ensureRootIsScheduled(root)
        → 发现 SyncLane 比 Task1 的优先级高
        → unstable_cancelCallback(Task1)  // 取消旧任务
        → scheduleSyncCallback(performSyncWorkOnRoot)  // 微任务调度
        → root.callbackNode = null  // SyncLane 不用宏任务
```

现在：
- Task1 被取消了（但可能还在执行中）
- 有个微任务等着执行 `performSyncWorkOnRoot`

##### T3: Task1 继续执行（但发现自己该退场了）
```
performConcurrentWorkOnRoot 继续
  → renderRoot 返回了 RootIncomplete
  → ensureRootIsScheduled(root)  ← 这里重新检查！
    → 发现 SyncLane 最高优先级
    → 又调度了一次（但已经调度过了，所以可能直接 return）
  → if (exitStatus === RootIncomplete)
      → if (root.callbackNode !== curCallbackNode)  ← 检查这里！
        → curCallbackNode 是 Task1
        → root.callbackNode 现在是 null（被改了）
        → return null  ← 旧任务退场 ⚠️
```

**这就是"旧任务 return null"的时刻**

##### T4: 微任务执行（新任务）
```
微任务队列执行
  → performSyncWorkOnRoot(root)
    → renderRoot(root, SyncLane, false)  // 不可中断！
      → 从头开始渲染（因为优先级变了）
      → 渲染完整棵树（包含 SyncLane 的更新）
      → 返回 RootComplete
    → commitRoot(root)
      → 把变更应用到 DOM
      → markRootFinished(root, SyncLane)  // 清除 SyncLane
```

此时：
- DOM 更新了（显示 SyncLane 的结果）
- `root.pendingLanes` 还剩 TransitionLane

##### T5: 处理剩余的低优先级更新
```
commitRoot 最后
  → ensureRootIsScheduled(root)
    → 发现还有 TransitionLane 待处理
    → scheduleCallback(..., performConcurrentWorkOnRoot)
    → root.callbackNode = Task2  // 新的任务

Scheduler 后续执行 Task2
  → performConcurrentWorkOnRoot(root)
    → renderRoot(root, TransitionLane, true)
      → 从头开始渲染（因为之前的 WIP 树已经被 SyncLane 覆盖了）
      → 渲染完 280 个组件
      → commitRoot
```

最终页面显示完整结果。

---

#### 5️⃣ 核心理解要点

##### 要点 1：什么是"渲染任务"？

**渲染任务** = 遍历 Fiber 树、调用组件、构建新的 Fiber 树的过程

**中断与恢复**：
- `workInProgress` 保存当前进度（第几个 fiber）
- `wipRootRenderLane` 保存当前处理的优先级
- 下次继续时，从 `workInProgress` 继续往下走

**但**：如果被更高优先级抢占，会**放弃进度，从头开始**（因为高优先级可能影响整棵树）

##### 要点 2：新任务和旧任务是什么关系？

**不是"新任务完成旧任务"，而是"各干各的"**：

- 旧任务（Task1）：处理 TransitionLane 的更新
- 新任务（微任务）：处理 SyncLane 的更新
- 它们处理的是**不同的更新**

但因为 Fiber 树共享，高优先级任务会：
1. 从头渲染整棵树（包含高优先级更新）
2. 跳过低优先级更新（通过 lane 判断）
3. commit 后，低优先级更新还在 `pendingLanes` 里
4. 再次调度，继续处理低优先级

##### 要点 3：return null 不是停止渲染

看上面的时间线：
- T3: Task1 return null（旧任务退场）
- T4: 微任务执行高优先级渲染
- T5: 再次调度处理低优先级

**渲染没停，只是任务实例换了**。`pendingLanes` 保证"还有哪些更新没处理"不会丢。

##### 要点 4：为什么不继续旧任务的进度？

**答案：不继续！重新来！**

- 高优先级任务会**从头渲染**
- 低优先级的半成品（WIP 树）被丢弃
- commit 后再次调度时，低优先级更新会**再次从头渲染**

这就是为什么 `pendingLanes` 这么重要：它是"还欠哪些债"的记录本。

---

#### 6️⃣ 三者的关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    调度决策层                                │
│               ensureRootIsScheduled                          │
│  - 根据 pendingLanes 决定要不要调度                         │
│  - 决定用什么优先级（SyncLane → 微任务，其他 → 宏任务）     │
│  - 管理 root.callbackNode（任务句柄）                        │
└────────────────────┬────────────────────────────────────────┘
                     │ 调用 scheduleCallback
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   任务执行平台                               │
│                    Scheduler                                 │
│  - 维护任务队列（按优先级排序）                              │
│  - 提供时间片（5ms）                                         │
│  - 执行任务 callback                                         │
│  - 接收返回值（null = 结束，函数 = 继续）                    │
└────────────────────┬────────────────────────────────────────┘
                     │ 执行 callback
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  实际 Worker                                 │
│          performConcurrentWorkOnRoot                         │
│  - 执行 flushPassiveEffects                                  │
│  - 调用 renderRoot 渲染                                      │
│  - 调用 ensureRootIsScheduled 更新调度状态                   │
│  - 返回 null（结束）或 continuation（继续）                  │
└─────────────────────────────────────────────────────────────┘
```

**三者配合**：
- `ensureRootIsScheduled` = 调度决策层（"派单员"）
- `Scheduler` = 任务执行平台（"队列+时间片"）
- `performConcurrentWorkOnRoot` = 实际 worker（"施工队"）

---

#### 7️⃣ 一句话总结

**`performConcurrentWorkOnRoot` return null 不是"停止渲染"，而是"当前任务实例结束"。真正的渲染工作由 `pendingLanes`（记录还有哪些更新）+ `ensureRootIsScheduled`（重新调度）+ Scheduler（驱动执行）的协作保证不会丢失。高优先级抢占低优先级时，低优先级任务让位（return null），高优先级任务从头渲染，commit 后再次调度处理低优先级。**

</details>

---

# Q: 高优先级抢占后，低优先级重新渲染不是浪费吗？没有 bailout 机制会有什么问题？

<details>
<summary><strong>A:</strong>(点击展开/收起)</summary>

#### 完整时间线

##### 场景设定
```typescript
function App() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      {Array(100).fill(0).map((_, i) => (
        <Child key={i} count={count} />
      ))}
    </div>
  );
}
```

初始：`count = 0`，页面显示 100 个 `<Child count={0} />`

##### T0: 低优先级更新触发（T1）
```typescript
startTransition(() => {
  setCount(10);  // TransitionLane
});
```

- `root.pendingLanes = TransitionLane`
- 调度 T1：`performConcurrentWorkOnRoot(root)`

##### T1: T1 开始渲染（可中断）
```
T1 执行：
  → renderRoot(root, TransitionLane, true)  // 可时间切片
    → workLoopConcurrent()
      渲染 Child#0: props={count: 10}  // 新 fiber
      渲染 Child#1: props={count: 10}
      ...
      渲染 Child#49: props={count: 10}
      ← 时间片用完！unstable_shouldYield() === true
  → 返回 RootIncomplete
```

此时状态：
```
current 树（旧树，DOM 对应这棵树）:
  Child#0: memoizedProps={count: 0}
  ...
  Child#99: memoizedProps={count: 0}

workInProgress 树（WIP，正在构建）:
  Child#0: pendingProps={count: 10}  ✅ 已构建
  ...
  Child#49: pendingProps={count: 10} ✅ 已构建
  Child#50: null  ← workInProgress 指针停在这里
  ...
  Child#99: null  ← 还没构建
```

##### T2: 高优先级更新插入（T2）
```typescript
// 用户点击按钮（同步事件）
setCount(5);  // SyncLane
```

- `root.pendingLanes = SyncLane | TransitionLane`
- 取消 T1，调度 T2（微任务）

##### T3: T2 开始渲染（不可中断）
```
T2 执行：
  → renderRoot(root, SyncLane, false)  // 不可中断
    → prepareFreshStack(root, SyncLane)  // 重置 WIP 树！
      → workInProgress = createWorkInProgress(root.current, {})
         ↑ 从 current 树重新复制一份
    
    → workLoopSync()
      渲染 Child#0: props={count: 5}  // 基于 current 树的 Child#0
      渲染 Child#1: props={count: 5}
      ...
      渲染 Child#99: props={count: 5} // 渲染完所有 100 个！
  
  → 返回 RootComplete
  → commitRoot(root)
    → 把 WIP 树变成新的 current 树
    → DOM 更新，显示 count=5
```

此时状态：
```
current 树（新的）:
  Child#0: memoizedProps={count: 5}  ← T2 的结果
  ...
  Child#99: memoizedProps={count: 5}

旧的 WIP 树（T1 的半成品）:
  ← 已被丢弃，GC 回收
```

**关键**：T1 的半成品被丢弃了，但 T2 的结果保留在 current 树里！

##### T4: T2 commit 后，重新调度 T1
```
commitRoot 最后：
  → ensureRootIsScheduled(root)
    → 发现 pendingLanes 还有 TransitionLane
    → 调度新的任务处理 TransitionLane
```

##### T5: 重新渲染 TransitionLane（基于 T2 的结果）
```
新任务执行：
  → renderRoot(root, TransitionLane, true)
    → prepareFreshStack(root, TransitionLane)
      → workInProgress = createWorkInProgress(root.current, {})
         ↑ 从 T2 的 current 树复制！
    
    → workLoopConcurrent()
      处理 Child#0:
        current.memoizedProps = {count: 5}  ← T2 的结果
        pendingProps = {count: 10}  ← TransitionLane 的目标
        
        ⚠️ 关键：bailout 优化！
        如果 props 没变，直接复用！
        但这里 5 ≠ 10，需要重新渲染
      
      处理 Child#1: 同上
      ...
      处理 Child#99: 同上
  
  → commitRoot
    → DOM 更新，显示 count=10
```

---

#### 不是浪费，因为三个关键机制

##### 机制 1：高优先级渲染时会"跳过"低优先级更新

```typescript
// processUpdateQueue 里会根据 renderLane 过滤
function processUpdateQueue(baseState, pending, renderLane) {
  let newState = baseState;
  
  for (let update of updates) {
    // 如果当前 update 的优先级不在 renderLane 里，跳过！
    if (!isSubsetOfLanes(renderLane, update.lane)) {
      continue; // 跳过低优先级更新
    }
    
    newState = getStateFromUpdate(update, newState);
  }
}
```

所以：
- **高优先级渲染（SyncLane）**：只处理 SyncLane 的更新，TransitionLane 被跳过
- **低优先级渲染（TransitionLane）**：处理 TransitionLane 的更新

##### 机制 2：低优先级基于高优先级的结果继续计算

```typescript
// 初始：count = 0
// T2 (SyncLane): 0 → 5
// T5 (TransitionLane): 从 5 开始，而不是从 0！

processUpdateQueue(
  baseState: 5,  // ← 从 T2 的结果开始
  updates: [TransitionLane 的 setState(10)],
  renderLane: TransitionLane
)
// 结果：5 → 10
```

##### 机制 3：bailout 机制跳过未变化的子树

真实 React 的 beginWork：

```typescript
function beginWork(current, workInProgress, renderLane) {
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    
    // props 没变 && 没有待处理的更新
    if (oldProps === newProps && !includesSomeLane(wip.lanes, renderLane)) {
      // bailout: 直接复用，跳过这个子树！
      return bailoutOnAlreadyFinishedWork(current, workInProgress);
    }
  }
  
  // 否则重新渲染...
}
```

---

#### 2️⃣ 你的实现缺少 bailout

检查你的 `beginWork.ts`，发现没有 bailout 逻辑：

```typescript
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  // ❌ 缺少 bailout 检查，直接进入 switch
  switch (wip.tag) {
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);
    // ...
  }
};
```

**结果**：每次都会重新渲染所有节点，即使 props 没变。

---

#### 3️⃣ 没有 bailout 的性能影响

##### 情况 1：所有组件 props 都变了
```typescript
// 所有子组件都依赖 count
{Array(100).fill(0).map((_, i) => <Child key={i} count={count} />)}
```
**影响：无**（都要重新渲染）

##### 情况 2：部分组件 props 没变
```typescript
function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <Header title="My App" />  {/* props 永远不变 */}
      {Array(100).fill(0).map((_, i) => <Child key={i} count={count} />)}
      <Footer year={2026} />     {/* props 永远不变 */}
    </div>
  );
}
```
- **有 bailout**：Header 和 Footer 跳过，只渲染 100 个 Child
- **没有 bailout**：Header、100 个 Child、Footer 全部重新渲染（浪费 2%）

##### 情况 3：深层嵌套，只有叶子节点变化
```typescript
<Layout>          {/* props 没变 */}
  <Sidebar>       {/* props 没变 */}
    <Menu>        {/* props 没变 */}
      ...100 层嵌套
      <Content count={count} />  {/* 只有这里变了 */}
    </Menu>
  </Sidebar>
</Layout>
```
- **有 bailout**：Layout/Sidebar/Menu 整个子树跳过
- **没有 bailout**：所有 100+ 层全部重新渲染（**浪费 90%+**）

---

#### 4️⃣ 对你的 demo 的影响

你的 transition demo：

```typescript
{new Array(280).fill(0).map((_, index) => (
  <SlowPost key={index} index={index} />
))}
```

**影响：基本无**

因为：
- 每个 `SlowPost` 的 `index` 都不同
- 高优先级和低优先级渲染时，所有 280 个组件都需要重新执行
- 有没有 bailout 都一样

---

#### 5️⃣ 如何添加 bailout（可选）

在 `beginWork` 开头加：

```typescript
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  const current = wip.alternate;
  
  // 添加 bailout 检查
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = wip.pendingProps;
    
    if (oldProps === newProps && !includesSomeLane(wip.lanes, renderLane)) {
      // 复用 current 的 child，跳过渲染
      wip.child = current.child;
      return wip.child;
    }
  }
  
  // 否则正常渲染...
  switch (wip.tag) {
    // ...
  }
};
```

---

#### 6️⃣ 一句话总结

**高优先级任务会跳过低优先级更新，低优先级重新渲染时基于高优先级的结果继续计算，不是"从头再来"。bailout 机制可以跳过 props 未变化的子树，减少不必要的重新渲染。你的实现缺少 bailout，在深层嵌套场景下会有性能浪费，但对于所有节点都需要更新的场景（如你的 demo）影响不大。**

</details>

---
