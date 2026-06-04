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
  SyncLane
} from './fiberLanes';
import { flushSyncCallback, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';

// 注意：scheduler 是 CJS 包，Vite dev 对“多行具名导入”的 CJS interop 改写会破坏
// source map（导致断点行错位）。保持单行导入可避免该问题。
import { unstable_scheduleCallback as scheduleCallback } from 'scheduler';
import { unstable_NormalPriority as NormalPriority } from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null;

let wipRootRenderLane: Lane = NoLane;

let rootDoesHasPassiveEffects = false;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
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

  // 没有更新了，重置并 return
  if (maxPendingLane === NoLane) {
    return;
  }

  if (maxPendingLane === SyncLane) {
    // 同步优先级，用微任务调度
    if (__DEV__) {
      console.log('在微任务中调度，优先级：', maxPendingLane);
    }
    scheduleSyncCallback(
      performSyncWorkOnRoot.bind(null, root, maxPendingLane)
    );
    scheduleMicroTask(flushSyncCallback);
  } else {
    // 其他优先级，用宏任务调度
  }
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

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 其他比 SyncLane 低的优先级或 NoLane，重新调度
    ensureRootIsScheduled(root);
    return;
  }

  // render 阶段
  // 初始化
  if (__DEV__) {
    console.warn('render阶段开始，lane：', lane);
  }

  prepareFreshStack(root, lane);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop发生错误', e);
      }
      workInProgress = null;
    }
  } while (true);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane;
  wipRootRenderLane = NoLane;

  // wip fiberNode树 树中的flags
  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }

  if (__DEV__) {
    console.warn('commit阶段开始', finishedWork);
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

function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
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
