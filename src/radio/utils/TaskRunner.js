/* @flow */

type Task = (done: () => void) => any;

export default class TaskRunner {
  taskQueue: Task[] = [];
  isRunning: boolean = false;

  queueTask(task: Task) {
    this.taskQueue.push(task);
    if (!this.isRunning) {
      this.doTask();
    }
  }

  doTask = () => {
    const task = this.taskQueue.shift();
    this.isRunning = !!task;
    if (task) {
      const result = task(this.doTask);
      if (result && typeof result.then === 'function') {
        result.then(this.doTask, this.doTask);
      }
    }
  };
}
