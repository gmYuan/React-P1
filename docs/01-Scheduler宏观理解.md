# Scheduler 宏观理解 - 从0到1的思维推导

## 第一部分：它在解决什么问题？

### 问题场景

假设你在浏览一个购物网站：
- 你点击了"加入购物车"按钮（**高优先级**：用户直接交互）
- 同时页面在后台计算推荐商品（**低优先级**：不紧急的任务）
- 页面还在处理一个复杂的数据统计（**普通优先级**：重要但不紧急）

**核心矛盾**：JavaScript 是单线程的，一次只能做一件事！

### 没有 Scheduler 会发生什么？

| 场景 | 问题 | 用户感受 |
|------|------|----------|
| 长任务占用主线程 | "计算推荐商品"执行了 500ms | 点击按钮后卡顿 0.5 秒 |
| 按任务到达顺序执行 | 低优先级任务先到，高优先级任务排队 | 点击没反应，体验极差 |
| 无法中断任务 | 一个任务必须执行完才能执行下一个 | 页面卡死、无响应 |

**本质问题**：没有"交通指挥员"来管理这些任务的执行顺序和时间分配。

---

## 第二部分：实现调度器的宏观鸟瞰图

### 2.1 整体架构 - 三个核心部分

### 2.2 整体流程图

---

## 第三部分：任务注册入口：scheduleCallback（机场调度系统类比）

### 3.1 机场的基础设施

**两个区域：**

**就绪跑道（taskQueue）**：飞机已经到了，随时可以降落
- 按 `expirationTime` 排序（**燃油最少的在最前面**）
- 用最小堆存储，**堆顶是最紧急的飞机**

**远程等待区（timerQueue）**：飞机还没到，但已预约
- 按 `startTime` 排序（**最先到达的在最前面**）
- 用最小堆存储，**堆顶是最早到达的飞机**

---
**三个关键开关（锁）- 实测验证：**

| 锁名称 | 机场比喻 | 保护阶段 | 缺失影响（实测） |
|--------|----------|----------|----------------|
| **isMessageLoopRunning** | 机场大门的门卫<br>（核心防线） | 从"地勤出发"到"完成所有任务" | ❌ **灾难**<br>发多条消息 → performWorkUntilDeadline 多次调用 → 多个 workLoop 并发 → 全局变量被同时修改 |
| **isHostCallbackScheduled** | 塔台接待员<br>（第一道优化） | 从"发出工作单"到"地勤到达" | ⚠️ **性能浪费**<br>任务B、C到达 → requestHostCallback 被调用 3 次<br>（被 isMessageLoopRunning 拦住，但多 2 次函数调用） |
| **isPerformingWork** | 跑道警戒线<br>（第二道优化） | workLoop 执行期间 | ⚠️ **性能浪费**<br>任务A执行期间，任务D到达 → 通过检查 → requestHostCallback 被调用<br>（被 isMessageLoopRunning 拦住，但多 1 次函数调用） |

**三层防御关系：**

```
任务到达
  ↓
【第一层：isHostCallbackScheduled】 ← 性能优化，提前拦截"地勤在路上"期间的任务
  ↓ (通过)
【第二层：isPerformingWork】 ← 性能优化，提前拦截"地勤正在干活"期间的任务
  ↓ (通过)
requestHostCallback
  ↓
【第三层：isMessageLoopRunning】 ← 核心防御，防止发送多条消息
  ↓ (通过)
postMessage → 执行任务
```

**关键结论：**
- **isMessageLoopRunning** 是核心，只有它也能保证正确性（不会重复执行）
- **前两个锁是性能优化**，提前拦截任务，避免都挤到 requestHostCallback
- `isHostCallbackScheduled` 在 flushWork 开始时会被重置为 false，所以需要 `isPerformingWork` 配合保护执行期间

---

**三个锁的生命周期：**

```
1. scheduleCallback        → isHostCallbackScheduled = true（发工作单）
2. requestHostCallback     → isMessageLoopRunning = true（地勤出发）
3. flushWork 开始          → isHostCallbackScheduled = false, isPerformingWork = true（地勤到岗干活）
4. workLoop 结束           → isPerformingWork = false（地勤干完活）
5. 所有任务完成            → isMessageLoopRunning = false（地勤空闲）
```

---

**延迟任务的倒计时：**

**isHostTimeoutScheduled**：倒计时开关
- 记录"是否已经为最早到达的飞机设了闹钟"
- true = 已设置，false = 未设置

---

### 3.2 飞机申请降落的完整流程

#### 外部调用：scheduleCallback(优先级, callback, options?)

相当于：一架飞机联系塔台，申请降落许可

---

#### 步骤 1：确定飞机的到达时间（startTime）

