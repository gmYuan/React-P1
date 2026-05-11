import { ReactElementType, Props, Key } from 'shared/ReactTypes';
import {
  createFiberFromElement,
  FiberNode,
  createWorkInProgress,
  createFiberFromFragment
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { HostText, Fragment } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
  // 从父节点中删除指定的子节点
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode): void {
    if (!shouldTrackEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  // 删除当前节点的所有兄弟节点
  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ): void {
    if (!shouldTrackEffects) return;
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }

  // 针对的是 所有更新后为 单一节点的情况
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            //type 相同
            // 处理 Fragment 的情况
            let props: Props = element.props;
            if (element.type === REACT_FRAGMENT_TYPE) {
              props = element.props.children;
            }

            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            // 当前节点可复用，标记剩下的节点删除
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          // key 相同，但 type 不同，删除所有旧的 Fiber 节点
          deleteRemainingChildren(returnFiber, currentFiber);
          break;
        } else {
          if (__DEV__) {
            console.warn('还未实现的react类型', element);
            break;
          }
        }
      } else {
        // key 不同，删除当前旧的 Fiber 节点，继续遍历兄弟节点
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }

    // 根据 element 创建fiber
    let fiber;
    if (element.type === REACT_FRAGMENT_TYPE) {
      // todo
      fiber = createFiberFromFragment(element.props.children, element.key);
    } else {
      fiber = createFiberFromElement(element);
    }
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    while (currentFiber !== null) {
      if (currentFiber.tag === HostText) {
        // 类型没变，可以复用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        return existing;
      } else {
        // 删除旧的 Fiber 节点
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }
    // 创建新的 Fiber 节点
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    // 最后一个可复用 Fiber 在 current 中的 index
    let lastPlacedIndex = 0;
    // 创建的第一个新 Fiber
    let firstNewFiber: FiberNode | null = null;
    // 创建的最后一个新 Fiber
    let lastNewFiber: FiberNode | null = null;

    // 1. 将 current 中所有同级 Fiber 节点保存在 Map 中
    const existingChildren: ExistingChildren = new Map();
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse =
        current.key !== null ? current.key : current.index.toString();
      existingChildren.set(keyToUse, current);
      current = current.sibling;
    }

    // 2. 遍历 newChild 数组，判断是否可复用
    for (let i = 0; i < newChild.length; i++) {
      const after = newChild[i];
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

      // xxxx  false null
      if (newFiber == null) {
        continue;
      }

      // 3. 标记插入或移动
      newFiber.index = i;
      newFiber.return = returnFiber;

      if (lastNewFiber == null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      if (!shouldTrackEffects) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 标记移动
          newFiber.flags |= Placement;
          continue;
        } else {
          // 不移动
          lastPlacedIndex = oldIndex;
        }
      } else {
        // mount 首屏渲染阶段，标记插入
        newFiber.flags |= Placement;
      }
    }

    // 4. 将 Map 中剩下的标记为删除
    existingChildren.forEach((fiber) => {
      deleteChild(returnFiber, fiber);
    });

    return firstNewFiber;
  }

  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
  const keyToUse =
    typeof element === 'object' && element !== null && element.key != null
      ? element.key
      : index.toString();
    const before = existingChildren.get(keyToUse);

    // HostText
    if (typeof element === 'string' || typeof element === 'number') {
      // 可复用，复用旧的 Fiber 节点
      if (before && before.tag === HostText) {
        existingChildren.delete(keyToUse);
        return useFiber(before, { content: element + '' });
      }
      // 不可复用，创建新的 Fiber 节点
      return new FiberNode(HostText, { content: element + '' }, null);
    }

    // ReactElement
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (element.type === REACT_FRAGMENT_TYPE) {
            return updateFragment(
              returnFiber,
              before,
              element,
              keyToUse,
              existingChildren
            );
          }

          // 可复用，复用旧的 Fiber 节点
          if (before && before.type === element.type) {
            existingChildren.delete(keyToUse);
            return useFiber(before, element.props);
          }
          // 不可复用，创建新的 Fiber 节点
          return createFiberFromElement(element);

        default:
          break;
      }
    }

    // 这里的情况是 "children 数组里的某个元素本身还是数组"（嵌套数组，通常对应 Fragment 场景）
    // 即：<ul> { [<li/>, <li/>] } </ul>
    if (Array.isArray(element)) {
      return updateFragment(
        returnFiber,
        before,
        element,
        keyToUse,
        existingChildren
      );
    }

    return null;
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: any
  ) {
    // 判断 Fragment
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild?.props.children;
    }

    // 判断当前fiber的类型
    // ReactElement 节点
    if (typeof newChild === 'object' && newChild !== null) {
      //  多节点的情况 ul>li*3
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild);
      }

      // 处理单个 ReactElement 节点的情况
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn('未实现的reconcile类型', newChild);
          }
          break;
      }
    }

    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // default 情况，删除旧的 Fiber 节点
    if (currentFiber !== null) {
      deleteRemainingChildren(returnFiber, currentFiber);
    }

    if (__DEV__) {
      console.warn('未实现的reconcile类型', newChild);
    }

    return null;
  };
}

// 复用 Fiber 节点
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

// 复用或新建 Fragment
function updateFragment(
  returnFiber: FiberNode,
  current: FiberNode | undefined,
  elements: any[],
  key: Key,
  existingChildren: ExistingChildren
) {
  let fiber;
  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key);
  } else {
    existingChildren.delete(key);
    fiber = useFiber(current, elements);
  }
  fiber.return = returnFiber;
  return fiber;
}

export const reconcileChildFibers = ChildReconciler(true);

export const mountChildFibers = ChildReconciler(false);
