/**
 * 测试延时任务的递归调用入口
 * 目的：确定 handleTimeout 和 requestHostTimeout 谁是递归的真正起点
 */

// 模拟 Scheduler 的核心函数
let callStack = [];
let recursionCount = 0;

// 模拟 timerQueue
let timerQueue = [
  { id: 1, startTime: 100, delay: 100 },
  { id: 2, startTime: 200, delay: 200 },
  { id: 3, startTime: 300, delay: 300 },
];

function peek(queue) {
  return queue.length > 0 ? queue[0] : null;
}

function requestHostTimeout(callback, delay) {
  callStack.push(`  → requestHostTimeout 被调用 (delay: ${delay}ms)`);
  console.log(`${' '.repeat(recursionCount * 2)}📞 requestHostTimeout(handleTimeout, ${delay})`);
  
  // 模拟 setTimeout
  setTimeout(() => {
    callStack.push(`  → setTimeout 到期，触发 callback`);
    console.log(`${' '.repeat(recursionCount * 2)}⏰ setTimeout 到期，执行 callback...`);
    callback(Date.now());
  }, 10); // 用 10ms 模拟，加快测试
}

function handleTimeout(currentTime) {
  recursionCount++;
  const indent = ' '.repeat((recursionCount - 1) * 2);
  
  console.log(`\n${indent}┌─── 第 ${recursionCount} 次调用 handleTimeout ───┐`);
  callStack.push(`\n【第 ${recursionCount} 次递归】handleTimeout 被触发`);
  callStack.push(`  → isHostTimeoutScheduled = false`);
  
  console.log(`${indent}│ 当前 timerQueue 长度: ${timerQueue.length}`);
  
  // 模拟 advanceTimers（简单移除第一个任务）
  if (timerQueue.length > 0) {
    const task = timerQueue.shift();
    callStack.push(`  → advanceTimers: 转移任务 ${task.id}`);
    console.log(`${indent}│ advanceTimers: 转移任务 ${task.id}`);
  }
  
  // 检查是否还有更多延时任务
  const firstTimer = peek(timerQueue);
  
  if (firstTimer !== null) {
    console.log(`${indent}│ timerQueue 还有任务！任务 ${firstTimer.id}`);
    callStack.push(`  → timerQueue 还有任务，准备递归`);
    console.log(`${indent}│ 🔄 递归调用：handleTimeout → requestHostTimeout`);
    callStack.push(`  → 【递归点】handleTimeout 调用 requestHostTimeout`);
    
    // 这里是递归的关键点
    requestHostTimeout(handleTimeout, firstTimer.delay);
  } else {
    console.log(`${indent}│ timerQueue 为空，递归结束`);
    callStack.push(`  → timerQueue 为空，递归终止`);
    console.log(`${indent}└─── handleTimeout 完成 ───┘\n`);
    
    // 打印完整的调用栈
    console.log('\n' + '='.repeat(60));
    console.log('📋 完整调用栈分析：');
    console.log('='.repeat(60));
    callStack.forEach(line => console.log(line));
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 结论：');
    console.log('='.repeat(60));
    console.log('递归的入口/起点：handleTimeout');
    console.log('  - handleTimeout 内部决定是否继续递归');
    console.log('  - handleTimeout 调用 requestHostTimeout');
    console.log('  - requestHostTimeout 通过 setTimeout 异步触发 handleTimeout');
    console.log('');
    console.log('递归路径：');
    console.log('  handleTimeout (起点)');
    console.log('      ↓');
    console.log('  调用 requestHostTimeout(handleTimeout, delay)');
    console.log('      ↓');
    console.log('  setTimeout 设置闹钟');
    console.log('      ↓');
    console.log('  ⏰ 异步等待');
    console.log('      ↓');
    console.log('  setTimeout 到期，触发 handleTimeout (回到起点)');
    console.log('='.repeat(60));
  }
  
  console.log(`${indent}└─── handleTimeout 完成 ───┘\n`);
}

// 启动测试：模拟第一次调用（从 scheduleCallback）
console.log('🚀 测试开始：模拟 scheduleCallback 第一次调用\n');
console.log('初始 timerQueue:', timerQueue.map(t => `任务${t.id}`).join(', '));
console.log('');

callStack.push('【初始调用】scheduleCallback 调用 requestHostTimeout');
requestHostTimeout(handleTimeout, timerQueue[0].delay);

// 等待所有异步完成
setTimeout(() => {
  console.log('\n✅ 测试完成！');
}, 5000);
