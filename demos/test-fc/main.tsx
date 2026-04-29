import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <Child />
    </div>
  );
}

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
