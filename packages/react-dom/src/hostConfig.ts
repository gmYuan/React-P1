import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';
import { DOMElement, updateFiberProps } from './SyntheticEvent';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
  const element = document.createElement(type);
  // applyPropsToElement(element, props);
  updateFiberProps(element as unknown as DOMElement, props);
  return element;
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
      // applyPropsToElement(fiber.stateNode, fiber.memoizedProps);
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

function applyPropsToElement(element: Element, props: Props) {
  if (props == null) {
    return;
  }

  Object.keys(props).forEach((key) => {
    const value = props[key];

    if (key === 'children' || key === 'key' || key === 'ref') {
      return;
    }

    // 事件由 SyntheticEvent 统一代理，不直接绑在 DOM 上
    if (/^on[A-Z]/.test(key)) {
      return;
    }

    const htmlElement = element as HTMLElement;

    if (key === 'className') {
      htmlElement.className = value ?? '';
      return;
    }

    if (key === 'style') {
      const style = htmlElement.style;
      if (value == null || typeof value !== 'object') {
        htmlElement.removeAttribute('style');
        return;
      }
      Object.keys(value).forEach((styleName) => {
        style.setProperty(styleName, String(value[styleName]));
      });
      return;
    }

    if (value == null || value === false) {
      element.removeAttribute(key);
      return;
    }

    if (value === true) {
      element.setAttribute(key, '');
      return;
    }

    element.setAttribute(key, String(value));
  });
}

export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;
