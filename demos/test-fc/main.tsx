import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
  const [num, updateNum] = useState(0);
  useEffect(() => {
    console.log('App mount挂载了');
  }, []);

  useEffect(() => {
    console.log('num change create创建了', num);
    return () => {
      console.log('num change destroy销毁了', num);
    };
  }, [num]);

  return (
    <div onClick={() => updateNum(num + 1)}>
      {num === 0 ? <Child /> : 'noop'}
    </div>
  );
}

function Child() {
  useEffect(() => {
    console.log('Child mount挂载了');
    return () => {
      console.log('Child unmount销毁了');
    };
  }, []);
  return 'I am child';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
