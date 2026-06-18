import { Container } from 'hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, FiberRootNode } from './fiber';
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue
} from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { HostRoot } from './workTags';
import { requestUpdateLanes } from './fiberLanes';
import { unstable_runWithPriority } from 'scheduler';
import { unstable_ImmediatePriority } from 'scheduler';

export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
}

export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  // 这里官方默认首屏是 同步渲染的，如果想要实现的话,可以使用如下方式

  unstable_runWithPriority(unstable_ImmediatePriority, () => {
    const hostRootFiber = root.current;
    const renderLane = requestUpdateLanes();
    const update = createUpdate<ReactElementType | null>(element, renderLane);
    enqueueUpdate(
      hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
      update
    );
    scheduleUpdateOnFiber(hostRootFiber, renderLane);
  });

  return element;
}
