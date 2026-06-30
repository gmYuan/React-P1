import { useState, useTransition } from 'react';
import ReactDOM from 'react-dom';
import './style.css';

type Tab = 'home' | 'blog' | 'contact';

const TAB_LIST: { key: Tab; label: string }[] = [
  { key: 'home', label: '首页' },
  { key: 'blog', label: '博客 (render慢)' },
  { key: 'contact', label: '联系我' }
];

console.log('[main3] useTransition tab demo loaded');

export default function App() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>('home');

  function selectTab(nextTab: Tab) {
    console.log('[demo] selectTab', { from: tab, to: nextTab, isPending });
    startTransition(() => {
      console.log('[demo] startTransition callback -> setTab', nextTab);
      setTab(nextTab);
    });
  }

  return (
    <div className="transition-demo">
      <nav className="transition-demo__tabs">
        {TAB_LIST.map(({ key, label }) => (
          <TabButton
            key={key}
            active={tab === key}
            pending={isPending && tab !== key}
            onClick={() => selectTab(key)}
          >
            {label}
          </TabButton>
        ))}
      </nav>

      <hr className="transition-demo__divider" />

      <div className="transition-demo__status">
        当前 tab: <strong>{tab}</strong>
        {isPending ? ' | isPending: true（transition 进行中）' : ''}
      </div>

      <section className="transition-demo__panel">
        {tab === 'home' && <HomePanel />}
        {tab === 'blog' && <BlogPanel />}
        {tab === 'contact' && <ContactPanel />}
      </section>
    </div>
  );
}

function TabButton({
  active,
  pending,
  onClick,
  children
}: {
  active: boolean;
  pending?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={[
        'transition-demo__tab',
        active ? 'transition-demo__tab--active' : '',
        pending ? 'transition-demo__tab--pending' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function HomePanel() {
  return <p className="transition-demo__text">我是卡颂，这是我的个人页</p>;
}

function ContactPanel() {
  return <p className="transition-demo__text">联系我：example@react.dev</p>;
}

/** 博客页：大量节点 + 人为耗时，方便观察 transition 低优先级渲染 */
function BlogPanel() {
  const POST_COUNT = 280;

  console.log('[BlogPanel] render start', performance.now().toFixed(1));

  return (
    <div className="transition-demo__blog">
      <p className="transition-demo__text">
        博客列表（{POST_COUNT} 篇，每篇 render 约 5ms，整体较慢）
      </p>
      <ul className="transition-demo__blog-list">
        {new Array(POST_COUNT).fill(0).map((_, index) => (
          <SlowPost key={index} index={index} />
        ))}
      </ul>
    </div>
  );
}

function SlowPost({ index }: { index: number }) {
  const start = performance.now();
  while (performance.now() - start < 5) {}

  return (
    <li className="transition-demo__blog-item">
      博客文章 #{index + 1}：React useTransition 调试示例
    </li>
  );
}

const root = ReactDOM.createRoot(
  document.querySelector('#root') as HTMLElement
);

root.render(<App />);
