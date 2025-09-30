function* asyncPool(limit, iterable, fn) {
  const executming = new Set();
  async function comsume() {
    const [promise, value] = await Promise.race(executming);
    executming.delete(promise);
    return value;
  }
  for (let item of iterable) {
    const promise = (async () => await fn(item))().then((value) => [promise, value]);
    executming.add(promise);
    if (executming.size >= limit) yield comsume();
  }
  while (executming.size) {
    yield comsume();
  }
}

const timeout = (res) => res;

for await (let ms of asyncPool(2, [1000, 5000, 6000, 2000, 3000], timeout)) {
  console.log(ms);
}
