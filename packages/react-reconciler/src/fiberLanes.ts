// 代表 update 的优先级
export type Lane = number;
// 代表 lane 的集合
export type Lanes = number;

export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export const SyncLane = 0b0001;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

// 获取更新的优先级
export function requestUpdateLanes() {
  // 从上下文环境中获取 Scheduler 优先级
  // const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  // const lane = schedulerPriorityToLane(currentSchedulerPriority);
  // return lane;
  return SyncLane;
}
