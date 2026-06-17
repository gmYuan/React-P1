import {
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
  createWorkInProgress
} from './fiber';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { HostRoot } from './workTags';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects
} from './commitWork';
import {
  getHighestPriorityLane,
  Lane,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane,
  laneToSchedulerPriority
} from './fiberLanes';

import { flushSyncCallback, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';

// 注意：scheduler 是 CJS 包，Vite dev 对“多行具名导入”的 CJS interop 改写会破坏
// source map（导致断点行错位）。保持单行导入可避免该问题。
import { unstable_scheduleCallback as scheduleCallback } from 'scheduler';
import { unstable_NormalPriority as NormalPriority } from 'scheduler';
import { unstable_shouldYield } from 'scheduler';
import { unstable_cancelCallback } from 'scheduler';

import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;

let rootDoesHasPassiveEffects = false;

type RootExitStatus = number;
const RootIncomplete = 1; // 中断
const RootComplete = 2; // 执行完了

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // fiberRootNode
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

// 将更新的优先级(lane)记录到根节点上
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// Schedule 阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
  const maxPendingLane = getHighestPriorityLane(root.pendingLanes);
  // 记作 preCallback
  const existingCallback = root.callbackNode;

  // 没有更新了，重置并 return
  if (maxPendingLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = maxPendingLane;
  const prevPriority = root.callbackPriority;

  // 同优先级的更新，不需要重新调度
  if (curPriority === prevPriority) {
    return;
  }

  // 否则，代表有更高优先级的更新插入，如果之前的调度存在，则取消之前的调度
  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback);
  }
  let newCallbackNode = null;

  if (maxPendingLane === SyncLane) {
    // 同步优先级，用微任务调度
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicroTask(flushSyncCallback);
  } else {
    // 其他优先级，用宏任务调度
    const schedulerPriority = laneToSchedulerPriority(maxPendingLane);
    // @ts-ignore
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout?: boolean
): any {
  // 由于 useEffect 的回调函数可能触发更高优先级的更新
  // 在调度之前需要保证 useEffect 回调已全部执行完
  const curCallback = root.callbackNode;
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    // 若 useEffect 回调执行完之后，有更高优先级的更新插入了
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;

  if (updateLane === NoLane) return null;

  // 这里的 didTimeout: true时表示 任务的过期时间 ≤ 当前时间 ==> 任务等太久了，过期了
  // didTimeout = (currentTask.expirationTime <= currentTime)
  // expirationTime 由 Scheduler priority 对应的 timeout 策略 决定（不同优先级有不同超时窗口）
  // currentTime 是 当前 performXXXWorkOnRoot 真正的执行时间

  // 这里的任务，就是指 root.callbackNode的  SchedulerTask句柄
  const needSync = updateLane === SyncLane || didTimeout;
  // render 阶段
  const exitStatus = renderRoot(root, updateLane, !needSync);

  // render 阶段结束后，进入 commit 阶段
  ensureRootIsScheduled(root);

  if (exitStatus === RootIncomplete) {
    // 执行中断
    if (root.callbackNode !== curCallbackNode) {
      // 代表有更高优先级的任务插进来
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  if (exitStatus === RootComplete) {
    // 执行完了
    // 创建根 Fiber 树的 Root Fiber
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = updateLane;
    wipRootRenderLane = NoLane;

    // 提交阶段的入口函数
    commitRoot(root);
  } else if (__DEV__) {
    console.error('还未实现的并发更新结束状态');
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);

  if (nextLane !== SyncLane) {
    // 其他比 SyncLane 低的优先级或 NoLane，重新调度
    ensureRootIsScheduled(root);
    return;
  }

  // render 阶段
  const exitStatus = renderRoot(root, nextLane, false);

  // render 阶段结束后，进入 commit 阶段
  if (exitStatus === RootComplete) {
    // 创建根 Fiber 树的 Root Fiber
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    // 提交阶段的入口函数
    commitRoot(root);
  } else if (__DEV__) {
    console.error('还未实现的同步更新结束状态');
  }
}

// Render 阶段入口
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  const isResume = wipRootRenderLane === lane;

  // 中断再继续时，不用初始化
  if (!isResume) {
    // 初始化 workInProgress 变量
    prepareFreshStack(root, lane);
  }

  do {
    try {
      // 深度优先遍历
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      console.warn('workLoop发生错误：', e);
      workInProgress = null;
    }
  } while (true);

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootIncomplete;
  }
  // 执行完了
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error('render 阶段结束时， workInProgress 不应该为 null');
  }
  // TODO 执行过程中 报错

  return RootComplete;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }

  const lane = root.finishedLane;
  if (lane === NoLane && __DEV__) {
    console.error('commit阶段finishedLane不应该是 NoLane');
    return;
  }

  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  // 判断 Fiber 树是否存在 effect副作用
  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // 调度副作用
      // 回调函数在 setTimeout 中以 NormalPriority 优先级被调度执行
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }

  // 判断是否存在3个子阶段需要执行的操作
  // root flags  root subtreeFlags
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation Placement
    commitMutationEffects(finishedWork, root);

    root.current = finishedWork;

    // layout
  } else {
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  // console.log('dd3', fiber);

  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    // console.log('nn', node);

    completeWork(node);
    const sibling = node.sibling;

    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}

function flushPassiveEffects(
  pendingPassiveEffects: PendingPassiveEffects
): boolean {
  // console.log('dd', pendingPassiveEffects);
  // console.log('dd2', pendingPassiveEffects);
  let didFlushPassiveEffect = false;

  // 先触发所有 unmount destroy
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  // 再触发所有上次更新的 destroy
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  // 再触发所有这次更新的 create
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });

  // 清空 pendingPassiveEffects.update
  pendingPassiveEffects.update = [];

  // 执行 useEffect 过程中可能触发新的更新
  // 再次调用 flushSyncCallback 处理这些更新的更新流程
  flushSyncCallback();

  return didFlushPassiveEffect;
}
