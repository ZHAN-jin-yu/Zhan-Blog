class LazyMan {
  constructor(name) {
    this.tasks = [];
    this.name = name;
    this.sayHi();
    Promise.resolve().then(() => this.run());
  }
  _execu(fn, delay = 0, isUnshift = false) {
    const promise = async () => {
      delay ? await new Promise((resolve) => setTimeout(resolve, delay * 1000)) : null;
      await fn();
    };
    this.tasks[isUnshift ? 'unshift' : 'push'](promise);
    return this;
  }
  sayHi() {
    const fn = () => {
      console.log(`Hi I'm ${this.name}`);
    };
    return this._execu(fn);
  }
  eat(food) {
    const fn = function () {
      console.log(`Im eating ${food}`);
    };
    return this._execu(fn);
  }
  sleep(time) {
    const fn = function () {
      console.log(`wait ${time} second`);
    };
    return this._execu(fn, time);
  }
  sleepFirst(time) {
    const fn = function () {
      console.log(`wait ${time} second`);
    };
    return this._execu(fn, time, true);
  }
  run() {
    if (this.tasks.length) {
      const task = this.tasks.shift();
      task().then(() => this.run());
    }
  }
}

new LazyMan('Hank')
  .sleep(1)
  .eat('dinner')
  .sleepFirst(2)
  .eat('supper')
  .sleep(3)
  .eat('breakfast')
  .sleepFirst(4);
