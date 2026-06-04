import { useState, useEffect } from 'react';
import ReactDOM from 'react-noop-renderer';

export default function App() {
  return (
    <>
      <Child />
      <div>Hello World</div>
    </>
  );
}

function Child() {
  return 'I am child';
}

const root = ReactDOM.createRoot();

root.render(<App />);

window.root = root;
