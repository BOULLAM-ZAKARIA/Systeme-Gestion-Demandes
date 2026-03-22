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

## Running with Docker

Docker is the recommended way to run this project — no need to install MySQL or configure anything manually. One command starts everything.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Docker Desktop must be **running** (look for the whale icon in your taskbar)

> On Windows: open Docker Desktop from the Start menu and wait until it says **"Engine running"** before continuing.

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

---

### Step 2 — Create your `.env` file

Copy the example file:

```bash
# On Windows (PowerShell)
copy .env.example .env

# On Mac/Linux
cp .env.example .env
```

Edit `.env` with your values:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=projectusers
SESSION_SECRET=any-random-secret-string
PORT=3009
```

> **Note:** Keep `DB_HOST=localhost` in your `.env` — Docker Compose automatically overrides it to `db` (the internal MySQL service name) inside the containers.

---

### Step 3 — Build and start

Open a terminal in the project folder and run:

```bash
docker-compose up --build
```

**What happens:**

```
Step 1 → Docker builds the Node.js app image
Step 2 → MySQL container starts and runs init.sql (creates tables + admin user)
Step 3 → App waits for MySQL to be healthy
Step 4 → App starts and connects to MySQL
Step 5 → Server is ready at http://localhost:3009
```

You should see these lines in the terminal when everything is ready:

```
ocp_mysql  | ready for connections
ocp_app    | connected successfully!
ocp_app    | App is listening on url http://localhost:3009
```

---

### Step 4 — Open in browser

```
http://localhost:3009
```

Login with the default admin account:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `admin123` |

---

### Useful Docker commands

```bash
# Start in background (detached mode)
docker-compose up --build -d

# View live logs
docker-compose logs -f

# View logs for the app only
docker-compose logs -f app

# Stop containers (keeps data)
docker-compose down

# Stop and delete all data (database + uploads)
docker-compose down -v

# Restart after code changes
docker-compose up --build

# Check running containers
docker ps
```

---

### Troubleshooting

**Docker Desktop not running**
```
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```
→ Open Docker Desktop and wait for it to fully start, then retry.

**Port 3009 already in use**
```
Bind for 0.0.0.0:3009 failed: port is already allocated
```
→ Change `PORT=3009` to another port (e.g. `3010`) in your `.env`, then run `docker-compose up --build` again.

**Module not found errors**
```
Error: Cannot find module 'some-package'
```
→ Run `docker-compose up --build` (the `--build` flag forces a fresh install of dependencies).

**MySQL connection refused on first start**
→ The app waits for MySQL to be healthy before starting. If it fails, just run `docker-compose up` again (without `--build`) — MySQL data is already initialized.

---

## License

ISC
