import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
  const [num, updateNum] = useState(0);
  const [name, updateName] = useState('nameA');

  useEffect(function AppEft1() {
    console.log('App mount挂载了');
  }, []);

  useEffect(
    function AppEft2WithUpdateName() {
      console.log('num change create创建了', num);
      // 在 effect 里触发新更新
      if (num >= 1) {
        updateName('nameB');
        updateName('nameC');
        console.log('dd', name);
      }

      return function AppEft2Destroy() {
        console.log('num change destroy销毁了', num);
      };
    },
    [num]
  );

  return (
    <div
      onClick={function updateNumByThree() {
        updateNum((v) => v + 1);
        updateNum((v) => v + 20);
        updateNum((v) => v + 30);
      }}
    >
      {num === 0 ? <Child /> : 'noop'}
    </div>
  );
}

function Child() {
  useEffect(
    function ChildEft1() {
      console.log('Child mount1挂载了');

      return function ChildEft1Destroy() {
        console.log('Child unmount1销毁了');
      };
    },
    ['ChildEft1']
  );

  useEffect(
    function ChildEft2() {
      console.log('Child mount2挂载了');
      return function ChildEft2Destroy() {
        console.log('Child unmount2销毁了');
      };
    },
    ['ChildEft2']
  );

  return 'I am child';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
