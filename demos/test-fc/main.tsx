// 多节点 DOM-diff
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [mode, setMode] = useState('fg3');
  const [count, setCount] = useState(0);
  let jsx = null;

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
    const arr =
      count % 2 === 0
        ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
        : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];
    return (
      <ul onClickCapture={() => setCount(count + 1)}>
        <li>4</li>
        <li>5</li>
        {arr}
      </ul>
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
