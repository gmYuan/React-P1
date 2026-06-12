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
import { devTrace, formatLane } from './devTrace';

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
  const hostRootFiber = root.current;
  const lane = requestUpdateLanes();
  if (__DEV__) {
    devTrace('【挂载】根容器收到初次渲染请求', {
      优先级: formatLane(lane)
    });
  }
  const update = createUpdate<ReactElementType | null>(element, lane);
  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    update
  );
  scheduleUpdateOnFiber(hostRootFiber, lane);
  return element;
}
