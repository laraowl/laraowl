<p align="center">
  <img src="art/banner.png" alt="LaraOwl Banner" width="100%">
</p>

<p align="center">
  <b>Self-hosted application monitoring for Laravel — track everything, own your data.</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#client-integration">Client Integration</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#production-deployment">Production</a> •
  <a href="#license">License</a>
</p>

---

## Why LaraOwl?

LaraOwl is a **open-source, self-hosted** monitoring platform built specifically for Laravel applications. Unlike SaaS alternatives, you deploy it on your own infrastructure — your data never leaves your servers.

Drop in a single Composer package on any Laravel app, point it at your LaraOwl server, and instantly get real-time dashboards for requests, exceptions, queries, jobs, and more.


## Screenshots

<p align="center">
  <img src="art/screenshots/dashboard.png" alt="LaraOwl Dashboard" width="100%">
</p>

---

## Features

### Full-Stack Observability

| Category | What's Tracked |
|---|---|
| **Requests** | Every HTTP request — method, path, status code, duration, middleware timing, response size |
| **Exceptions** | Automatic grouping, stack traces, occurrence count, first/last seen, resolution status |
| **Database Queries** | Slow query detection, N+1 identification, execution time, connection info |
| **Jobs & Queues** | Job processing status, duration, failures, retry tracking |
| **Commands** | Artisan command execution, exit codes, runtime duration |
| **Scheduled Tasks** | Cron health, execution history, failure alerts |
| **Cache Events** | Hit/miss ratios, key-level analytics |
| **Mail & Notifications** | Outbound mail tracking, notification channel analytics |
| **Outgoing Requests** | HTTP client calls to external APIs — host, status, latency |
| **Logs** | Centralized application log aggregation with search |

### Real-Time Dashboard

- **Live updates** via WebSockets (Laravel Reverb) — no page refresh needed
- **Interactive charts** with time-series breakdowns (Recharts)
- **Flexible time filters** — 1h, 24h, 7d, 14d, 30d, or custom date ranges
- **Per-page pagination** that preserves active filters

### User Tracking

- Authenticated vs. guest request breakdown
- Per-user request volume, error rates, and last-seen timestamps
- User activity drill-down with full request history

### Uptime Monitoring

- Automatic health checks every 30 seconds
- Status code tracking with response time history
- Instant alerts when your site goes down

### Heartbeat Monitoring

- Cron job and scheduled task health verification
- Configurable check-in intervals
- Alerts when a heartbeat stops reporting

### Security & Threat Detection

- **Built-in WAF analysis** — detects SQL injection, XSS, path traversal, command injection, LFI/RFI
- **Risk scoring engine** with configurable thresholds (Medium / High / Critical)
- **IP-based threat tracking** with automatic pattern recognition
- **Security audit dashboard** with threat timeline

### Cloudflare Integration

- Direct Cloudflare API connection for WAF management
- Firewall rule CRUD from the dashboard
- Traffic analytics and audit log visualization
- One-click IP blocking

### Alerting & Integrations

Send alerts to the channels your team already uses:

| Channel | Supported |
|---|---|
| **Slack** | ✅ Rich block messages with action buttons |
| **Discord** | ✅ Embedded messages with fields |
| **Telegram** | ✅ Markdown-formatted bot messages |
| **Email** | ✅ Plain-text notifications |
| **Webhooks** | ✅ JSON payload to any endpoint |

**Alert triggers:**
- New exception detected
- High latency / slow performance
- Uptime down
- Heartbeat failure
- Error spike (configurable window & threshold)
- Throttle control to prevent alert fatigue

### Performance Thresholds

Set custom performance budgets per project:
- Route response time limits
- Job execution time limits
- Query execution time limits
- Command runtime limits
- Automatic issue creation when thresholds are exceeded

### Data Retention

- **Per-project retention policies** — 1, 3, 7, 14, 30, 60, 90 days, or never delete
- **Automatic daily pruning**

### Multi-Tenant Architecture

- **Teams** with role-based access
- **Multiple projects** per team
- **Per-project settings**, API tokens, and integrations
- Team invitations via email

### Asynchronous Ingestion

- All incoming data is processed via **Laravel Queues**
- Zero-latency API responses — data is queued immediately
- Broadcasting happens in the background worker

---

## Quick Start

### Prerequisites

- PHP 8.3+
- Node.js 18+
- Composer
- MySQL 8.0+ or PostgreSQL
- A queue worker

### Installation

Choose one of the following methods to install the LaraOwl server:

#### Using Composer
```bash
composer create-project laraowl/laraowl laraowl
cd laraowl
```

#### Finalizing Setup
Once the files are ready, complete the setup:
```bash
# Install frontend dependencies
npm install

# Environment setup
cp .env.example .env
php artisan key:generate

# Configure your database in .env, then:
php artisan migrate

# Link the storage directory (required for uploaded project avatars to display)
php artisan storage:link

# Build frontend assets
npm run build

# Start the server
php artisan serve
```

### Required Background Processes

LaraOwl needs these processes running alongside the web server:

