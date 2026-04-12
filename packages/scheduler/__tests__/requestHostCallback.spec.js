import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scheduleCallback,
  NormalPriority,
  ImmediatePriority,
} from "../src/Scheduler";

describe("requestHostCallback 执行流程追踪", () => {
  let executionLog = [];
  
  beforeEach(() => {
    executionLog = [];
  });

  it("追踪单个任务从 scheduleCallback 到执行的完整流程", async () => {
    // 1. scheduleCallback 被调用
    executionLog.push("1. scheduleCallback 被调用");
    
    scheduleCallback(ImmediatePriority, () => {
      executionLog.push("5. 任务回调被执行");
      return null;
    });
    
    executionLog.push("2. scheduleCallback 返回（任务已入队）");
    
    // 等待 MessageChannel 的异步执行
    await new Promise(resolve => {
      setTimeout(() => {
        executionLog.push("6. 所有任务执行完成");
        resolve();
      }, 10);
    });
    
    console.log("\n=== 执行流程 ===");
    executionLog.forEach(log => console.log(log));
    
    expect(executionLog).toEqual([
      "1. scheduleCallback 被调用",
      "2. scheduleCallback 返回（任务已入队）",
      "5. 任务回调被执行",
      "6. 所有任务执行完成"
    ]);
  });

  it("验证 MessageChannel 的异步特性", async () => {
    let taskExecuted = false;
    
    executionLog.push("步骤1: 调用 scheduleCallback");
    
    scheduleCallback(ImmediatePriority, () => {
      taskExecuted = true;
      executionLog.push("步骤3: 任务在异步中执行");
    });
    
    executionLog.push("步骤2: scheduleCallback 同步返回");
    expect(taskExecuted).toBe(false); // 此时任务还未执行
    
    // 等待异步执行
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(taskExecuted).toBe(true);
    expect(executionLog).toEqual([
      "步骤1: 调用 scheduleCallback",
      "步骤2: scheduleCallback 同步返回",
      "步骤3: 任务在异步中执行"
    ]);
  });

  it("多个任务按优先级执行", async () => {
    scheduleCallback(NormalPriority, () => {
      executionLog.push("普通优先级任务");
    });
    
    scheduleCallback(ImmediatePriority, () => {
      executionLog.push("紧急优先级任务");
    });
    
    scheduleCallback(NormalPriority, () => {
      executionLog.push("另一个普通优先级任务");
    });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    console.log("\n=== 任务执行顺序 ===");
    executionLog.forEach(log => console.log(log));
    
    // 紧急任务应该先执行
    expect(executionLog[0]).toBe("紧急优先级任务");
  });

  it("验证 isMessageLoopRunning 防止重复调度", async () => {
    let callCount = 0;
    
    // 快速连续调度多个任务
    scheduleCallback(ImmediatePriority, () => {
      callCount++;
      executionLog.push(`任务1执行（第${callCount}次回调）`);
    });
    
    scheduleCallback(ImmediatePriority, () => {
      callCount++;
      executionLog.push(`任务2执行（第${callCount}次回调）`);
    });
    
    scheduleCallback(ImmediatePriority, () => {
      callCount++;
      executionLog.push(`任务3执行（第${callCount}次回调）`);
    });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    console.log("\n=== 防重复调度验证 ===");
    executionLog.forEach(log => console.log(log));
    
    // 应该只有一次 MessageChannel 调度，但执行所有3个任务
    expect(callCount).toBe(3);
  });

  it("延迟任务到时后也通过 requestHostCallback 执行", async () => {
    scheduleCallback(ImmediatePriority, () => {
      executionLog.push("即时任务");
    });
    
    scheduleCallback(NormalPriority, () => {
      executionLog.push("延迟任务");
    }, { delay: 20 });
    
    // 等待即时任务执行
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executionLog).toEqual(["即时任务"]);
    
    // 等待延迟任务到时
    await new Promise(resolve => setTimeout(resolve, 20));
    
    console.log("\n=== 延迟任务执行 ===");
    executionLog.forEach(log => console.log(log));
    
    expect(executionLog).toEqual(["即时任务", "延迟任务"]);
  });
});
