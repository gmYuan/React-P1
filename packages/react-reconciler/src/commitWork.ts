import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update
} from './fiberFlags';
import { FiberNode, FiberRootNode } from './fiber';
import {
  FunctionComponent,
  Fragment,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';
import {
  Container,
  removeChild,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer
} from 'hostConfig';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    // 向下遍历
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 向上遍历 DFS
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect);
        const sibling: FiberNode | null = nextEffect.sibling;

        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }

        nextEffect = nextEffect.return;
      }
    }
  }
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }

  // flags Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }

  // flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
};

function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. 找到第一个root host节点
  // 2. 每找到一个 host节点, 判断下这个节点是不是 1 找到的那个节点的 兄弟节点
  const lastOne = childrenToDelete[childrenToDelete.length - 1];
  if (!lastOne) {
    childrenToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber == node) {
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
}

function commitDeletion(childToDelete: FiberNode) {
  // 跟踪需要移除的子树中的 Fiber 节点
  const rootChildrenToDelete: FiberNode[] = [];

  // 递归遍历子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // TODO 解绑ref
        return;

      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;

      case FunctionComponent:
        // Todo useEffect unmount 解绑ref
        return;

      case Fragment:
        return;

      default:
        if (__DEV__) {
          console.warn('未实现的 delete 类型', unmountFiber);
        }
    }
  });

  // 移除 rootChildrenToDelete 的DOM
  if (rootChildrenToDelete.length) {
    // 找到待删除子树的根节点的 parent DOM
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(hostParent, node.stateNode);
      });
    }
  }

  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    // 向下遍历，递
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    // 终止条件
    if (node === root) return;

    // 向上遍历，归
    while (node.sibling === null) {
      // 终止条件
      if (node.return == null || node.return == root) return;
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork);
  }

  // parent DOM
  const hostParent = getHostParent(finishedWork);

  // Host sibling
  const sibling = getHostSibling(finishedWork);

  // finishedWork ~~ DOM append parent DOM
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(hostParent, finishedWork, sibling);
  }
};

// 获取兄弟 Host 节点
const getHostSibling = (fiber: FiberNode) => {
  let node: FiberNode = fiber;

  findSibling: while (true) {
    // 没有兄弟节点时，向上遍历
    while (node.sibling == null) {
      const parent = node.return;
      if (
        parent == null ||
        parent.tag == HostComponent ||
        parent.tag == HostRoot
      ) {
        return null;
      }
      node = parent;
    }

    // 向下遍历
    node.sibling.return = node.return;
    node = node.sibling;
    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 不稳定的 Host 节点不能作为目标兄弟 Host 节点
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child == null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) == NoFlags) {
      return node.stateNode;
    }
  }
};

function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;

  while (parent) {
    const parentTag = parent.tag;
    // HostComponent HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }

    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }

    parent = parent.return;
  }

  if (__DEV__) {
    console.warn('未找到host parent');
  }
  return null!;
}

function insertOrAppendPlacementNodeIntoContainer(
  hostParent: Container,
  finishedWork: FiberNode,
  before?: Instance
) {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      // 执行移动操作
      insertChildToContainer(hostParent, finishedWork.stateNode, before);
    } else {
      // 执行插入操作
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(hostParent, child, before);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(hostParent, sibling, before);
      sibling = sibling.sibling;
    }
  }
}
