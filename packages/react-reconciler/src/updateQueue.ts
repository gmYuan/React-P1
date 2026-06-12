import { Action } from 'shared/ReactTypes';
import { Dispatch } from 'react/src/currentDispatcher';
import { isSubsetOfLanes, Lane, NoLane } from './fiberLanes';
import { devTrace, formatLane } from './devTrace';

let __YgmUpdateIndex = 0;

export interface Update<State> {
  action: Action<State>;
  next: Update<any> | null;
  lane: Lane;
  __YgmUpdateIndex: number;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    next: null,
    lane,
    __YgmUpdateIndex: __YgmUpdateIndex++
  };
};

export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    // pending = a -> a
    update.next = update;
  } else {
    // pending = b -> a -> b
    // c.next = b.next
    update.next = pending.next;
    // b.next = c
    pending.next = update;
  }
  // pending 指向 update 环状链表的最后一个节点
  // 尾节点.next 永远指向头节点
  // pending = c -> a -> b -> c
  updateQueue.shared.pending = update;
};

// 从 UpdateQueue 中消费 Update 的方法
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memoizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  };

  if (pendingUpdate !== null) {
    // 第一个 update
    const first = pendingUpdate.next;
    let pending = first as Update<any>;

    // 消费本次 Update 后的 baseState
    let newBaseState = baseState;
    // 消费本次 Update 后计算后的结果
    let newState = baseState;
    // 消费本次 Update 后的 baseQueue 链表头
    let newBaseQueueFirst: Update<State> | null = null;
    // 消费本次 Update 后的 baseQueue 链表尾
    let newBaseQueueLast: Update<State> | null = null;

    do {
      const updateLane = pending.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够，跳过本次 Update
        if (__DEV__) {
          devTrace('【UpdateQueue】当前渲染优先级不够，update 暂存到 baseQueue', {
            update序号: pending.__YgmUpdateIndex,
            update优先级: formatLane(updateLane),
            当前渲染优先级: formatLane(renderLane)
          });
        }
        const clone = createUpdate(pending.action, pending.lane);
        // 判断之前是否存在被跳过的 Update
        // 是不是第一个被跳过的
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          // 若有更新被跳过，baseState 为最后一个没有被跳过的 Update 计算后的结果
          newBaseState = newState;
        } else {
          // 本次更新第一个被跳过的 Update 及其后面的所有 Update 都会被保存在 baseQueue 中参与下次 State 计算
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        // 判断之前是否存在被跳过的 Update
        if (newBaseQueueLast !== null) {
          // 本次更新参与计算但保存在 baseQueue 中的 Update，优先级会降低到 NoLane
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

        const action = pending.action;
        if (action instanceof Function) {
          // 若 action 是回调函数：(baseState = 1, update = (i) => 5i)) => memoizedState = 5
          newState = action(baseState);
        } else {
          // 若 action 是状态值：(baseState = 1, update = 2) => memoizedState = 2
          newState = action;
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次更新没有 Update 被跳过
      newBaseState = newState;
    } else {
      // 本次更新有 Update 被跳过
      // 将 baseQueue 变成环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memoizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueFirst;
  }

  return result;
};
