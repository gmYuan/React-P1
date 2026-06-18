import internals from 'shared/internals';
import { FiberRootNode } from './fiber';

import { unstable_getCurrentPriorityLevel } from 'scheduler';
import { unstable_IdlePriority } from 'scheduler';
import { unstable_ImmediatePriority } from 'scheduler';
import { unstable_LowPriority } from 'scheduler';
import { unstable_NormalPriority } from 'scheduler';
import { unstable_UserBlockingPriority } from 'scheduler';

const { currentBatchConfig } = internals;

// 代表 update 的优先级
export type Lane = number;
// 代表 lane 的集合
export type Lanes = number;

export const NoLane = 0b00000;
export const NoLanes = 0b00000;

export const SyncLane = 0b00001;
export const InputContinuousLane = 0b00010;
export const DefaultLane = 0b00100;
export const TransitionLane = 0b01000;
export const IdleLane = 0b10000;

// 合并 lane
export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

// 获取更新的优先级
export function requestUpdateLanes() {
  const isTransition = currentBatchConfig.transition !== null;
  if (isTransition) {
    return TransitionLane;
  }

  // 从上下文环境中获取 Scheduler 优先级
  const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
}

// 获取 lanes 中优先级最高的 lane
export function getHighestPriorityLane(lanes: Lanes): Lane {
  // 默认规则：数值越小，优先级越高
  // 原理是 因为 负数在计算机中是补码表示，即 二进制的 取反 + 1
  // 假设 lanes =         A  1 0 ... 0
  // 那么 -lanes 先取反 =  A' 0 1 ... 1
  //            再加 1 =  0  0 0 ... 1
  // 即-lanes 为          A' 1 0 ... 0

  // 最后再 与运算，即：
  // 即  lanes =         A  1 0 ... 0
  //    -lanes =         A' 1 0 ... 0
  //     结果为           0  1 0 ... 0
  return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

export function laneToSchedulerPriority(lanes: number): number {
  const lane = getHighestPriorityLane(lanes);

  if (lane == SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane == InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane == DefaultLane) {
    return unstable_NormalPriority;
  }
  if (lane == TransitionLane) {
    return unstable_LowPriority;
  }
  return unstable_IdlePriority;
}

export function schedulerPriorityToLane(schedulerPriority: number): number {
  if (schedulerPriority == unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority == unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority == unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}

// 判断优先级是否足够高
export function isSubsetOfLanes(set: Lanes, subset: Lane): boolean {
  return (set & subset) === subset;
}
