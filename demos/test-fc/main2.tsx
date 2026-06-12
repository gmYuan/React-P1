import { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  unstable_runWithPriority,
  unstable_ImmediatePriority,
  unstable_IdlePriority
} from 'scheduler';

/**
 * 耗时组件 - 触发时间切片
 */
function Child({ children }) {
  const now = performance.now();
  while (performance.now() - now < 4) {} // 每个 4ms
  return <li>{children}</li>;
}

/**
 * 🎯 一个场景覆盖所有核心功能：
 * 1. baseQueue 跳过与恢复（本次改动核心）
 * 2. 优先级打断
 * 3. 时间切片
 * 4. 批处理（updateQueue 环状链表）
 */
export default function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(100);

  /**
   * 🎯 综合测试（推荐）：覆盖所有功能
   * 
   * 测试流程：
   * 1. u0: count + 1 (低优先级) → 时间切片会触发（渲染 200 个组件）
   * 2. u1: count 设置为 10 (高优先级) → 优先级打断 + baseQueue 跳过
   * 3. u2: count + 100 (低优先级) → baseQueue 连续性保证
   * 
   * 预期结果：count 最终为 110
   * 预期渲染：items 最终为 50（高优先级打断低优先级）
   */
  const runComprehensiveTest = () => {
    console.clear();
    console.log('🎯 === 开始综合测试 ===');
    setCount(0);
    setItems(100);

    // u0: 低优先级 count + 1，同时触发大量渲染（时间切片）
    setTimeout(() => {
      unstable_runWithPriority(unstable_IdlePriority, () => {
        console.log('📌 u0 触发 (IdlePriority): count + 1, items = 200');
        setCount((n) => {
          console.log('  u0 执行: count', n, '→', n + 1);
          return n + 1;
        });
        setItems(200); // 200 * 4ms = 800ms，触发时间切片
      });
    }, 10);

    // u1: 高优先级，打断 u0 的渲染
    setTimeout(() => {
      unstable_runWithPriority(unstable_ImmediatePriority, () => {
        console.log('📌 u1 触发 (ImmediatePriority): count = 10, items = 50');
        setCount((n) => {
          console.log('  u1 执行: count', n, '→ 10');
          return 10;
        });
        setItems(50); // 打断渲染，改为 50 个
      });
    }, 100);

    // u2: 低优先级 count + 100
    setTimeout(() => {
      unstable_runWithPriority(unstable_IdlePriority, () => {
        console.log('📌 u2 触发 (IdlePriority): count + 100');
        setCount((n) => {
          console.log('  u2 执行: count', n, '→', n + 100);
          return n + 100;
        });
      });
    }, 120);

    setTimeout(() => {
      console.log('\n✅ === 预期结果 ===');
      console.log('count 应为 110 (baseQueue 正确恢复)');
      console.log('items 应为 50 (高优先级打断成功)');
      console.log('\n🔍 === 断点建议 ===');
      console.log('1. processUpdateQueue: isSubsetOfLanes 判断');
      console.log('2. updateState: baseQueue 合并');
      console.log('3. ensureRootIsScheduled: 优先级比较');
      console.log('4. renderRoot: wipRootRenderLane 判断');
    }, 300);
  };

  /**
   * 📊 简单测试：只验证 baseQueue
   * 
   * u0: +1 (低) → u1: =10 (高) → u2: +100 (低)
   * 预期：110
   */
  const runSimpleTest = () => {
    console.clear();
    console.log('📊 === 简单测试: 仅 baseQueue ===');
    setCount(0);
    setItems(0);

    setTimeout(() => {
      unstable_runWithPriority(unstable_IdlePriority, () => {
        console.log('u0: count + 1');
        setCount((n) => n + 1);
      });
    }, 10);

    setTimeout(() => {
      unstable_runWithPriority(unstable_ImmediatePriority, () => {
        console.log('u1: count = 10');
        setCount(() => 10);
      });
    }, 50);

    setTimeout(() => {
      unstable_runWithPriority(unstable_IdlePriority, () => {
        console.log('u2: count + 100');
        setCount((n) => n + 100);
      });
    }, 70);

    setTimeout(() => {
      console.log('✅ 预期 count = 110');
    }, 150);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🚀 React 并发特性测试</h1>
      
      {/* 当前状态 */}
      <div style={{ 
        padding: '20px', 
        background: '#e3f2fd', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Count: <span style={{ fontSize: '32px', color: '#e91e63' }}>{count}</span>
        </h2>
        <h3 style={{ margin: '0' }}>
          Items: {items} 个组件
        </h3>
      </div>

      {/* 测试按钮 */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runComprehensiveTest}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px',
            fontWeight: 'bold'
          }}
        >
          🎯 综合测试（推荐）
        </button>
        <button 
          onClick={runSimpleTest}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          📊 简单测试
        </button>
        <button 
          onClick={() => { setCount(0); setItems(100); console.clear(); }}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          重置
        </button>
      </div>

      {/* 说明 */}
      <div style={{ 
        padding: '15px', 
        background: '#fff3cd', 
        borderRadius: '4px',
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <strong>💡 测试说明：</strong>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li><strong>综合测试</strong>：验证 baseQueue + 优先级打断 + 时间切片</li>
          <li><strong>简单测试</strong>：只验证 baseQueue 跳过与恢复</li>
          <li><strong>查看 Console</strong>：所有日志在浏览器控制台</li>
        </ul>
        
        <strong>🔍 调试断点（按重要性）：</strong>
        <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li><code>processUpdateQueue</code>: 第 95 行 <code>if (!isSubsetOfLanes...)</code></li>
          <li><code>updateState</code>: 第 127 行 <code>if (baseQueue !== null)</code></li>
          <li><code>ensureRootIsScheduled</code>: <code>if (curPriority === prevPriority)</code></li>
          <li><code>renderRoot</code>: <code>if (wipRootRenderLane !== lane)</code></li>
        </ol>
      </div>

      {/* 渲染列表 */}
      {items > 0 && (
        <div style={{ 
          padding: '15px', 
          background: 'white', 
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}>
          <h3>渲染列表 ({items} 个，触发时间切片)</h3>
          <ul style={{ 
            maxHeight: '300px', 
            overflowY: 'auto',
            border: '1px solid #eee',
            padding: '10px'
          }}>
            {new Array(items).fill(0).map((_, i) => (
              <Child key={i}>{i}</Child>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.querySelector('#root'));
root.render(<App />);
