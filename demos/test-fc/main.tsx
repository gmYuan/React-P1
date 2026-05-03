import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [mode, setMode] = useState('div');
  const [count, setCount] = useState(0);

  // 直接暴露 setState 函数，避免闭包问题
  (window as any).setCount = setCount;
  (window as any).setMode = setMode;

  if (mode === 'child') {
    return <Child count={count} />;
  }
  if (mode === 'text') {
    return <a>{`我是text里的值：${count}`}</a>;
  }
  return <div>{`我是首屏渲染的值：${count}`}</div>;
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
