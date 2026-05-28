// 多节点 DOM-diff
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [mode, setMode] = useState('fg3');
  const [count, setCount] = useState(0);
  let jsx = null;

  // 直接暴露 setState 函数，避免闭包问题
  (window as any).setCount = setCount;
  (window as any).setMode = setMode;

  // fragment1
  if (mode === 'fg1') {
    return (
      <>
        <div />
        <div />
      </>
    );
  }

  // fragment2
  if (mode === 'fg2') {
    return (
      <ul>
        <>
          <li>1</li>
          <li>2</li>
        </>
        <li>3</li>
        <li>4</li>
      </ul>
    );
  }

  // fragment3
  if (mode === 'fg3') {
    const text1Or20 = count % 2 === 0 ? 1 : 20;
    const arr =
      count % 2 === 0
        ? [<li key="4">4</li>, <li key="5">5</li>, <li key="6">6</li>]
        : [<li key="7">7</li>];
    return (
      <>
        <ul onClickCapture={() => setCount(count + 1)}>
          <>
            <li>{text1Or20}</li>
          </>
          <li>2</li>
          {arr}
        </ul>
      </>
    );
  }

  // ul
  if (mode === 'ul') {
    const arr =
      count % 2 === 0
        ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
        : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];
    return <ul onClickCapture={() => setCount(count + 1)}>{arr}</ul>;
  }

  // text
  if (mode === 'text') {
    return `我是text里的值：${count}`;
  }

  // h1
  if (mode === 'h1') {
    return <h1>{`我是h1的值：${count}`}</h1>;
  }
  // Child
  if (mode === 'child') {
    jsx = <Child count={count} />;
    return <div onClick={() => setCount(count + 1)}>{jsx}</div>;
  }

  // 兜底
  return <section>{`我是section的值：${count}`}</section>;
}

function Child({ count }: { count: number }) {
  return (
    <p>
      <span>{`我是Child里的值：${count}`}</span>
    </p>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
