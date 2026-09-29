'use strict';

const assert = require('assert');
const { createServer } = require('./server');

let savedTasks;
const collection = {
  async findOne() {
    return savedTasks ? { tasks: savedTasks } : null;
  },
  async updateOne(_filter, update) {
    savedTasks = update.$set.tasks;
  },
};

const server = createServer(collection);
server.listen(0, async () => {
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const put = body => fetch(base + '/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    assert.deepStrictEqual(await (await fetch(base + '/api/tasks')).json(), []);
    const saved = await (await put([{ title: ' Ship it ', priority: 'high', tags: ['a'] }, { title: '' }])).json();
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].title, 'Ship it');
    assert.deepStrictEqual(await (await fetch(base + '/api/tasks')).json(), saved);
    assert.strictEqual((await put({ bad: 1 })).status, 400);
    assert.strictEqual((await fetch(base + '/')).status, 200);
    assert.strictEqual((await fetch(base + '/..%2fserver.js')).status, 403);
    console.log('All tests passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
