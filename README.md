# Deborah's Day

A personal planning page with a Node.js API and MongoDB task storage. Requires Node.js 18 or newer.

## Run locally

1. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB Atlas connection string. `.env` is ignored by Git.
2. Install the dependencies with `npm install`.
3. Start the app with `npm start` and open <http://localhost:3000>.

Tasks are stored in the `deborah_todo.task_lists` collection as one list document. The database name can be changed with `MONGODB_DB`; `PORT` defaults to `3000`.

## API

- `GET /api/tasks` returns Deborah's task list.
- `PUT /api/tasks` validates and replaces the task list.
- `GET /healthz` checks that the web server is running.

This is a single-user personal app and the API has no login. Keep it local or put authentication in front of it before making it public.

## Docker

Build with `docker build -t deborah-day .`, then pass `MONGODB_URI` and optionally `MONGODB_DB` to the container at runtime. Do not bake database credentials into the image.
