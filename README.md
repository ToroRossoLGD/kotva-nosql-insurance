# Kotva — NoSQL Insurance Management System

Kotva is a full-stack insurance management application built as a portfolio and
educational project. It demonstrates how ArangoDB can be used as a multi-model
NoSQL database for documents, relationships, search, indexing, and business
analytics.

The application manages clients, insurance policies, and insurance companies.
Its responsive dashboard visualizes the stored data through interactive charts
that update automatically when new records are added.

## Features

- Create clients with personal and insurance information
- Add new insurance companies dynamically
- Store policy sale dates and insurance categories
- Display recently added clients in a responsive table
- Search names regardless of letter case and diacritics
- Automatically update statistics and charts after data entry
- Analyze travel-policy sales by month and by day in July
- Compare average client age across insurance types
- Display the market share of every insurance company
- Automatically include newly added companies in the market-share chart
- Model relationships using ArangoDB named graphs and edge collections
- Validate incoming data through the REST API
- Persist database data in a Docker volume

## Technology Stack

- **Backend:** Node.js and Express
- **Database:** ArangoDB 3.12
- **Query language:** AQL
- **Frontend:** HTML, CSS, and JavaScript
- **Charts:** Chart.js
- **Infrastructure:** Docker and Docker Compose

## Architecture

The application consists of three layers:

```text
Browser frontend → Express REST API → ArangoDB
```

ArangoDB is used for several NoSQL concepts in the same project:

- document collections for clients, policies, and insurance companies;
- edge collections and a named graph for relationships;
- persistent indexes for filtering and sorting;
- an inverted index, analyzer, and SearchAlias view for name search;
- AQL queries for aggregation and analytics.

## Data Model

Document collections:

- `clients`
- `policies`
- `insurers`

Edge collections:

- `owns`
- `issued_by`

Graph structure:

```text
clients --owns--> policies --issued_by--> insurers
```

This model can support multiple policies per client while keeping the issuing
company connected through explicit graph relationships.

## Analytics Dashboard

The dashboard includes:

- total number of clients;
- average client age;
- the insurance company with the most clients;
- the strongest month for travel-policy sales;
- travel insurance share;
- monthly travel-policy sales;
- insurance company market share with percentages;
- average age by insurance type;
- insurance type distribution;
- daily travel-policy sales during July;
- the relationship between age groups and the number of policies.

All charts are generated from current API data rather than hard-coded frontend
values.

## Running the Project

### Requirements

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Clone the repository and start both services:

```powershell
git clone https://github.com/ToroRossoLGD/kotva-nosql-insurance.git
cd kotva-nosql-insurance
docker compose up --build -d
```

Open the services in a browser:

- Application: http://localhost:3001
- ArangoDB web interface: http://localhost:8529

Local demonstration credentials:

```text
Username: root
Password: kotva123
Database: kotva
```

The database, collections, indexes, named graph, analyzer, and demonstration
records are created automatically during the first startup. Changes are stored
in a Docker volume and remain available after the containers stop.

Check the service status or view logs:

```powershell
docker compose ps
docker compose logs -f
```

Stop the application without deleting its data:

```powershell
docker compose down
```

Reset the database and recreate the initial demonstration data:

```powershell
docker compose down -v
docker compose up --build -d
```

> `docker compose down -v` permanently removes the local Docker database volume.

If port `3001` is already in use, select another port in PowerShell:

```powershell
$env:APP_PORT=3002
docker compose up --build -d
```

The application will then be available at http://localhost:3002.

## Configuration

To use a different local database password, copy `.env.example` to `.env` and
change `ARANGO_PASSWORD`. The `.env` file is intentionally excluded from Git.

The credentials committed to this repository are intended only for a local
demonstration environment. A production deployment should use securely managed
secrets and must not expose the database directly.

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Return the application and database status |
| GET | `/api/config` | Return the supported insurance types |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create a client and synchronize graph data |
| GET | `/api/insurers` | List insurance companies |
| POST | `/api/insurers` | Create an insurance company |
| GET | `/api/search?q=query` | Search clients by name |
| GET | `/api/analytics` | Return the dashboard analytics data |

## NoSQL Concepts Demonstrated

- Flexible JSON document model
- Denormalization
- Persistent and inverted indexes
- Text normalization with an ArangoDB analyzer
- SearchAlias views
- AQL filtering, sorting, grouping, and aggregation
- Named graphs and graph traversal
- Docker-based data persistence
- Horizontal scaling concepts such as sharding and replication
- Read/write and memory trade-offs introduced by indexes

## Documentation

A detailed project report is included in
[`DOKUMENTACIJA_KOTVA.pdf`](./DOKUMENTACIJA_KOTVA.pdf). The report is currently
written in Serbian and covers the implementation, AQL examples, indexes, graph
traversal, complexity analysis, scaling, security considerations, and a project
presentation plan.

## Project Scope

This is a portfolio and educational project. Before production use, the system
would require application-level authentication and authorization, TLS, managed
secrets, rate limiting, automated tests, monitoring, regular backups, and a
stricter database access policy.