```javascript
const currentTime = getCurrentTime(); // 当前时间，比如现在是 10:00
let startTime;

if (options?.delay > 0) {
  // 飞机还在路上，30分钟后到
  startTime = currentTime + delay;  // 10:30
} else {
  // 飞机已经到了
  startTime = currentTime;  // 10:00
}
```

**机场比喻：**
- `currentTime` = **现在几点**（10:00）
- `delay` = **飞机还需要飞多久**（30分钟）
- `startTime` = **飞机到达机场的时间**（10:30 或 10:00）

---

#### 步骤 2：计算燃油能撑多久（timeout）

```javascript
let timeout;
switch (priorityLevel) {
  case ImmediatePriority:
    timeout = -1;  // 紧急航班，燃油快没了，必须立刻降
    break;
  case UserBlockingPriority:
    timeout = 250;  // VIP航班，只能再撑250ms
    break;
  case NormalPriority:
    timeout = 5000;  // 普通航班，还能撑5秒
    break;
  case LowPriority:
    timeout = 10000;  // 货运航班，能撑10秒
    break;
  case IdlePriority:
    timeout = 很大的数;  // 空闲航班，燃油足够
    break;
}
```

**机场比喻：**
- `timeout` = **飞机到达后，燃油还能撑多久**
- **优先级越高，燃油越少，timeout 越小**

---

#### 步骤 3：计算最晚降落时间（expirationTime）

```javascript
const expirationTime = startTime + timeout;
```

**机场比喻：**
- `expirationTime` = **飞机最晚必须降落的时间**（再晚就坠毁了）
- 例如：飞机 10:30 到达（startTime），燃油只能撑 5 秒（timeout），那么 **10:30:05 必须降落完成**（expirationTime）

---

#### 步骤 4：制作飞机信息卡（Task 对象）

```javascript
const newTask = {
  id: taskIdCounter++,        // 航班号
  callback,                   // 降落程序
  priorityLevel,              // VIP/普通/货运
  startTime,                  // 到达时间
  expirationTime,             // 最晚降落时间
  sortIndex: -1               // 排序用，后面会填
};
```

---

#### 步骤 5：决定飞机去哪个区域

```javascript
if (startTime > currentTime) {
  // 飞机还没到，去远程等待区
  newTask.sortIndex = startTime;  // 按到达时间排序
  push(timerQueue, newTask);
  // ... 延迟分支逻辑
} else {
  // 飞机已经到了，去就绪跑道
  newTask.sortIndex = expirationTime;  // 按燃油耗尽时间排序
  push(taskQueue, newTask);
  // ... 即时分支逻辑
}
```

---

### 3.3 延迟分支详解（飞机还没到）

#### 场景：飞机 A 30分钟后到，飞机 B 20分钟后到

```javascript
// 飞机放入 timerQueue 后
if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
  // 条件：就绪跑道空着 && 新飞机是最早到的
  
  if (isHostTimeoutScheduled) {
    // 之前已经给其他飞机设了闹钟（比如飞机 A 30分钟）
    cancelHostTimeout();  // 取消旧闹钟
  } else {
    isHostTimeoutScheduled = true;
  }
  
  // 设置新闹钟（飞机 B 20分钟）
  requestHostTimeout(handleTimeout, startTime - currentTime);
}
```

**机场比喻：**

1. **只给最早到的飞机设闹钟**
   - 飞机 A：30分钟后到，设闹钟 30分钟
   - 飞机 B：20分钟后到，是最早的，**取消 30分钟闹钟，重设 20分钟闹钟**

2. **为什么只设一个闹钟？**
   - 闹钟响了之后，会调用 `handleTimeout`
   - `handleTimeout` 会检查 timerQueue，**把所有到时间的飞机都转到就绪跑道**
   - 所以只需要知道"最早到的是什么时候"即可

3. **为什么需要 isHostTimeoutScheduled？**
   - **防止多个闹钟同时在跑**
   - 新的更早的飞机来了，要先取消旧闹钟，再设新的

---

### 3.4 即时分支详解（飞机已经到了）

**场景：飞机 A 现在就要降落**

```javascript
// 飞机放入 taskQueue 后
if (!isHostCallbackScheduled && !isPerformingWork) {
  isHostCallbackScheduled = true;
  requestHostCallback();
}
```

**机场比喻：**

**检查条件：`!isHostCallbackScheduled && !isPerformingWork`**

> **关键：**两个条件必须**同时为 true**（都没问题）才发工作单，否则任务已入队，会被 workLoop 自动处理

**为什么需要两个条件？**
- **isHostCallbackScheduled**：拦截"地勤在路上"期间的任务（第一层）
- **isPerformingWork**：拦截"地勤正在干活"期间的任务（第二层）
- 因为 `flushWork` 开始时会重置 `isHostCallbackScheduled = false`，所以需要 `isPerformingWork` 来保护执行期间
- 最终都会被 `isMessageLoopRunning` 拦住，前两个锁只是性能优化
