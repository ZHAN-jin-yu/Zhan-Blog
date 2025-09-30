class myLazyMan {
  constructor(name) {
    this.name = name;
    this.tasks = [];
    this.say();
    Promise.resolve().then(() => this.run());
  }
  _enqueue(fn, delay = 0, unshift = false) {
    this.tasks[unshift ? 'unshift' : 'push'](async () => {
      delay ? await new Promise((resolve) => setTimeout(resolve, delay)) : null;
      await fn();
    });
    return this;
  }
  say() {
    return this._enqueue(() => {
      console.log(`Hi, I am ${this.name}`);
    });
  }
  eat(food) {
    return this._enqueue(() => {
      console.log(`I am eating ${food}`);
    });
  }
  sleep(time) {
    return this._enqueue(() => {
      console.log(`wait ${time} seconds`);
    }, time);
  }
  sleepFirst(time) {
    return this._enqueue(
      () => {
        console.log(`wait ${time} seconds`);
      },
      time,
      true
    );
  }
  async run() {
    if (this.tasks.length) {
      const task = this.tasks.shift();
      task().then(() => {
        this.run();
      });
    }
  }
}

new myLazyMan('Hank').sleep(1000).eat('dinner').sleepFirst(2000).eat('supper');
