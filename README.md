# Gestion des Demandes — OCP

A web-based document approval system built with Node.js and Express. Employees submit documents (PDFs) that go through a sequential approval chain before being finalized.

---

## Features

- Role-based login: Admin, Secrétaire, Responsable
- Submit documents (PDF) with a title and comment
- Select ordered approvers for each document
- Approvers approve or reject with a comment
- Secretary can view her Responsable's inbox
- Admin panel to manage users
- Password change for all roles
- Session-based authentication

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express |
| Templating | EJS + express-ejs-layouts |
| Database | MySQL |
| File Upload | Multer |
| Session | express-session |
| Styling | Bootstrap (Argon Dashboard) |

---

## Project Structure

```
├── index.js          # App entry point
├── router.js         # All routes and database logic
├── views/            # EJS templates
├── public/           # Static assets (CSS, JS, images)
├── uploads/          # Uploaded PDF files (git-ignored)
├── .env              # Environment variables (git-ignored)
├── .env.example      # Environment variables template
└── package.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org) v14 or higher
- MySQL server running locally

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=projectusers
SESSION_SECRET=any-random-string
PORT=3009
```

### 4. Set up the database

Open MySQL and run:

```sql
CREATE DATABASE IF NOT EXISTS projectusers;
USE projectusers;

CREATE TABLE users (
  idUsers       INT AUTO_INCREMENT PRIMARY KEY,
  fullname      VARCHAR(255),
  poste         VARCHAR(255),
  email         VARCHAR(255),
  password      VARCHAR(255),
  idsecretaire  INT,
  type          VARCHAR(50)
);

CREATE TABLE demande (
  iddemande     INT AUTO_INCREMENT PRIMARY KEY,
  iduser        INT,
  titre         VARCHAR(255),
  file_name     VARCHAR(255),
  file          LONGBLOB,
  date_demande  DATETIME,
  commentaire   TEXT
);

CREATE TABLE d_a (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  iddemande      INT,
  Nomapprobateur VARCHAR(255),
  ordre          INT,
  statut         INT,
  commentaire    TEXT
);
```

### 5. Seed a first admin user

```sql
USE projectusers;
INSERT INTO users (fullname, poste, email, password, type)
VALUES ('Admin', 'Administrateur', 'admin@example.com', 'admin123', 'Admin');
```

### 6. Start the server

```bash
npm start
```

Visit: [http://localhost:3009](http://localhost:3009)

---

## User Roles

| Role | Access |
|------|--------|
| `Admin` | Manage users (add / delete) |
| `Secrétaire` | Submit documents, track requests, view Responsable inbox |
| `Responsable` | Approve or reject assigned documents |

---

## Approval Flow

```
Secrétaire submits document
        │
        ▼
   Approbateur 1  ──► Approves ──► Approbateur 2  ──► ... ──► Fully Approved
        │
        └──► Rejects ──► Requester sees refusal with comment
```

- Approvers act in order — Approbateur 2 cannot act until Approbateur 1 approves
- Any rejection stops the chain
- The requester can delete refused requests and resubmit

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host (usually `localhost`) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (`projectusers`) |
| `SESSION_SECRET` | Secret key for session encryption |
| `PORT` | Port the server listens on (default `3009`) |

---

## Docker

The easiest way to run the full stack (Node.js + MySQL) with a single command.

### 1. Configure your `.env`

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=projectusers
SESSION_SECRET=any-random-string
PORT=3009
```

> `DB_HOST` stays `localhost` in `.env` — Docker Compose overrides it to `db` internally.

### 2. Build and start

```bash
docker-compose up --build
```

This will:
- Start a MySQL 8 container and auto-create all tables via `init.sql`
- Wait for MySQL to be healthy before starting the app
- Start the Node.js app on the port defined in `.env`

### 3. Open in browser

```
http://localhost:3009
```

Login with: `admin@example.com` / `admin123`

### Useful commands

```bash
# Run in background
docker-compose up --build -d

# Stop containers
docker-compose down

# Stop and delete all data (DB + uploads)
docker-compose down -v

# View logs
docker-compose logs -f app
```

---

## License

ISC
