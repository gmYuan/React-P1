import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';
import { DOMElement, updateFiberProps } from './SyntheticEvent';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
  // TODO 处理props
  const element = document.createElement(type) as unknown;
  updateFiberProps(element as DOMElement, props);
  return element as DOMElement;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = (
  container: Container,
  child: Instance | TextInstance
) => {
  container.appendChild(child);
};

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostComponent:
      return updateFiberProps(fiber.stateNode, fiber.memoizedProps);

    case HostText:
      const text = fiber.memoizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);

    default:
      if (__DEV__) {
        console.warn('未实现的 commitUpdate 类型', fiber);
      }
      break;
  }
};

export const commitTextUpdate = (
  textInstance: TextInstance,
  content: string
) => {
  textInstance.textContent = content;
};

export const removeChild = (
  container: Container,
  child: Instance | TextInstance
) => {
  container.removeChild(child);
};

export const insertChildToContainer = (
  container: Container,
  child: Instance,
  before: Instance
) => {
  container.insertBefore(child, before);
};

export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;
