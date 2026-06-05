import './style.css';

const button = document.querySelector('button');
const root = document.querySelector('#root');

interface Work {
  count: number;
}

const workList: Work[] = [];

// 2 调度阶段微任务调度 (ensureRootisScheduled方法）
function schedule() {
  const curWork = workList.pop();
  if (curWork) {
    performWork(curWork);
  }
}

// 3 微任务调度结束，进入render阶段
function performWork(work: Work) {
  while (work.count) {
    // 4 render阶段结束，进入commit阶段
    work.count--;
    insertSpan('0');
  }
  // 5 commit阶段结束，调度阶段微任务调度(ensureRootisScheduled方法）
  schedule();
}

function insertSpan(text: string) {
  const span = document.createElement('span');
  span.textContent = text;
  root?.appendChild(span);
}

// 1 交互触发更新
// 2 调度阶段微任务调度 (ensureRootisScheduled方法）
button &&
  (button.onclick = () => {
    workList.unshift({
      count: 100
    });

    schedule();
  });
