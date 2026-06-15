# React 首次渲染函数调用栈

基于 React-P1 项目的实际实现，首次渲染采用**并发模式**（DefaultLane）。

---

## 完整调用栈

```
1. ReactDOM.createRoot(container)
   └─ createRoot(container)                                    // react-dom/src/root.ts:9
      └─ createContainer(container)                            // react-reconciler/src/fiberReconciler.ts:15
         ├─ new FiberNode(HostRoot, {}, null)                  // 创建 hostRootFiber
         ├─ new FiberRootNode(container, hostRootFiber)        // 创建根节点
         └─ createUpdateQueue()                                // 创建更新队列

2. root.render(<App />)
   ├─ initEvent(container, 'click')                            // react-dom/src/root.ts:14
   └─ updateContainer(element, root)                           // react-reconciler/src/fiberReconciler.ts:22
      ├─ requestUpdateLanes()                                  // fiberLanes.ts:28
      │  ├─ unstable_getCurrentPriorityLevel()                 // 获取 Scheduler 优先级 (NormalPriority)
      │  └─ schedulerPriorityToLane()                          // 转换为 DefaultLane
      ├─ createUpdate(element, renderLane)                     // 创建 Update 对象
      ├─ enqueueUpdate(updateQueue, update)                    // 加入更新队列
      └─ scheduleUpdateOnFiber(hostRootFiber, renderLane)      // workLoop.ts:59
         ├─ markUpdateFromFiberToRoot(fiber)                   // 向上找到 FiberRootNode
         ├─ markRootUpdated(root, lane)                        // 记录 lane 到 root.pendingLanes
         └─ ensureRootIsScheduled(root)                        // workLoop.ts:79
            ├─ getHighestPriorityLane(root.pendingLanes)       // 获取最高优先级 (DefaultLane)
            └─ (DefaultLane !== SyncLane)
               ├─ laneToSchedulerPriority(maxPendingLane)      // DefaultLane → NormalPriority
               └─ scheduleCallback(NormalPriority, performConcurrentWorkOnRoot.bind(null, root))

3. performConcurrentWorkOnRoot(root)                           // workLoop.ts:165 (宏任务中执行)
   ├─ flushPassiveEffects(root.pendingPassiveEffects)         // 先处理待执行的 effect
   ├─ getHighestPriorityLane(root.pendingLanes)               // 获取优先级 (DefaultLane)
   └─ renderRoot(root, updateLane, true)                       // workLoop.ts:269 (shouldTimeSlice=true)
      ├─ prepareFreshStack(root, lane)                         // workLoop.ts:51
      │  └─ createWorkInProgress(root.current, {})             // 创建 workInProgress 树
      └─ workLoopConcurrent()                                  // workLoop.ts:377
         └─ while (workInProgress !== null && !unstable_shouldYield())
            └─ performUnitOfWork(workInProgress)               // workLoop.ts:390

4. performUnitOfWork(fiber)
   ├─ beginWork(fiber, wipRootRenderLane)                      // beginWork.ts:16 (递阶段)
   │  └─ 返回 child 或 null
   └─ (根据返回值)
      ├─ next !== null → workInProgress = next                 // 继续向下
      └─ next === null → completeUnitOfWork(fiber)             // workLoop.ts:401 (归阶段)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【BeginWork 阶段】按节点类型分派
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. beginWork(wip: HostRoot)
   └─ updateHostRoot(wip, renderLane)                          // beginWork.ts:41
      ├─ processUpdateQueue(baseState, pending, renderLane)    // updateQueue.ts
      │  └─ 计算 memoizedState = <App />
      └─ reconcileChildren(wip, nextChildren)                  // beginWork.ts:77
         └─ mountChildFibers(wip, null, children)              // childFibers.ts (首次渲染)
            └─ reconcileSingleElement(...)
               └─ 创建 App 的 FunctionComponent Fiber
                  └─ return wip.child

6. beginWork(wip: FunctionComponent)
   └─ updateFunctionComponent(wip, renderLane)                 // beginWork.ts:65
      ├─ renderWithHooks(wip, renderLane)                      // fiberHooks.ts
      │  ├─ currentlyRenderingFiber = wip
      │  ├─ currentDispatcher = HooksDispatcherOnMount         // mount 模式
      │  ├─ const children = Component(props)                  // 执行组件函数
      │  │  └─ App()
      │  │     ├─ useState(100)
      │  │     │  └─ mountState(100)                           // fiberHooks.ts
      │  │     │     ├─ mountWorkInProgressHook()              // 创建 Hook 对象
      │  │     │     ├─ hook.memoizedState = 100
      │  │     │     ├─ createUpdateQueue()
      │  │     │     └─ return [100, dispatchSetState]
      │  │     └─ return <ul>...</ul>
      │  └─ return children
      └─ reconcileChildren(wip, children)
         └─ mountChildFibers(wip, null, ul元素)
            └─ 创建 ul 的 HostComponent Fiber
               └─ return wip.child

7. beginWork(wip: HostComponent)  // ul
   └─ updateHostComponent(wip)                                 // beginWork.ts:58
      └─ reconcileChildren(wip, nextChildren)
         └─ mountChildFibers(wip, null, children)
            └─ reconcileChildrenArray(...)                     // 数组子节点
               └─ 遍历创建 100 个 Child 组件 Fiber (通过 sibling 链接)
                  └─ return wip.child

8. beginWork(wip: FunctionComponent)  // Child
   └─ updateFunctionComponent(wip, renderLane)
      ├─ renderWithHooks(wip, renderLane)
      │  └─ Child(props)
      │     └─ return <li>{children}</li>
      └─ reconcileChildren(wip, <li>)
         └─ 创建 li 的 HostComponent Fiber
            └─ return wip.child

9. beginWork(wip: HostComponent)  // li
   └─ updateHostComponent(wip)
      └─ reconcileChildren(wip, nextChildren)
         └─ 创建文本节点 HostText Fiber
            └─ return wip.child

10. beginWork(wip: HostText)
    └─ return null  // 文本节点无子节点，开始归阶段

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【CompleteWork 阶段】从叶子节点向上归并
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. completeUnitOfWork(fiber)                                  // workLoop.ts:401
    └─ do {
         ├─ completeWork(node)                                 // completeWork.ts:64
         ├─ const sibling = node.sibling
         └─ if (sibling !== null)
            ├─ workInProgress = sibling                        // 处理兄弟节点
            └─ return
         └─ else
            ├─ node = node.return                              // 向上返回父节点
            └─ workInProgress = node
       } while (node !== null)

12. completeWork(wip: HostText)
    └─ (首次渲染 current === null)                             // completeWork.ts:96
       ├─ createTextInstance(newProps.content)                 // 创建文本 DOM 节点
       ├─ wip.stateNode = instance
       └─ bubbleProperties(wip)                                // completeWork.ts:50
          └─ 收集子节点的 flags 到 subtreeFlags

13. completeWork(wip: HostComponent)  // li
    └─ (首次渲染 current === null)                             // completeWork.ts:79
       ├─ createInstance(wip.type, newProps)                   // 创建 DOM 元素
       ├─ appendAllChildren(instance, wip)                     // completeWork.ts:23
       │  └─ 将所有子 DOM 节点插入到当前 DOM
       │     └─ appendInitialChild(parent, child.stateNode)
       ├─ wip.stateNode = instance
       └─ bubbleProperties(wip)

14. completeWork(wip: FunctionComponent)  // Child
    └─ bubbleProperties(wip)                                   // completeWork.ts:107

15. completeWork(wip: HostComponent)  // ul
    └─ (首次渲染)
       ├─ createInstance('ul', newProps)
       ├─ appendAllChildren(instance, wip)                     // 组装所有 li 子节点
       ├─ wip.stateNode = instance
       └─ bubbleProperties(wip)

16. completeWork(wip: FunctionComponent)  // App
    └─ bubbleProperties(wip)

17. completeWork(wip: HostRoot)
    └─ bubbleProperties(wip)                                   // completeWork.ts:104

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Render 阶段结束，返回 Commit 阶段】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

18. renderRoot 返回                                            // workLoop.ts:306
    └─ return RootComplete

19. performConcurrentWorkOnRoot 继续                           // workLoop.ts:216
    ├─ ensureRootIsScheduled(root)                             // 重新调度（清理状态）
    ├─ (exitStatus === RootComplete)
    ├─ root.finishedWork = root.current.alternate
    ├─ root.finishedLane = updateLane
    ├─ wipRootRenderLane = NoLane
    └─ commitRoot(root)                                        // workLoop.ts:309

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Commit 阶段】DOM 挂载
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20. commitRoot(root)                                           // workLoop.ts:309
    ├─ (检查是否有 PassiveEffect)
    │  └─ scheduleCallback(NormalPriority, flushPassiveEffects)
    ├─ commitMutationEffects(finishedWork, root)               // commitWork.ts:32
    │  └─ 深度优先遍历 Fiber 树
    │     └─ commitMutationEffectsOnFiber(fiber, root)         // commitWork.ts:64
    │        └─ (flags & Placement)
    │           └─ commitPlacement(finishedWork)               // commitWork.ts:195
    │              ├─ getHostParent(finishedWork)              // commitWork.ts:252
    │              ├─ getHostSibling(finishedWork)             // commitWork.ts:213
    │              └─ insertOrAppendPlacementNodeIntoContainer(...)  // commitWork.ts:275
    │                 └─ appendChildToContainer(hostParent, fiber.stateNode)
    │                    └─ parent.appendChild(child)          // 真实 DOM 操作
    └─ root.current = finishedWork                             // workLoop.ts:360 (切换 current 树)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【副作用阶段】异步执行 useEffect
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

21. flushPassiveEffects(pendingPassiveEffects)                 // workLoop.ts:417 (宏任务中)
    ├─ pendingPassiveEffects.unmount.forEach(...)              // 触发 unmount destroy
    ├─ pendingPassiveEffects.update.forEach(...)               // 触发 update destroy
    ├─ pendingPassiveEffects.update.forEach(...)               // 触发 update create
    │  └─ commitHookEffectListCreate(Passive | HookHasEffect, effect)  // commitWork.ts:369
    │     └─ effect.destroy = effect.create()                  // 执行 useEffect 回调
    └─ flushSyncCallback()                                     // 处理 effect 中触发的更新
```

---

## 关键点总结

1. **并发渲染模式**：首次渲染使用 `DefaultLane`（并发优先级），通过 `scheduleCallback` 调度为宏任务
2. **可中断渲染**：`workLoopConcurrent` 检查 `unstable_shouldYield()`，支持时间切片
3. **深度优先遍历**：beginWork 向下递，completeWork 向上归
4. **双缓冲机制**：构建 workInProgress 树，完成后切换 `root.current` 指针
5. **DOM 预组装**：在 `appendAllChildren` 中组装子树，最后统一插入容器
6. **异步副作用**：useEffect 在独立的宏任务中执行，不阻塞渲染
