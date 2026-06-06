import './style.css';
import { unstable_ImmediatePriority as ImmediatePriority } from 'scheduler';
import { unstable_UserBlockingPriority as UserBlockingPriority } from 'scheduler';
import { unstable_NormalPriority as NormalPriority } from 'scheduler';
import { unstable_LowPriority as LowPriority } from 'scheduler';
import { unstable_IdlePriority as IdlePriority } from 'scheduler';
import { unstable_scheduleCallback as scheduleCallback } from 'scheduler';
import { unstable_shouldYield as shouldYield } from 'scheduler';
import { CallbackNode } from 'scheduler';
import { unstable_cancelCallback as cancelCallback } from 'scheduler';
import { unstable_getFirstCallbackNode as getFirstCallbackNode } from 'scheduler';

const root = document.querySelector('#root');

type Priority =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;

interface Work {
  count: number;
  priority: Priority;
}

const workList: Work[] = [];

let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

// 1 交互触发更新
// 2 调度阶段微任务调度 (ensureRootisScheduled方法）

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
  (priority) => {
    const btn = document.createElement('button');
    root?.appendChild(btn);

    btn.innerText = [
      '',
      'ImmediatePriority',
      'UserBlockingPriority',
      'NormalPriority',
      'LowPriority'
    ][priority];

    btn.onclick = () => {
      workList.unshift({
        count: 100,
        priority: priority as Priority
      });
      schedule();
    };
  }
);

// 2 调度阶段微任务调度 (ensureRootisScheduled方法）
function schedule() {
  const cbNode = getFirstCallbackNode();
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

  // 策略逻辑
  if (!curWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }

  const { priority: curPriority } = curWork || {};

  if (curPriority === prevPriority) {
    return;
  }

  // 更高优先级的work
  cbNode && cancelCallback(cbNode);

  curCallback = scheduleCallback(curPriority, performWork.bind(null, curWork));
}

// 3 微任务调度结束，进入render阶段
function performWork(work: Work, didTimeout?: boolean) {
  /*
   * 1. work.priority
   * 2．饥饿问题
   * 3．时间切片
   */
  const needSync = work.priority === ImmediatePriority || didTimeout;

  while ((needSync || !shouldYield()) && work.count) {
    // 4 render阶段结束，进入commit阶段
    work.count--;
    insertSpan(work.priority + '');
  }

  // 中断执行 || 执行完
  prevPriority = work.priority;

  // 当前work执行完，从workList中删除
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    prevPriority = IdlePriority;
  }

  const prevCallback = curCallback;
  schedule();
  const newCallback = curCallback;

  if (newCallback && prevCallback === newCallback) {
    return performWork.bind(null, work);
  }
}

function insertSpan(text: string) {
  const span = document.createElement('span');
  span.textContent = text;
  span.className = `pri-${text}`;
  doSomeBuzyWork(1000000);
  root?.appendChild(span);
}

function doSomeBuzyWork(len: number) {
  let result = 0;
  while (len--) {
    result += len;
  }
  return result;
}
