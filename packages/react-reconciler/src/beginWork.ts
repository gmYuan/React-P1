import { FiberNode } from './fiber';
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTags';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';

// 递归中的递阶段
export const beginWork = (wip: FiberNode): FiberNode | null => {
  // 比较,返回子fiberNode
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip);
    default:
      if (__DEV__) {
        console.warn('beginWork未实现的类型');
      }
      break;
  }
  return null;
};

function updateHostRoot(wip: FiberNode) {
  // 根据当前节点和工作中节点的状态进行比较，处理属性等更新逻辑
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  // 清空更新链表
  updateQueue.shared.pending = null;
  // 计算待更新状态的最新值
  const { memoizedState } = processUpdateQueue(baseState, pending);
  wip.memoizedState = memoizedState;
  // 处理子节点的更新逻辑
  const nextChildren = wip.memoizedState;
  reconcileChildren(wip, nextChildren);
  // 返回新的子节点
  return wip.child;
}

function updateHostComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(wip: FiberNode) {
  const nextChildren = renderWithHooks(wip);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  // alternate 指向节点的备份节点，即 current
  const current = wip.alternate;
  if (current !== null) {
    // 组件的更新阶段
    wip.child = reconcileChildFibers(wip, current.child, children);
  } else {
    // 首屏渲染阶段
    wip.child = mountChildFibers(wip, null, children);
  }
}
