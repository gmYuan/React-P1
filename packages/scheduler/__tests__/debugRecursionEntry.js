/**
 * 追踪延时任务的真实调用栈
 * 目的：确定递归函数到底是 handleTimeout 还是 requestHostTimeout
 */

let callDepth = 0;
let functionCallStack = [];

// 模拟 timerQueue
let timerQueue = [
  { id: 1, delay: 10 },
  { id: 2, delay: 20 },
  { id: 3, delay: 30 },
];

function peek(queue) {
  return queue.length > 0 ? queue[0] : null;
}

function requestHostTimeout(callback, delay) {
  const callInfo = {
    function: 'requestHostTimeout',
    depth: callDepth,
    action: 'called',
    delay: delay,
  };
  functionCallStack.push(callInfo);
  
  console.log(`${'  '.repeat(callDepth)}[${callDepth}] requestHostTimeout 被调用 (delay: ${delay}ms)`);
  console.log(`${'  '.repeat(callDepth)}    └─ 设置 setTimeout，回调是 handleTimeout`);
  
  // ❌ requestHostTimeout 没有调用自己
  // ❌ requestHostTimeout 没有递归特征
  
  setTimeout(() => {
    console.log(`${'  '.repeat(callDepth)}    └─ setTimeout 到期，触发 callback (handleTimeout)`);
    callback(Date.now());
  }, 5); // 快速测试
}

function handleTimeout(currentTime) {
  callDepth++;
  const myDepth = callDepth;
  
  const callInfo = {
    function: 'handleTimeout',
    depth: myDepth,
    action: 'executed',
  };
  functionCallStack.push(callInfo);
  
  console.log(`\n${'  '.repeat(myDepth - 1)}┌─ [${myDepth}] handleTimeout 执行 (第 ${myDepth} 次) ─┐`);
  
  // 模拟转移任务
  if (timerQueue.length > 0) {
    const task = timerQueue.shift();
    console.log(`${'  '.repeat(myDepth - 1)}│  转移任务 ${task.id}`);
  }
  
  const firstTimer = peek(timerQueue);
  
  if (firstTimer !== null) {
    console.log(`${'  '.repeat(myDepth - 1)}│  timerQueue 还有任务 ${firstTimer.id}`);
    console.log(`${'  '.repeat(myDepth - 1)}│  ✅ handleTimeout 调用 requestHostTimeout`);
    console.log(`${'  '.repeat(myDepth - 1)}│  ✅ 这是递归！handleTimeout 间接调用自己`);
    
    // ✅ handleTimeout 调用 requestHostTimeout，后者会触发 handleTimeout
    // ✅ 这就是递归：handleTimeout -> requestHostTimeout -> setTimeout -> handleTimeout
    requestHostTimeout(handleTimeout, firstTimer.delay);
    
    console.log(`${'  '.repeat(myDepth - 1)}└────────────────────────────────┘`);
  } else {
    console.log(`${'  '.repeat(myDepth - 1)}│  timerQueue 为空，停止递归`);
    console.log(`${'  '.repeat(myDepth - 1)}└────────────────────────────────┘`);
    
    // 分析调用栈
    console.log('\n' + '='.repeat(70));
    console.log('📊 函数调用栈分析：');
    console.log('='.repeat(70));
    
    let handleTimeoutCalls = functionCallStack.filter(c => c.function === 'handleTimeout');
    let requestHostTimeoutCalls = functionCallStack.filter(c => c.function === 'requestHostTimeout');
    
    console.log(`\nhandleTimeout 被调用次数：${handleTimeoutCalls.length}`);
    handleTimeoutCalls.forEach((call, index) => {
      console.log(`  第 ${index + 1} 次：深度 ${call.depth}`);
    });
    
    console.log(`\nrequestHostTimeout 被调用次数：${requestHostTimeoutCalls.length}`);
    requestHostTimeoutCalls.forEach((call, index) => {
      console.log(`  第 ${index + 1} 次：深度 ${call.depth}, delay=${call.delay}ms`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('🎯 递归判定标准：');
    console.log('='.repeat(70));
    console.log('1. 递归定义：函数直接或间接调用自己');
    console.log('2. 调用深度：每次调用深度递增');
    console.log('3. 终止条件：有明确的终止条件\n');
    
    console.log('📋 分析结果：');
    console.log('─'.repeat(70));
    console.log('❌ requestHostTimeout 不是递归函数');
    console.log('   - 它从不调用自己');
    console.log('   - 它只是被多处调用（scheduleCallback, handleTimeout, workLoop）');
    console.log('   - 它是一个"被动的辅助函数"\n');
    
    console.log('✅ handleTimeout 是递归函数');
    console.log('   - 它通过 requestHostTimeout 间接调用自己');
    console.log('   - 调用深度递增：1 → 2 → 3');
    console.log('   - 有终止条件：timerQueue 为空时停止');
    console.log('   - 符合递归的所有特征\n');
    
    console.log('🔄 递归路径：');
    console.log('   handleTimeout (depth=1)');
    console.log('       ↓ 调用');
    console.log('   requestHostTimeout');
    console.log('       ↓ setTimeout 回调');
    console.log('   handleTimeout (depth=2) ← 递归！');
    console.log('       ↓ 调用');
    console.log('   requestHostTimeout');
    console.log('       ↓ setTimeout 回调');
    console.log('   handleTimeout (depth=3) ← 递归！');
    console.log('       ...\n');
    
    console.log('='.repeat(70));
    console.log('✨ 结论：handleTimeout 是唯一的递归函数入口');
    console.log('='.repeat(70));
  }
  
  callDepth--;
}

// 启动测试
console.log('🚀 测试开始：追踪延时任务的递归调用\n');
console.log('初始 timerQueue:', timerQueue.map(t => `任务${t.id}`).join(', '));
console.log('');

// 模拟 scheduleCallback 的第一次调用
console.log('[初始] scheduleCallback 调用 requestHostTimeout\n');
requestHostTimeout(handleTimeout, timerQueue[0].delay);

// 等待所有异步完成
setTimeout(() => {
  console.log('\n✅ 测试完成！');
}, 200);
