import { Action } from 'shared/ReactTypes';
import { Dispatch } from 'react/src/currentDispatcher';
import { Lane } from './fiberLanes';

export interface Update<State> {
  action: Action<State>;
  next: Update<any> | null;
  lane: Lane;
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
    lane
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

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };

  if (pendingUpdate !== null) {
    // 第一个 update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        // baseState 1 update 2 -> memoizedState 2
        // baseState 1 update (x) => 4x -> memoizedState 4
        const action = pending.action;
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          baseState = action;
        }
      } else {
        if (__DEV__) {
          console.error('不应该进入 updateLane !== renderLane 的逻辑');
        }
        break;
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);
  }

  result.memoizedState = baseState;
  return result;
};
