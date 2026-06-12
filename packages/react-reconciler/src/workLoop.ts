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
import { devTrace, formatFiberTag, formatLane, formatLanes } from './devTrace';

let workInProgress: FiberNode | null = null;
let concurrentSliceIndex = 0;

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
  concurrentSliceIndex = 0;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // fiberRootNode
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  if (__DEV__) {
    devTrace('【调度】Fiber 触发更新，进入根调度', {
      本次优先级: formatLane(lane),
      触发节点: formatFiberTag(fiber.tag),
      根上待处理: formatLanes(root.pendingLanes)
    });
  }
  ensureRootIsScheduled(root);
}

// 将更新的优先级(lane)记录到根节点上
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// Schedule 阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
  const maxPendingLane = getHighestPriorityLane(root.pendingLanes);

  const existingCallback = root.callbackNode;

  // 没有更新了，重置并 return
  if (maxPendingLane === NoLane) {
    if (__DEV__) {
      devTrace('【调度】暂无待处理更新，清理调度状态', {
        已取消旧任务: existingCallback !== null ? '是' : '否'
      });
    }
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
    if (__DEV__) {
      devTrace('【调度】同优先级，复用已有调度，不重复安排', {
        优先级: formatLane(curPriority)
      });
    }
    return;
  }

  // 否则，代表有更高优先级的更新插入，如果之前的调度存在，则取消之前的调度
  if (existingCallback !== null) {
    if (__DEV__) {
      devTrace('【调度】更高优先级更新插入，取消旧调度任务', {
        旧优先级: formatLane(prevPriority),
        新优先级: formatLane(curPriority)
      });
    }
    unstable_cancelCallback(existingCallback);
  }
  let newCallbackNode = null;

  if (maxPendingLane === SyncLane) {
    // 同步优先级，用微任务调度
    if (__DEV__) {
      devTrace('【调度】安排同步更新（微任务，不可中断）', {
        优先级: formatLane(maxPendingLane)
      });
    }
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicroTask(flushSyncCallback);
  } else {
    // 其他优先级，用宏任务调度
    const schedulerPriority = laneToSchedulerPriority(maxPendingLane);
    if (__DEV__) {
      devTrace('【调度】安排并发更新（宏任务，可时间切片）', {
        优先级: formatLane(maxPendingLane),
        Scheduler优先级: schedulerPriority
      });
    }
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
      if (__DEV__) {
        devTrace(
          '【并发】useEffect 执行后出现更高优先级更新，放弃本次并发任务'
        );
      }
      return null;
    }
  }

  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;

  if (updateLane === NoLane) return null;

  const needSync = updateLane === SyncLane || didTimeout;
  if (__DEV__) {
    devTrace('【并发】开始执行并发工作任务', {
      优先级: formatLane(updateLane),
      任务已过期: didTimeout ? '是' : '否',
      退化为同步: needSync ? '是' : '否'
    });
  }
  // render 阶段
  const exitStatus = renderRoot(root, updateLane, !needSync);

  // render 阶段结束后，进入 commit 阶段
  ensureRootIsScheduled(root);

  if (exitStatus === RootIncomplete) {
    // 执行中断
    if (root.callbackNode !== curCallbackNode) {
      // 代表有更高优先级的任务插进来
      if (__DEV__) {
        devTrace('【并发】渲染未完成时被更高优先级打断，放弃续跑');
      }
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  if (exitStatus === RootComplete) {
    if (__DEV__) {
      devTrace('【并发】渲染完成，即将进入 Commit', {
        优先级: formatLane(updateLane)
      });
    }
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

  if (__DEV__) {
    devTrace('【同步】开始执行同步工作任务（一口气渲染完）', {
      优先级: formatLane(nextLane)
    });
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
  if (__DEV__) {
    devTrace('【Render】开始渲染阶段', {
      优先级: formatLane(lane),
      模式: shouldTimeSlice ? '并发（可切片）' : '同步（不可中断）',
      是否中断恢复: isResume ? '是' : '否'
    });
  }

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
  if (__DEV__) {
    devTrace('【Commit】开始提交阶段，变更将反映到 DOM', {
      优先级: formatLane(lane)
    });
  }
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
  if (__DEV__ && workInProgress !== null) {
    concurrentSliceIndex += 1;
    devTrace('【时间切片】本时间片用尽，让出主线程', {
      第几次切片: concurrentSliceIndex,
      断在哪个节点: formatFiberTag(workInProgress.tag)
    });
  }
}

function performUnitOfWork(fiber: FiberNode) {
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
