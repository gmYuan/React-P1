import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
  UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes';
import { EffectTags, HookHasEffect, Passive } from './hookEffectTags';
import { PassiveEffect } from './fiberFlags';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export interface Effect {
  tag: EffectTags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
  ygm_effectIdx: number;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

// 定义函数组件的 FCUpdateQueue 数据结构
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  renderLane = lane;

  // 重置 Hooks 链表
  wip.memoizedState = null;
  // 重置 Effect 链表
  wip.updateQueue = null;

  const current = wip.alternate;

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 当前正在工作的 useEffect
  const hook = mountWorkInProgressHook();
  const nextDeps = deps == undefined ? null : deps;

  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  hook.memoizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 当前正在工作的 useState
  const hook = updateWorkInProgressHook();

  // 计算新 state 的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;

  if (pending !== null) {
    const { memoizedState } = processUpdateQueue(
      hook.memoizedState,
      pending,
      renderLane
    );
    hook.memoizedState = memoizedState;
    // 已处理完本次更新，清空队列，避免后续渲染重复消费
    queue.shared.pending = null;
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = mountWorkInProgressHook();
  let memoizedState;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  return [memoizedState, dispatch] as [State, Dispatch<State>];
}

function updateWorkInProgressHook(): Hook {
  // 保存链表中的下一个 Hook
  let nextCurrentHook: Hook | null;
  if (currentHook == null) {
    // 这是函数组件 update 时的第一个 hook
    const current = (currentlyRenderingFiber as FiberNode).alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 这是函数组件 update 时后续的 hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook == null) {
    // mount/update u1 u2 u3
    // update       u1 u2 u3 u4
    throw new Error(
      `组件 ${currentlyRenderingFiber?.type} 本次执行时的 Hooks 比上次执行多`
    );
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null
  };

  if (workInProgressHook == null) {
    // update 时的第一个hook
    if (currentlyRenderingFiber === null) {
      // currentlyRenderingFiber == null 代表 Hook 执行的上下文不是一个函数组件
      throw new Error('Hooks 只能在函数组件中执行');
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // update 时的其他 hook
    // 将当前处理的 Hook.next 指向新建的 hook，形成 Hooks 链表
    workInProgressHook.next = newHook;
    // 更新当前处理的 Hook
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null
  };

  if (workInProgressHook === null) {
    // mount时 第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount时 后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }

  return workInProgressHook;
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLanes();
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 当前正在工作的 useEffect
  const hook = updateWorkInProgressHook();
  const nextDeps = deps == undefined ? null : (deps as EffectDeps);
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 浅比较依赖
      const prevDeps = prevEffect.deps;
      // 浅比较，相等
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // deps 为空(每次都触发) 或 deps 变化
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputsEqual(
  nextDeps: EffectDeps,
  prevDeps: EffectDeps
): boolean {
  if (nextDeps === null || prevDeps === null) return false;
  if (nextDeps.length !== prevDeps.length) return false;
  for (let i = 0; i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

let ygm_effectIdx = 0;

function pushEffect(
  tag: EffectTags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag,
    create,
    destroy,
    deps,
    next: null,
    ygm_effectIdx: ygm_effectIdx++
  };
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    const newUpdateQueue = createFCUpdateQueue();
    fiber.updateQueue = newUpdateQueue;
    effect.next = effect;
    newUpdateQueue.lastEffect = effect;
  } else {
    // 插入 effect
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect == null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}
