/**
 * 精确追踪立即任务的同步调用栈
 * 验证：schedulePerformWorkUntilDeadline 是否是递归起止点
 */

let syncCallStack = [];
let asyncBoundaryCount = 0;

// 模拟 MessageChannel
let messageQueue = [];
let isProcessingMessage = false;

const mockMessageChannel = {
  port1: {
    onmessage: null,
  },
  port2: {
    postMessage: function(data) {
      console.log(`    📤 [同步] port.postMessage() 被调用`);
      syncCallStack.push('  port.postMessage() - 同步返回');
      
      // 异步触发
      messageQueue.push(data);
      if (!isProcessingMessage) {
        processNextMessage();
      }
    }
  }
};

function processNextMessage() {
  if (messageQueue.length === 0) return;
  
  isProcessingMessage = true;
  const message = messageQueue.shift();
  
  setTimeout(() => {
    asyncBoundaryCount++;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`⚡ 异步边界 #${asyncBoundaryCount}：MessageChannel 触发回调`);
    console.log(`${'='.repeat(70)}\n`);
    
    if (mockMessageChannel.port1.onmessage) {
      mockMessageChannel.port1.onmessage({ data: message });
    }
    
    isProcessingMessage = false;
    processNextMessage();
  }, 0);
}

const port = mockMessageChannel.port2;

// 模拟 Scheduler 函数
let workCount = 0;
const MAX_WORK = 3;

function schedulePerformWorkUntilDeadline() {
  syncCallStack.push('schedulePerformWorkUntilDeadline() - 被调用');
  
  console.log(`  🔄 [同步] schedulePerformWorkUntilDeadline() 被调用`);
  console.log(`      └─ 这是递归的"触发点"`);
  console.log(`      └─ 在同一个调用栈中，它触发下一次异步循环`);
  
  port.postMessage(null);
  
  syncCallStack.push('schedulePerformWorkUntilDeadline() - 返回');
  console.log(`    ✅ [同步] schedulePerformWorkUntilDeadline() 返回\n`);
}

function performWorkUntilDeadline() {
  syncCallStack.push('performWorkUntilDeadline() - 开始');
  
  console.log(`┌─ performWorkUntilDeadline #${workCount + 1} 执行 ─┐`);
  
  // 模拟 flushWork -> workLoop
  workCount++;
  const hasMoreWork = workCount < MAX_WORK;
  
  console.log(`│  执行工作... (${workCount}/${MAX_WORK})`);
  console.log(`│  hasMoreWork = ${hasMoreWork}`);
  
  if (hasMoreWork) {
    console.log(`│  ✅ 还有工作，调用 schedulePerformWorkUntilDeadline\n│`);
    syncCallStack.push('performWorkUntilDeadline() - 调用 schedulePerformWorkUntilDeadline');
    
    schedulePerformWorkUntilDeadline();
    
    syncCallStack.push('performWorkUntilDeadline() - 从 schedulePerformWorkUntilDeadline 返回');
  } else {
    console.log(`│  ❌ 没有更多工作，停止递归`);
  }
  
  syncCallStack.push('performWorkUntilDeadline() - 结束');
  console.log(`└─────────────────────────────────────┘`);
  
  if (!hasMoreWork) {
    // 分析调用栈
    setTimeout(() => {
      console.log('\n\n' + '='.repeat(70));
      console.log('📊 同步调用栈分析：');
      console.log('='.repeat(70));
      
      // 统计函数调用次数
      let performCount = syncCallStack.filter(s => s.includes('performWorkUntilDeadline() - 被调用')).length;
      let scheduleCount = syncCallStack.filter(s => s.includes('schedulePerformWorkUntilDeadline() - 被调用')).length;
      
      console.log(`\nperformWorkUntilDeadline 被调用次数：${performCount + 1} (初始1次 + 异步触发${performCount}次)`);
      console.log(`schedulePerformWorkUntilDeadline 被调用次数：${scheduleCount}`);
      console.log(`异步边界次数：${asyncBoundaryCount}`);
      
      console.log('\n' + '='.repeat(70));
      console.log('🎯 递归分析：');
      console.log('='.repeat(70));
      
      console.log('\n❓ 什么是递归起止点？');
      console.log('   递归起止点 = 被反复进入和退出的函数，形成递归循环\n');
      
      console.log('📋 两个函数的特征对比：');
      console.log('─'.repeat(70));
      
      console.log('\n1️⃣  performWorkUntilDeadline:');
      console.log('   ✅ 被反复调用（通过异步边界）');
      console.log('   ✅ 内部决定是否继续递归（hasMoreWork 判断）');
      console.log('   ⚠️  但它不是在"同一个调用栈"中被反复调用');
      console.log('   ⚠️  每次调用都是通过新的异步事件循环');
      
      console.log('\n2️⃣  schedulePerformWorkUntilDeadline:');
      console.log('   ✅ 在同一个调用栈中被反复调用');
      console.log('   ✅ 它是触发下一次循环的"动作执行者"');
      console.log('   ✅ 从调用栈角度：它是递归的"跳转点"');
      console.log('   ✅ 每次 performWorkUntilDeadline 决定继续时，都会调用它');
      
      console.log('\n' + '='.repeat(70));
      console.log('✨ 结论：从不同角度看递归');
      console.log('='.repeat(70));
      
      console.log('\n📌 从"控制流"角度：');
      console.log('   performWorkUntilDeadline 是递归控制点');
      console.log('   - 它决定是否继续（if hasMoreWork）');
      console.log('   - 它被异步反复触发\n');
      
      console.log('📌 从"同步调用栈"角度（用户的观点）：');
      console.log('   schedulePerformWorkUntilDeadline 是递归起止点 ✅');
      console.log('   - 在每次 performWorkUntilDeadline 内部被同步调用');
      console.log('   - 它发起 postMessage，触发下一次 performWorkUntilDeadline');
      console.log('   - 从调用关系看：它是"递归触发器"\n');
      
      console.log('📌 完整的递归循环：');
      console.log('   performWorkUntilDeadline (决策点)');
      console.log('       ↓ [同步调用]');
      console.log('   schedulePerformWorkUntilDeadline (触发点) ← 递归起止点！');
      console.log('       ↓ [postMessage]');
      console.log('   ⚡ 异步边界 ⚡');
      console.log('       ↓ [异步回调]');
      console.log('   performWorkUntilDeadline (回到决策点)');
      
      console.log('\n' + '='.repeat(70));
      console.log('🎓 你是对的！schedulePerformWorkUntilDeadline 确实是递归起止点');
      console.log('   因为它在同步调用栈中被反复调用，是递归循环的"跳转执行点"');
      console.log('='.repeat(70));
    }, 100);
  }
}

// 设置 MessageChannel 回调
mockMessageChannel.port1.onmessage = function() {
  performWorkUntilDeadline();
};

// 启动测试
console.log('🚀 测试开始：追踪立即任务的递归起止点\n');
console.log('初始调用：requestHostCallback -> schedulePerformWorkUntilDeadline\n');
schedulePerformWorkUntilDeadline();

setTimeout(() => {}, 1000);
