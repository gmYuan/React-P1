import { Lane } from './fiberLanes';
import {
  FunctionComponent,
  Fragment,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';

let seq = 0;

const LANE_LABEL: Record<number, string> = {
  0b0000: '无',
  0b0001: '同步（最高）',
  0b0010: '连续输入',
  0b0100: '默认',
  0b1000: '空闲（最低）'
};

export function formatLane(lane: Lane): string {
  return LANE_LABEL[lane] ?? `未知(0b${lane.toString(2)})`;
}

export function formatLanes(lanes: number): string {
  if (lanes === 0) return '无';
  const parts: string[] = [];
  for (const [bit, label] of Object.entries(LANE_LABEL)) {
    if (Number(bit) !== 0 && (lanes & Number(bit)) !== 0) {
      parts.push(label);
    }
  }
  return parts.length ? parts.join(' + ') : `未知(0b${lanes.toString(2)})`;
}

export function formatFiberTag(tag: number): string {
  switch (tag) {
    case FunctionComponent:
      return '函数组件';
    case HostRoot:
      return '根节点';
    case HostComponent:
      return 'DOM 节点';
    case HostText:
      return '文本节点';
    case Fragment:
      return 'Fragment';
    default:
      return `节点(${tag})`;
  }
}

/** 开发环境追踪日志，输出中文可读的单行信息 */
export function devTrace(
  message: string,
  detail?: Record<string, string | number | boolean | null | undefined>
) {
  if (!__DEV__) return;
  seq += 1;
  if (!detail || Object.keys(detail).length === 0) {
    console.log(`[React·${seq}] ${message}`);
    return;
  }
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('，');
  console.log(`[React·${seq}] ${message}（${parts}）`);
}

export function resetDevTraceSeq() {
  if (__DEV__) seq = 0;
}
