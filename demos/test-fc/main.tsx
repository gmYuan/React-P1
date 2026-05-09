import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [mode, setMode] = useState('child');
  const [count, setCount] = useState(0);
  let jsx = null;

  // 直接暴露 setState 函数，避免闭包问题
  (window as any).setCount = setCount;
  (window as any).setMode = setMode;

  if (mode === 'child') {
    jsx = <Child count={count} />;
  } else if (mode === 'text') {
    return `我是text里的值：${count}`;
  } else if (mode === 'h1') {
    return <h1>{`我是h1的值：${count}`}</h1>;
  } else {
    return <section>{`我是section的值：${count}`}</section>;
  }

  return <div>{jsx}</div>;
}

//  {/* <span>我是Child内容</span> */}
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

// import { useState } from 'react';
// import ReactDOM from 'react-dom/client';

// // function App() {
// //   return (
// //     <div>
// //       <Child />
// //     </div>
// //   );
// // }

// console.log(import.meta.hot);

// function App() {
//   const [num, setNum] = useState(100);
//   window.setNum = setNum;
//   return num === 3 ? <Child /> : <div>{num}</div>;
// }

// function APP() {}

// function Child() {
//   return (
//     <p>
//       <span>I'm a child1</span>
//     </p>
//   );
// }

// ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
//   <App />
// );
