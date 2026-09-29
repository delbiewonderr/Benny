'use strict';

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'deborah_todo';
const PUBLIC = path.join(__dirname, 'public');
const MAX_BODY = 1024 * 1024;
const LIST_ID = 'deborah';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI. Add your MongoDB connection string to .env.');
  process.exit(1);
}

function clean(task) {
  if (!task || typeof task.title !== 'string' || !task.title.trim()) return null;
  return {
    id: String(task.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, 40),
    title: task.title.trim().slice(0, 300),
    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
    date: typeof task.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.date) ? task.date : '',
    time: typeof task.time === 'string' && /^\d{2}:\d{2}$/.test(task.time) ? task.time : '',
    tags: Array.isArray(task.tags) ? task.tags.map(tag => String(tag).slice(0, 40)).slice(0, 20) : [],
    done: !!task.done,
  };
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size <= MAX_BODY) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function createServer(tasksCollection) {
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return json(res, 400, { error: 'Invalid request URL' });
    }

    if (url.pathname === '/healthz') return json(res, 200, { ok: true });

    if (url.pathname === '/api/tasks') {
      if (req.method === 'GET') {
        try {
          const list = await tasksCollection.findOne({ _id: LIST_ID }, { projection: { _id: 0, tasks: 1 } });
          return json(res, 200, list ? list.tasks : []);
        } catch (error) {
          console.error('Could not read tasks from MongoDB:', error.message);
          return json(res, 503, { error: 'Could not load tasks from the database' });
        }
      }

      if (req.method === 'PUT') {
        try {
          const text = await readBody(req);
          const body = JSON.parse(text || '[]');
          if (!Array.isArray(body)) return json(res, 400, { error: 'Body must be an array of tasks' });
          const tasks = body.map(clean).filter(Boolean);
          await tasksCollection.updateOne(
            { _id: LIST_ID },
            { $set: { tasks, updatedAt: new Date() } },
            { upsert: true },
          );
          return json(res, 200, tasks);
        } catch (error) {
          const status = error.status || (error instanceof SyntaxError ? 400 : 503);
          if (status >= 500) console.error('Could not save tasks to MongoDB:', error.message);
          return json(res, status, { error: status === 503 ? 'Could not save tasks to the database' : error.message });
        }
      }

      res.setHeader('Allow', 'GET, PUT');
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    let relative;
    try {
      relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    } catch {
      return json(res, 400, { error: 'Invalid path' });
    }
    const file = path.resolve(PUBLIC, relative);
    if (!file.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: 'Forbidden' });
    fs.readFile(file, (error, data) => {
      if (error) return json(res, 404, { error: 'Not found' });
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  });
}

async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);
  const server = createServer(db.collection('task_lists'));
  server.listen(PORT, () => console.log(`Deborah's to-do app running at http://localhost:${PORT}`));
  const shutdown = async () => {
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch(error => {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  });
}

module.exports = { clean, createServer };
