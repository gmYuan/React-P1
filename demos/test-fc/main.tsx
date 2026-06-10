import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

export default function App() {
  const [num, updateNum] = useState(100);

  return (
    <ul onClick={() => updateNum(50)}>
      {new Array(num).fill(0).map((_, i) => {
        return <Child key={i}> {i} </Child>;
      })}
    </ul>
  );
}

function Child({ children }) {
  const now = performance.now();
  while (performance.now() - now < 4) {}
  return <li>{children}</li>;
}

const root = ReactDOM.createRoot(document.querySelector('#root'));

root.render(<App />);
