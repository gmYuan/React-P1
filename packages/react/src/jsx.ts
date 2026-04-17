import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
  Type,
  Key,
  Ref,
  Props,
  ReactElementType,
  ElementType
} from 'shared/ReactTypes';

// ReactElement

const ReactElement = function (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: 'Updated_Ygm22'
  };
  return element;
};

// jsxDEV 方法（开发环境）
export const jsxDEV = (type: ElementType, config: any) => {
  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;

  // 处理 config 中的属性
  for (const prop in config) {
    const val = config[prop];

    // 处理 key
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }

    // 处理 ref
    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }

    // 其他属性放入 props
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }

  return ReactElement(type, key, ref, props);
};

// jsx 方法（生产环境）
export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;

  // 处理 config 中的属性
  for (const prop in config) {
    const val = config[prop];

    // 处理 key
    if (prop === 'key') {
      if (val !== undefined) {
        key = '' + val;
      }
      continue;
    }

    // 处理 ref
    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }

    // 其他属性放入 props
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }

  // 处理 children
  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength) {
    // 单个子元素
    if (maybeChildrenLength === 1) {
      props.children = maybeChildren[0];
    } else {
      // 多个子元素（数组）
      props.children = maybeChildren;
    }
  }

  return ReactElement(type, key, ref, props);
};
