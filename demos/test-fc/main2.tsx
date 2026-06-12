import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  unstable_runWithPriority,
  unstable_ImmediatePriority,
  unstable_IdlePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority
} from 'scheduler';

/**
 * 耗时组件 - 触发时间切片
 */
function Child({
  children,
  throwAt
}: {
  children: number;
  throwAt: number | null;
}) {
  if (throwAt !== null && children === throwAt) {
    throw new Error(`render error at child ${children}`);
  }
  const now = performance.now();
  let spin = 0;
  while (performance.now() - now < 4) {
    spin++;
  } // 每个 4ms
  void spin;
  return <li>{children}</li>;
}

function PassiveEffectProbe({
  effectTick,
  enableKick,
  onKick
}: {
  effectTick: number;
  enableKick: boolean;
  onKick: () => void;
}) {
  useEffect(() => {
    if (!enableKick) return;
    console.log(
      '🧪 useEffect 已执行，准备在 flushPassiveEffects 里插入高优先级更新'
    );
    unstable_runWithPriority(unstable_ImmediatePriority, () => {
      onKick();
    });
  }, [effectTick, enableKick, onKick]);
  return null;
}

function blockMainThread(ms: number) {
  const start = performance.now();
  let spin = 0;
  while (performance.now() - start < ms) {
    spin++;
  }
  void spin;
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
  const [throwAt, setThrowAt] = useState<number | null>(null);
  const [effectTick, setEffectTick] = useState(0);
  const [enableEffectKick, setEnableEffectKick] = useState(false);

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
    setThrowAt(null);
    setEnableEffectKick(false);

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
   * 🧪 边界分支测试：
   * 1) didTimeout（用户阻塞优先级 + 长阻塞）
   * 2) flushPassiveEffects 导致调度变化
   * 3) render 抛错恢复分支
   * 4) 无 pending lanes 清理分支
   */
  const runEdgeBranchTest = () => {
    console.clear();
    console.log('🧪 === 开始边界分支测试 ===');
    setCount(0);
    setItems(60);
    setThrowAt(null);
    setEnableEffectKick(false);

    // A. didTimeout 候选分支：用用户阻塞优先级任务 + 主线程长阻塞
    setTimeout(() => {
      unstable_runWithPriority(unstable_UserBlockingPriority, () => {
        console.log('⏱️ 触发 UserBlockingPriority 更新（候选 didTimeout）');
        setItems(240);
        setCount((n) => n + 1);
      });
      console.log('⏱️ 主线程阻塞 1000ms（用于制造 timeout 条件）');
      blockMainThread(1000);
    }, 0);

    // B. flushPassiveEffects 触发调度变化
    setTimeout(() => {
      console.log('🧪 准备触发 useEffect -> 高优先级更新');
      setEnableEffectKick(true);
      setEffectTick((t) => t + 1);
      unstable_runWithPriority(unstable_NormalPriority, () => {
        setItems(180);
      });
    }, 1300);

    // C. render 抛错恢复
    setTimeout(() => {
      unstable_runWithPriority(unstable_IdlePriority, () => {
        console.log('💥 触发 render 抛错（Child 3 抛错）');
        setThrowAt(3);
        setItems(120);
      });
    }, 1700);

    setTimeout(() => {
      unstable_runWithPriority(unstable_ImmediatePriority, () => {
        console.log('🩹 抛错后恢复到安全状态');
        setThrowAt(null);
        setItems(20);
      });
    }, 1900);

    // D. 无 pending lanes 清理分支（ensureRootIsScheduled 的 NoLane 分支）
    setTimeout(() => {
      unstable_runWithPriority(unstable_ImmediatePriority, () => {
        console.log('🧹 触发一次收尾更新，随后应进入 NoLane 清理分支');
        setCount((n) => n + 1);
      });
    }, 2200);

    setTimeout(() => {
      console.log('\n✅ === 边界分支调试提示 ===');
      console.log(
        '1) didTimeout: 在 performConcurrentWorkOnRoot 观察 didTimeout/needSync'
      );
      console.log(
        '2) passive: 在 performConcurrentWorkOnRoot 开头观察 flushPassiveEffects'
      );
      console.log(
        '3) error: 在 renderRoot 的 catch 分支观察 workInProgress = null'
      );
      console.log(
        '4) NoLane: 在 ensureRootIsScheduled 的 maxPendingLane===NoLane 分支观察重置'
      );
    }, 2500);
  };

  const handlePassiveKick = () => {
    console.log('⚡ useEffect 中插入 ImmediatePriority 更新（调度应发生变化）');
    setCount((n) => n + 1000);
    setItems(30);
    setEnableEffectKick(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🚀 React 并发特性测试</h1>

      {/* 当前状态 */}
      <div
        style={{
          padding: '20px',
          background: '#e3f2fd',
          borderRadius: '8px',
          marginBottom: '20px'
        }}
      >
        <h2 style={{ margin: '0 0 10px 0' }}>
          Count:{' '}
          <span style={{ fontSize: '32px', color: '#e91e63' }}>{count}</span>
        </h2>
        <h3 style={{ margin: '0' }}>Items: {items} 个组件</h3>
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
          onClick={runEdgeBranchTest}
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
          🧪 边界分支测试
        </button>
        <button
          onClick={() => {
            setCount(0);
            setItems(100);
            console.clear();
          }}
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
      <div
        style={{
          padding: '15px',
          background: '#fff3cd',
          borderRadius: '4px',
          marginBottom: '20px',
          fontSize: '14px'
        }}
      >
        <strong>💡 测试说明：</strong>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li>
            <strong>综合测试</strong>：验证 baseQueue + 优先级打断 + 时间切片
          </li>
          <li>
            <strong>边界分支测试</strong>：didTimeout + passive 调度变化 +
            render 抛错恢复 + NoLane 清理
          </li>
          <li>
            <strong>查看 Console</strong>：所有日志在浏览器控制台
          </li>
        </ul>

        <strong>🔍 调试断点（按重要性）：</strong>
        <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li>
            <code>processUpdateQueue</code>: 第 95 行{' '}
            <code>if (!isSubsetOfLanes...)</code>
          </li>
          <li>
            <code>updateState</code>: 第 127 行{' '}
            <code>if (baseQueue !== null)</code>
          </li>
          <li>
            <code>ensureRootIsScheduled</code>:{' '}
            <code>if (curPriority === prevPriority)</code>
          </li>
          <li>
            <code>renderRoot</code>:{' '}
            <code>if (wipRootRenderLane !== lane)</code>
          </li>
        </ol>
      </div>

      {/* 渲染列表 */}
      <PassiveEffectProbe
        effectTick={effectTick}
        enableKick={enableEffectKick}
        onKick={handlePassiveKick}
      />
      {items > 0 && (
        <div
          style={{
            padding: '15px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          <h3>渲染列表 ({items} 个，触发时间切片)</h3>
          <ul
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid #eee',
              padding: '10px'
            }}
          >
            {new Array(items).fill(0).map((_, i) => (
              <Child key={i} throwAt={throwAt}>
                {i}
              </Child>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const root = (
  ReactDOM as unknown as {
    createRoot: (container: Element | null) => {
      render: (node: React.ReactNode) => void;
    };
  }
).createRoot(document.querySelector('#root'));
root.render(<App />);
