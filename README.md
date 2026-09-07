# Kotva — NoSQL Insurance Management System

[![CI](https://github.com/ToroRossoLGD/kotva-nosql-insurance/actions/workflows/ci.yml/badge.svg)](https://github.com/ToroRossoLGD/kotva-nosql-insurance/actions/workflows/ci.yml)

Kotva is a full-stack insurance management application built as a portfolio and
functioning project. It demonstrates how ArangoDB can be used as a multi-model
NoSQL database for documents, relationships, search, indexing, and business
analytics.

The application manages clients, insurance policies, and insurance companies.
Its responsive dashboard visualizes the stored data through interactive charts
that update automatically when new records are added.

## Features

- Create clients with personal and insurance information
- Add new insurance companies dynamically
- Store policy sale dates and insurance categories
- Require JMBG, passport number, and destination for every new travel-insurance client
- Capture vehicle make, engine capacity, vehicle category, and passenger-car body type for auto insurance
- Track extensible broker approval metadata for vehicle insurance
- Register and process policy-linked claims with role-based status changes and audit history
- Record premium payments, prevent duplicate references and overpayments, and update policy balances automatically
- Surface user-specific reminders for expiring policies, premium debt, and aging claims
- Generate a professional, tenant-protected PDF policy from the latest policy data
- Run tenant-scoped ETL jobs with filters, quality checks, metrics, and execution history
- Export anonymized policy, payment, claim, quality, and analysis-ready CSV datasets
- Track currency-safe insurance KPIs for premium collection, claims, losses, growth, and cancellations
- Monitor completeness, validity, uniqueness, referential integrity, freshness, and ETL quality trends
- Explore a reproducible pandas/seaborn Jupyter case study with committed charts and business recommendations
- Upload and securely download tenant-protected PDF and image policy documents
- Review an administrator-only, append-only audit trail of every business mutation
- Monitor request volume, latency, errors, memory, readiness, and graceful shutdown behavior
- Export a tenant-specific Excel market-share report for travel, auto, property, and DZO insurance
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
- Sign in securely with role-based permissions for administrators, agents, and analysts
- Record successful and failed login attempts for administrator review
- Isolate every client, insurer, policy, graph edge, audit record, and analytic by company tenant

## Technology Stack

- **Backend:** Node.js and Express
- **Database:** ArangoDB 3.12
- **Query language:** AQL
- **Frontend:** HTML, CSS, and JavaScript
- **Charts:** Chart.js
- **Portfolio analysis:** Python, pandas, seaborn, matplotlib, and Jupyter
- **Infrastructure:** Docker and Docker Compose

## Continuous Integration

GitHub Actions runs the CI pipeline for every pull request targeting `main`,
for every push to `main`, and when started manually. The pipeline installs the
exact dependency versions from `package-lock.json`, checks JavaScript syntax,
runs the automated Node.js test suite, and validates the Docker Compose file.

The project intentionally does not use Ruff, ESLint, Prettier enforcement, or a
maximum-line-length rule. CI evaluates correctness and deployability without
rejecting the existing compact source-code style.

The separate `Playwright E2E` job runs eleven serial Chromium workflows against
an isolated in-memory application server. It covers authentication, role-based
UI permissions, standard/travel/vehicle policy creation, broker confirmation,
claim processing, payments, policy PDF download, ETL/CSV workflows, insurance KPIs, and the Data Quality dashboard. Failed runs retain an
HTML report, screenshots, video, and a Playwright trace as a CI artifact.

Run the browser suite locally with:

```bash
npx playwright install chromium
npm run test:e2e
```

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
- `users`
- `login_attempts`
- `tenants`
- `claims`
- `payments`
- `notification_dismissals`
- `policy_documents`
- `business_audit`
- `etl_runs`

Edge collections:

- `owns`
- `issued_by`
- `has_claim`
- `has_payment`
- `has_document`

Graph structure:

```text
clients --owns--> policies --issued_by--> insurers
                         \
                          --has_claim--> claims
                         \
                          --has_payment--> payments
                         \
                          --has_document--> policy_documents
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
Application administrator: admin / Admin123!
Insurance agent:          agent / Agent123!
Read-only analyst:        analyst / Analyst123!
Second-company admin:     adria-admin / Adria123!

ArangoDB web interface:   root / kotva123
Database:                 kotva
```

Administrators can manage clients and insurance companies and review the login
audit. Agents can view data and create clients. Analysts have read-only access
to clients, search, and analytics.

The Kotva accounts belong to the `Kotva Insurance` tenant, while `adria-admin`
belongs to the independent `Adria Brokers` tenant. The tenant identity comes
from the signed session token. API clients cannot select or override it through
request parameters, preventing accidental cross-company access.

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
The JWT signing secret and demo account passwords can also be overridden through
the variables shown in `.env.example`.

The credentials committed to this repository are intended only for a local
demonstration environment. A production deployment should use securely managed
secrets and must not expose the database directly.

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Return the application and database status |
| GET | `/api/health/live` | Confirm that the Node.js process is alive |
| GET | `/api/health/ready` | Confirm that the application and required database are ready |
| POST | `/api/auth/login` | Sign in and create an HttpOnly session cookie |
| POST | `/api/auth/logout` | Clear the current session |
| GET | `/api/auth/me` | Return the signed-in user |
| GET | `/api/auth/login-attempts` | Return the login audit for administrators |
| GET | `/api/config` | Return the supported insurance types |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create a client and synchronize graph data |
| GET | `/api/clients/:id/policy.pdf` | Generate and download the latest tenant-protected policy PDF |
| PATCH | `/api/clients/:id/policy` | Change policy/payment status and append an audit-history entry |
| POST | `/api/clients/:id/broker-approval` | Confirm auto-insurance vehicle details as an agent or administrator |
| GET | `/api/claims` | List the current tenant's claims |
| POST | `/api/claims` | Register a claim against an existing in-force policy |
| PATCH | `/api/claims/:id/status` | Update claim status and append an audit-history entry |
| GET | `/api/payments` | List the current tenant's premium payments |
| POST | `/api/payments` | Record a policy payment and update its balance/status |
| GET | `/api/notifications` | Generate the current user's operational notification feed |
| POST | `/api/notifications/:key/dismiss` | Mark one generated notification as read for the current user |
| GET | `/api/documents` | List document metadata for the current tenant |
| POST | `/api/clients/:id/documents` | Upload one PDF, JPG, or PNG document to a policy |
| GET | `/api/documents/:id/download` | Download a document through tenant-protected access |
| GET | `/api/audit` | Return filterable tenant business events for administrators |
| GET | `/api/metrics` | Return administrator-only runtime request and process metrics |
| GET | `/api/insurers` | List insurance companies |
| POST | `/api/insurers` | Create an insurance company |
| GET | `/api/search?q=query` | Search clients by name |
| GET | `/api/analytics` | Return the dashboard analytics data |
| GET | `/api/analytics/kpis` | Return currency-separated insurance and financial KPIs |
| GET | `/api/analytics/data-quality` | Return current quality scores, issues, thresholds, and ETL trend |
| GET | `/api/exports/insurance-market-share.xlsx` | Download the current tenant's Excel market-share report |
| GET | `/api/etl/runs` | List the tenant's latest ETL executions for analysts and administrators |
| POST | `/api/etl/runs` | Run the filtered extraction, transformation, and quality-check pipeline |
| GET | `/api/etl/exports/:dataset` | Export one of five analysis-ready CSV datasets |

## Data Analytics and ETL Studio

Analysts and administrators have a dedicated ETL workspace with date, insurance
type, insurer, and policy-status filters. Every run extracts tenant data from
policy, payment, and claim collections; validates data quality; transforms the
operational records into a denormalized analytical model; records execution
metrics; and writes an auditable ETL run to `etl_runs`.

The downloadable datasets are `policies.csv`, `payments.csv`, `claims.csv`,
`analytics-dataset.csv`, and `etl-quality-report.csv`. The combined analytical
dataset derives age bands, year, month, quarter, policy duration, paid and
remaining premium, claim counts, open-claim counts, and total estimated claim
value. UTF-8 BOM output works cleanly in Excel, while CSV formula-injection
protection makes exported values safer to open in spreadsheet applications.

Direct identifiers and free-text fields are excluded from analytical exports.
Each customer receives a stable tenant-specific HMAC pseudonym such as
`CUST-7A19...`, allowing records to be joined across datasets without exporting
names, JMBG values, passport numbers, or claim descriptions. ETL access is
restricted to `analyst` and `admin`; every query and export remains tenant
isolated.

## Insurance KPI Dashboard

The analytics area exposes insurance-specific business measures rather than
only record counts. For each currency it calculates written, collected, and
outstanding premium; collection rate; average premium; claim exposure;
estimated loss ratio; claim frequency and severity; cancellation rate; and
month-over-month/year-over-year written-premium growth when a valid comparison
period exists. Monthly premium trends and insurer-level collection/loss ratios
are visualized with interactive charts.

RSD and EUR are never added together. The selected currency controls every
financial card and chart, preventing the misleading totals common in portfolio
dashboards without exchange-rate data. The UI and API explicitly document that
the available loss ratio is based on estimated claim value divided by written
premium; it is an analytical proxy, not an accounting incurred-loss ratio.

## Data Quality Dashboard

Analysts and administrators can monitor five calculated data-quality dimensions:
completeness, validity, uniqueness, referential integrity, and freshness. Each
dimension exposes its current value, explicit acceptance threshold, and
pass/warning/fail status. The dashboard also shows an overall score, source
record counts, the most recent eligible business date, orphan count, issue
distribution, and a detailed table of validation findings.

Every ETL execution stores a compact quality snapshot alongside its execution
metrics. Those immutable snapshots drive a historical score chart, turning the
ETL log into a basic data-observability layer rather than showing only the
current state. Quality calculations and history remain restricted to analysts
and administrators and isolated by tenant.

## Jupyter Portfolio Case Study

The executed [Kotva portfolio analysis](analytics/kotva_portfolio_analysis.ipynb)
turns the anonymized ETL output into a recruiter-friendly analytical case study.
It validates schema and privacy constraints, calculates executive KPIs, explores
monthly and year-over-year trends, benchmarks insurers, segments products and
age groups, examines premium/age relationships, identifies payment risk, and
finishes with evidence-backed business recommendations and explicit
limitations.

An anonymized sample dataset makes the notebook reproducible immediately, while
the `KOTVA_DATASET` environment variable can point it at any fresh ETL export.
All charts and outputs are committed for GitHub viewing. A separate GitHub
Actions workflow installs the pinned analytics environment, executes every cell,
rejects notebook errors or direct personal-data columns, and verifies that the
expected visual outputs were rendered.

## Excel Market-Share Export

The dashboard can generate an `.xlsx` workbook from current database records.
Insurance companies are listed vertically, while `Putno`, `Auto`, `Privatna
svojina`, and `DZO` are shown as columns. Each percentage represents the
company's share of all policies sold in that category, making category leaders
immediately visible. DZO is supported as an insurance type even when its current
sales count is zero.

The workbook includes a formatted percentage report with formula-backed totals
and a separate source-count sheet for auditing the calculations. Exported data
is automatically restricted to the signed-in user's tenant.

## Advanced Policy Model

Every newly created client is linked to a complete policy record containing a
generated tenant-scoped policy number, validity period, premium and currency,
policy status, payment method and status, insured subject, selling-agent
metadata, document references, and an append-only change history. Policy and
payment status changes record the authenticated operator, timestamp, previous
values, and new values. Auto-policy broker confirmation is recorded in the same
history.

Existing demo and database records are upgraded automatically at startup with
safe legacy values. Attached-document metadata is stored in ArangoDB; production
binary files can later be placed in object storage while retaining their secure
reference in the policy document.

## Claims Management

Agents and administrators can register a claim against an existing policy. The
API verifies tenant ownership, rejects future incident dates, and requires the
incident to fall inside the policy's validity period. Each claim receives a
generated claim number and stores the policy, customer, insurer, incident,
estimated loss, currency, reporter, and current processing status.

The workflow supports `Prijavljena`, `U obradi`, `Odobrena`, `Odbijena`, and
`Isplaćena` states. Every state change is appended to the claim history with the
previous state, authenticated operator, and timestamp. In ArangoDB, claims are
connected to policy vertices through the `has_claim` edge collection, enabling
policy-to-claim graph traversals. Analysts retain read-only access.

## Premium Payments

Agents and administrators can record partial or full premium payments against a
policy. Each payment receives a receipt number and stores its date, amount,
policy currency, payment method, optional external reference, authenticated
operator, and timestamp. References are unique inside a tenant to prevent the
same bank or card transaction from being imported twice.

The API calculates the already-paid amount, rejects overpayments, and updates
the policy status to `Delimično plaćeno` or `Plaćeno`. Every accepted payment is
also appended to the policy audit history. ArangoDB connects policy and payment
documents through `has_payment`, while compound indexes support tenant-safe
receipt, date, and reference lookups. Analysts have read-only access.

## Notification Center

The dashboard generates actionable reminders directly from current policy,
payment, and claim data. It highlights expired policies, policies expiring in
the next 30 days, unpaid or partially paid premiums, and claims left open for
seven days or longer. Severity and due date determine display order.

Notifications are tenant-scoped and generated on demand, so they cannot become
stale when business data changes. A user can mark an item as read without
hiding it from colleagues: dismissals are stored per tenant, user, and stable
notification key in `notification_dismissals`. A compound unique index prevents
duplicate dismissals.

## Automated Policy PDF Generation

Every user role can download an official-looking policy PDF directly from the
client table. The server builds it on demand from the current tenant-scoped
record, so status changes, payment details, and broker confirmation are never
stale and no duplicate binary needs to be stored. The document includes policy
and customer identity, coverage dates, premium, payment data, selling agent,
and conditional travel or vehicle details. Responses are marked `no-store` and
cross-tenant identifiers return `404` without revealing whether a policy exists.

## Uploaded Policy Documents

Agents and administrators can upload PDF, JPEG, and PNG policy documents up to
5 MB. Files receive cryptographically random storage names, while original file
names, MIME types, sizes, policy/customer references, timestamps, and uploader
identity are stored as ArangoDB metadata. The upload directory is not publicly
served, and every download is authorized through the API and scoped to the
signed-in user's tenant. Analysts can list and download documents but cannot
upload them.

Policy documents are connected to policies through the `has_document` graph
edge. Docker Compose stores binaries in the persistent `document_uploads`
volume, while `.gitignore` and `.dockerignore` prevent local uploads from being
committed or copied into application images. Production deployments can later
replace the local volume with S3-compatible object storage without changing the
document metadata model.

## Business Audit Trail

Every successful business mutation writes an append-only audit event. Covered
actions include insurer and policy creation, policy and claim status changes,
broker confirmation, premium payments, notification dismissals, and document
uploads. Each event records a stable action name, entity type and identifier,
safe summary and change metadata, timestamp, authenticated actor and role, IP
address, and user agent.

Only administrators can read `/api/audit`. Results are tenant-scoped, sorted
newest first, limited to at most 200 records, and can be filtered by `action` or
`entityType`. Passwords, session tokens, JMBG values, passport numbers, uploaded
file contents, and raw request bodies are never copied into the audit trail.
Compound ArangoDB indexes support chronological review and entity history.

## Production Readiness and Observability

Every HTTP response receives a unique `X-Request-Id` header for correlating
client reports with server activity. The process tracks request volume, HTTP
status counts, methods, client/server errors, average and maximum response time,
uptime, database mode, and Node.js memory usage. Runtime metrics are available
only to authenticated administrators and are displayed in the security panel.

`/api/health/live` verifies that the process is running, while
`/api/health/ready` also verifies the ArangoDB connection when the database is
required. Docker Compose uses readiness for its application health check.
Optional structured JSON request logging can be enabled with
`REQUEST_LOGGING=true`.

The container declares `SIGTERM` as its stop signal. The application stops
accepting new connections, gives active requests up to ten seconds to finish,
and exits cleanly within Docker's 15-second grace period. This behavior makes
rolling deployments and controlled container restarts safer.

## NoSQL Concepts Demonstrated

- Flexible JSON document model
- Shared-database multi-tenancy with tenant-scoped queries and compound indexes
- Conditional data validation and a tenant-scoped unique JMBG index
- Role-protected broker approval workflow with status, timestamp, and approving-user metadata
- Tenant-safe claims workflow with policy-period validation and append-only status history
- Premium payment ledger with duplicate prevention, balance validation, and policy audit integration
- Derived operational notifications with severity ordering and per-user dismissal state
- Protected policy-document storage with MIME/size validation and graph relationships
- Administrator-only business audit with safe metadata, filtering, and compound indexes
- Request correlation, protected runtime metrics, health probes, and graceful container shutdown
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
