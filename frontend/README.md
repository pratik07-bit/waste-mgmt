# Smart Waste Management System
### Pune Municipal Corporation — Solid Waste Management Department

---

## Project Structure

```
waste-mgmt/
├── backend/
│   ├── server.js        ← Express.js REST API + SQLite
│   ├── package.json
│   └── waste.db         ← Auto-created on first run
└── frontend/
    └── index.html       ← Complete frontend (no build needed)
```

---

## Tech Stack

| Layer    | Technology           |
|----------|----------------------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend  | Node.js + Express.js  |
| Database | SQLite (via better-sqlite3) |

---

## Setup & Run

### Step 1 — Install backend dependencies
```bash
cd backend
npm install
```

### Step 2 — Start the backend server
```bash
node server.js
```
Server runs at: **http://localhost:3001**

### Step 3 — Open the frontend
Open `frontend/index.html` directly in your browser.
(No build step needed — it's plain HTML)

---

## API Endpoints

| Method | Endpoint                        | Description                  |
|--------|---------------------------------|------------------------------|
| GET    | /api/stats                      | Dashboard statistics         |
| GET    | /api/bins                       | All bins with zone info      |
| POST   | /api/bins                       | Add new bin                  |
| PUT    | /api/bins/:id/fill              | Update bin fill level        |
| DELETE | /api/bins/:id                   | Remove a bin                 |
| GET    | /api/collectors                 | All collectors               |
| POST   | /api/collectors                 | Add new collector            |
| PUT    | /api/collectors/:id/status      | Toggle active/inactive       |
| GET    | /api/complaints                 | All complaints               |
| POST   | /api/complaints                 | File a complaint             |
| PUT    | /api/complaints/:id/status      | Update complaint status      |
| GET    | /api/logs                       | Recent collection logs       |
| POST   | /api/logs                       | Log a new collection         |
| GET    | /api/schedules                  | Weekly pickup schedule       |
| GET    | /api/zones                      | All zones                    |
| GET    | /api/citizens                   | All citizens                 |
| POST   | /api/citizens                   | Register citizen             |

---

## Database Tables

- **Zone** — Geographic zones of the city
- **Bin** — Waste bins with GPS coordinates and fill levels
- **Collector** — Waste collection personnel
- **Citizen** — Registered citizens
- **Complaint** — Grievances filed by citizens
- **Collection_Log** — Record of every pickup (auto-resets bin fill to 0%)
- **Schedule** — Weekly pickup schedule per zone

---

## Features

- Real-time dashboard with critical bin alerts
- Bin management with fill level tracking
- Collector roster with status toggling
- Citizen grievance/complaint system
- Collection logging (auto-resets bin fill level)
- Weekly schedule calendar view
- Citizen registration

---

## DBMS Concepts Demonstrated

- **DDL** — CREATE TABLE with PRIMARY KEY, FOREIGN KEY, CHECK, DEFAULT
- **DML** — INSERT, UPDATE, DELETE, SELECT with JOINs
- **Triggers** — Auto-reset fill level after collection
- **Aggregation** — SUM, COUNT, GROUP BY in stats queries
- **Referential Integrity** — FK constraints across all tables
- **Normalization** — 3NF schema design
