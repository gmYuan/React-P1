/**
 * 调试脚本：追踪 requestHostCallback 的执行流程
 * 运行方式：node debugRequestHostCallback.js
 */

console.log("=== requestHostCallback 执行流程追踪 ===\n");

console.log("【代码流程分析】\n");

console.log("1️⃣ scheduleCallback (即时任务分支)");
console.log("   代码位置: Scheduler.ts:150-153");
console.log("   ```javascript");
console.log("   if (!isHostCallbackScheduled && !isPerformingWork) {");
console.log("     isHostCallbackScheduled = true;  // 🔒 上锁");
console.log("     requestHostCallback();           // ⚡ 触发");
console.log("   }");
console.log("   ```\n");

console.log("2️⃣ requestHostCallback");
console.log("   代码位置: Scheduler.ts:157-162");
console.log("   ```javascript");
console.log("   function requestHostCallback() {");
console.log("     if (!isMessageLoopRunning) {");
console.log("       isMessageLoopRunning = true;      // 🔒 核心锁");
console.log("       schedulePerformWorkUntilDeadline(); // 📮 发消息");
console.log("     }");
console.log("   }");
console.log("   ```\n");

console.log("3️⃣ schedulePerformWorkUntilDeadline");
console.log("   代码位置: Scheduler.ts:185-187");
console.log("   ```javascript");
console.log("   function schedulePerformWorkUntilDeadline() {");
console.log("     port.postMessage(null);  // 📬 MessageChannel 发送消息");
console.log("   }");
console.log("   ```");
console.log("   ⏰ 注意：postMessage 是异步的，会在下一个事件循环执行\n");

console.log("4️⃣ performWorkUntilDeadline (MessageChannel 回调)");
console.log("   代码位置: Scheduler.ts:164-180");
console.log("   触发时机: port1.onmessage 接收到消息");
console.log("   ```javascript");
console.log("   function performWorkUntilDeadline() {");
console.log("     if (isMessageLoopRunning) {");
console.log("       startTime = getCurrentTime();  // ⏱️ 记录时间切片起点");
console.log("       let hasMoreWork = true;");
console.log("       try {");
console.log("         hasMoreWork = flushWork(currentTime); // 🚀 执行任务");
console.log("       } finally {");
console.log("         if (hasMoreWork) {");
console.log("           schedulePerformWorkUntilDeadline(); // 🔄 还有任务，再发消息");
console.log("         } else {");
console.log("           isMessageLoopRunning = false;       // 🔓 解锁");
console.log("         }");
console.log("       }");
console.log("     }");
console.log("   }");
console.log("   ```\n");

console.log("5️⃣ flushWork");
console.log("   代码位置: Scheduler.ts:189-201");
console.log("   ```javascript");
console.log("   function flushWork(initialTime) {");
console.log("     isHostCallbackScheduled = false; // 🔓 重置第一层锁");
console.log("     isPerformingWork = true;         // 🔒 第二层锁");
console.log("     try {");
console.log("       return workLoop(initialTime);  // 🏃 真正的任务循环");
console.log("     } finally {");
console.log("       isPerformingWork = false;      // 🔓 解锁");
console.log("     }");
console.log("   }");
console.log("   ```\n");

console.log("6️⃣ workLoop");
console.log("   代码位置: Scheduler.ts:216-263");
console.log("   职责: 循环执行 taskQueue 中的任务");
console.log("   返回值: true = 还有任务未完成，false = 全部完成\n");

console.log("\n=== 关键时间点 ===\n");
console.log("T0: scheduleCallback 同步执行，任务入队");
console.log("T1: requestHostCallback 同步执行，postMessage 发送");
console.log("T2: --- 同步代码执行完毕，控制权返回给调用者 ---");
console.log("T3: MessageChannel 触发，performWorkUntilDeadline 异步执行");
console.log("T4: flushWork → workLoop 开始执行任务\n");

console.log("\n=== 三层锁的作用 ===\n");
console.log("🔒 isHostCallbackScheduled (第一层)");
console.log("   - 生命周期: scheduleCallback → flushWork 开始");
console.log("   - 作用: 防止在地勤路上时重复发工作单\n");

console.log("🔒 isPerformingWork (第二层)");
console.log("   - 生命周期: flushWork 开始 → workLoop 结束");
console.log("   - 作用: 防止在执行任务期间重复发工作单\n");

console.log("🔒 isMessageLoopRunning (第三层 - 核心)");
console.log("   - 生命周期: requestHostCallback → 所有任务完成");
console.log("   - 作用: 防止发送多条 postMessage（核心防线）\n");

console.log("\n=== MessageChannel 的特性 ===\n");
console.log("为什么使用 MessageChannel？");
console.log("1. 异步执行：postMessage 会在下一个事件循环执行");
console.log("2. 宏任务：比 Promise.then (微任务) 优先级低");
console.log("3. 让出控制权：给浏览器渲染、用户交互等留出时间");
console.log("4. 比 setTimeout(fn, 0) 更快（最小延迟 4ms vs 1ms）\n");

console.log("\n=== 完整流程图 ===\n");
console.log("外部调用 scheduleCallback");
console.log("   ↓ (同步)");
console.log("任务入队 taskQueue");
console.log("   ↓ (同步)");
console.log("requestHostCallback");
console.log("   ↓ (同步)");
console.log("port.postMessage(null)");
console.log("   ↓ (异步边界 ⚡)");
console.log("--- 控制权返回给调用者 ---");
console.log("   ↓ (下一个事件循环)");
console.log("performWorkUntilDeadline");
console.log("   ↓");
console.log("flushWork");
console.log("   ↓");
console.log("workLoop");
console.log("   ↓");
console.log("执行任务回调 (callback)");