```bash
# Process queued records (required)
php artisan queue:work

# WebSocket server for real-time updates (required)
php artisan reverb:start

# Scheduler for uptime checks & data pruning (required)
php artisan schedule:work
```

---

## Client Integration

### 1. Install the Client Package

In the Laravel application you want to monitor:

```bash
composer require laraowl/client
```

### 2. Configure

Run the interactive setup command:

```bash
php artisan laraowl:install
```

Or manually add to your `.env`:

```env
LARAOWL_SERVER_URL=https://your-laraowl-server.com
LARAOWL_TOKEN=your_project_api_token
```

You can find the API token in **Project Settings → API Keys** within the LaraOwl dashboard.

### 3. Optional: Send Logs

To forward application logs to LaraOwl:

```env
LOG_STACK=stack,laraowl
```

That's it. Your application will immediately begin sending telemetry data to the LaraOwl server.

---

## Architecture

```
┌──────────────────┐         HTTPS POST          ┌──────────────────────┐
│  Your Laravel    │  ──────────────────────────▶ │  LaraOwl Server      │
│  Application     │     /api/ingest              │                      │
│                  │     (API Token Auth)         │  ┌────────────────┐  │
│  laraowl/client  │                              │  │ IngestController│  │
│  package         │                              │  └───────┬────────┘  │
└──────────────────┘                              │          │           │
                                                  │    Queue Dispatch    │
                                                  │          │           │
                                                  │  ┌───────▼────────┐  │
                                                  │  │ ProcessIngested │  │
                                                  │  │ Records (Job)  │  │
                                                  │  └───────┬────────┘  │
                                                  │          │           │
                                                  │  ┌───────▼────────┐  │
                                                  │  │ IngestService   │  │
                                                  │  │ • Store records │  │
                                                  │  │ • Group issues  │  │
                                                  │  │ • Check threats │  │
                                                  │  │ • Fire alerts   │  │
                                                  │  └───────┬────────┘  │
                                                  │          │           │
                                                  │    WebSocket Push    │
                                                  │    (Reverb)          │
                                                  │          │           │
                                                  │  ┌───────▼────────┐  │
                                                  │  │ React Dashboard │  │
                                                  │  │ (Inertia + SSR) │  │
                                                  │  └────────────────┘  │
                                                  └──────────────────────┘
```

**Data flow:**
1. The **client package** hooks into Laravel's service container and captures requests, exceptions, queries, jobs, etc.
2. Captured data is sent via authenticated HTTP POST to the server's `/api/ingest` endpoint.
3. The server **immediately queues** the payload and responds with `200 OK` (zero processing delay).
4. A **queue worker** processes the records: stores them, calculates fingerprints for grouping, runs security analysis, and checks alert thresholds.
5. A **WebSocket event** (`ProjectDataIngested`) is broadcast so the dashboard updates in real-time.

---

## Production Deployment

### Environment Variables

Key variables to configure for production:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=laraowl
DB_USERNAME=laraowl
DB_PASSWORD=your-secure-password

# Queue (use Redis for best performance)
QUEUE_CONNECTION=redis

# Broadcasting
BROADCAST_CONNECTION=reverb

# Reverb WebSocket
REVERB_HOST="your-domain.com"
REVERB_PORT=8080
REVERB_SCHEME=https
```

### Process Management (Supervisor)

Example Supervisor configuration for the queue worker:

```ini
[program:laraowl-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/laraowl/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
numprocs=2
redirect_stderr=true
stdout_logfile=/var/log/laraowl/queue.log

[program:laraowl-reverb]
command=php /path/to/laraowl/artisan reverb:start
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/laraowl/reverb.log
```

### Scheduler (Cron)

Add to your server's crontab:

```
* * * * * cd /path/to/laraowl && php artisan schedule:run >> /dev/null 2>&1
```

This handles:
- **Uptime checks** — every 30 seconds
- **Data pruning** — daily cleanup based on retention settings

---

## Dashboard Sections

| Section | Description |
|---|---|
| **Overview** | High-level project health — requests, errors, performance at a glance |
| **Requests** | HTTP traffic analysis with route-level breakdown |
| **Exceptions** | Grouped errors with stack traces and occurrence tracking |
| **Jobs** | Queue job monitoring — processed, failed, duration |
| **Commands** | Artisan command execution history |
| **Scheduled Tasks** | Cron job health and execution log |
| **Queries** | Database query analytics — slow queries, N+1 detection |
| **Notifications** | Outbound notification tracking by channel |
| **Mail** | Email delivery monitoring |
| **Cache** | Cache hit/miss analytics by key |
| **Outgoing Requests** | External HTTP call monitoring |
| **Users** | Authenticated user activity tracking |
| **Uptime** | Site availability monitoring |
| **Logs** | Centralized log viewer with search |
| **Security** | Threat detection dashboard |
| **Firewall** | Cloudflare WAF management (traffic, rules, audit) |
| **Settings** | General, Integrations, Alert Rules, Thresholds, API Keys, Cloudflare |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

LaraOwl is open-source software licensed under the [Apache License 2.0](LICENSE).
