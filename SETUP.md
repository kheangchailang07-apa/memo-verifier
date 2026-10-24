# Local setup

This checkout is configured for the supplied MySQL dump (`database/memodev.sql`). The dump is ignored by Git because it contains application data.

## Requirements

- Node.js and npm
- MySQL 8.0+

## Database

Create an empty database named `memo_verifier`, then import the dump from the repository root:

```powershell
mysql -u root -p -e "CREATE DATABASE memo_verifier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p memo_verifier < database/memodev.sql
```

The dump contains `DROP TABLE IF EXISTS` statements. Import it only into the intended database; importing over an existing database replaces its dumped tables and data.

## Configure

Edit `backend/.env1` with your MySQL credentials and unique local values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, and `API_KEY_SECRET`. Set `PASSWORD_ENCRYPTION_KEY` to the exact key used by the source system. The dump stores encrypted passwords, and a different key will prevent existing accounts from logging in. Do not commit `.env1`.

The SQL dump includes existing S3 object keys. AWS credentials and the correct bucket configuration are needed to retrieve/upload PDF and signature assets; local setup can still be used for database-backed flows without them.

## Install and run

```powershell
cd backend
npm ci
npm run dev1
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev1
```

Open http://localhost:3366. The frontend proxies API calls to http://localhost:5422.

The backend runs Sequelize `sync({ alter: true })` at startup and performs data migrations/seeding. Back up the database before pointing this development server at a valuable database.
