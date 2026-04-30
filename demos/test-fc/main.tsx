import { useState } from 'react';
import ReactDOM from 'react-dom/client';

// function App() {
//   return (
//     <div>
//       <Child />
//     </div>
//   );
// }

console.log(import.meta.hot);

function App() {
  const [num, setNum] = useState(100);
  window.setNum = setNum;
  return <div>{num}</div>;
}

function APP() {}

function Child() {
  return (
    <p>
      <span>I'm a child1</span>
    </p>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
