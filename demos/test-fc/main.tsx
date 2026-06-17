import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { unstable_NormalPriority, unstable_runWithPriority } from 'scheduler';

console.log('我是 Main1');

export default function App() {
  const [num, setNum] = useState(100);
  const [tick, setTick] = useState(0);

  useEffect(function AppEft1() {
    console.log('AppEft1 create');
  }, []);

  useEffect(
    function AppEft2() {
      console.log('AppEft2 change num =', num);

      return function AppEft2Dest() {
        console.log('AppEft2 destroy num =', num);
      };
    },
    [num]
  );

  function startLowPriorityRender() {
    console.log('[demo] schedule low priority update');
    unstable_runWithPriority(unstable_NormalPriority, () => {
      // 让这次更新走 DefaultLane -> 并发渲染路径
      setNum(300);
      setNum((num) => num + 20);
      setTick((v) => v + 5);
      setTick((v) => v + 7);
    });
  }

  return (
    <>
      <button onClick={startLowPriorityRender}>
        Start low-priority render (DefaultLane)
      </button>
      <p>tick: {tick}</p>

      <ul
        onClick={() => {
          console.log('[demo] click ul -> sync update');
          setNum(50);
        }}
      >
        {new Array(num).fill(0).map((_, i) => {
          return <Child key={i}> {i} </Child>;
        })}
      </ul>
    </>
  );
}

function Child({ children }) {
  const now = performance.now();
  while (performance.now() - now < 4) {}
  return <li>{children}</li>;
}

const root = ReactDOM.createRoot(document.querySelector('#root'));

root.render(<App />);
