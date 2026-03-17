# Agent Fleet Dashboard

> Unified control center for **OpenClaw AI agents** + **n8n workflows**.
> One-click provisioning, real-time monitoring, built-in chat, cost tracking, and full audit trail.

## Quick Start

```bash
git clone https://github.com/YOUR_USER/agent-fleet-dashboard.git
cd agent-fleet-dashboard
cp .env.example .env

# Generate secrets
echo "VAULT_MASTER_KEY=$(openssl rand -hex 32)" >> .env
for i in 1 2 3 4 5 6; do echo "CLAW_${i}_TOKEN=$(openssl rand -hex 32)" >> .env; done

# Copy agent configs
for i in 2 3 4 5 6; do cp configs/claw-1.json configs/claw-${i}.json; done

# Launch everything
docker compose up -d
# Dashboard: http://localhost:3000 (login: admin / admin)
```

## Features (14 pages)

**Core:** Overview, Agents (model selector + control), Chat (per-agent, switchable model, cost/token per message), n8n Workflows

**Control:** Agent Routing (keyword/intent auto-delegation), Task Scheduler (cron from UI), AI Orchestrator (auto-heal, CPU alerts, analytics)

**Monitor:** Live Logs (real-time, filterable), Resources (CPU/RAM live), Knowledge Base (shared memory, categories, tags)

**Admin:** Provision (one-click add/remove Claw), Billing (THB/USD, budget alerts 50/75/90/100%), Audit Log (who/what/when/IP), Backup & Restore, Settings, Secret Vault (AES-256-GCM), Auth + RBAC (admin/operator/viewer), Notifications (Discord/LINE/webhook)

## Architecture

```
Fleet Dashboard (:3000) ─── Next.js 14 + React + SWR
    ├── Auth (scrypt + session cookie) + RBAC (3 roles, 18 permissions)
    ├── Secret Vault (AES-256-GCM encrypted at rest)
    ├── Audit Log (JSONL, daily rotation)
    ├── AI Orchestrator (auto-restart, CPU alerts, analytics, scheduler)
    │
    ├──→ OpenClaw x6+ (:18789+) ─── Gateway Health API + Session API
    ├──→ n8n (:5678) ─── REST API (workflows + executions)
    ├──→ cAdvisor (:8080) ─── Container metrics
    └──→ Docker Engine API ─── Stats, restart, stop, start, logs, provision
```

## Project Structure (70 files)

```
├── docker-compose.yml          # 6 Claw + n8n + cAdvisor + Dashboard
├── fleet-config.json           # Agent registry (auto-updated by provisioner)
├── .env.example                # Secrets template
├── configs/claw-1.json         # OpenClaw config (1 per agent)
│
└── dashboard/
    ├── app/api/                # 16 API routes
    │   ├── auth, users         # Authentication + user management
    │   ├── health, agents/[id] # Agent health + detail
    │   ├── docker, logs        # Container stats/actions + aggregated logs
    │   ├── n8n                 # Workflow monitoring
    │   ├── vault, audit        # Secret vault + audit log
    │   ├── notifications       # Discord/LINE/webhook config
    │   ├── routing, scheduler  # Agent routing + cron tasks
    │   ├── knowledge           # Shared knowledge base
    │   ├── analytics, backup   # Usage trends + backup/restore
    │   ├── orchestrator        # Meta-agent control
    │   └── provision           # One-click add/remove agents
    │
    ├── app/dashboard/          # 14 pages (sidebar: 4 groups)
    │   ├── page.tsx            # Overview
    │   ├── agents, n8n         # Agent management + n8n
    │   ├── routing, scheduler  # Control: routing rules + cron
    │   ├── orchestrator        # Control: AI orchestrator panel
    │   ├── logs, resources     # Monitor: live logs + CPU/RAM
    │   ├── knowledge           # Monitor: shared KB
    │   ├── provision           # Admin: add/remove agents
    │   ├── audit, backup       # Admin: audit log + backup
    │   └── settings            # Admin: config
    │
    ├── components/             # StatusDot, MetricCard, UsageBar, AgentCard, LogViewer
    │
    └── lib/                    # 17 service libraries
        ├── fleet, docker, hooks          # Core infra
        ├── auth, auth-types, auth-middleware  # Authentication
        ├── vault, audit                  # Security
        ├── notifications                 # Alert dispatch
        ├── routing, scheduler            # Task control
        ├── knowledge, analytics          # Intelligence
        ├── backup, skills, workspaces    # Data management
        ├── orchestrator                  # Meta-agent
        └── provisioner                   # One-click deploy
```

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth` | — | Login / Logout |
| GET | `/api/auth` | any | Current user |
| GET/POST | `/api/users` | admin | User CRUD |
| GET | `/api/health` | viewer+ | All agent health |
| GET | `/api/agents/:id` | viewer+ | Agent detail + sessions |
| GET/POST | `/api/docker` | viewer+/varies | Stats + actions (restart/stop/start) |
| GET | `/api/logs` | viewer+ | Aggregated logs |
| GET | `/api/n8n` | viewer+ | Workflows + executions |
| GET/POST | `/api/vault` | admin | Encrypted secrets |
| GET | `/api/audit` | admin | Audit logs |
| GET/POST | `/api/notifications` | admin | Notification config + test |
| GET/POST | `/api/routing` | viewer+/admin | Routing rules |
| GET/POST | `/api/scheduler` | viewer+/admin | Scheduled tasks |
| GET/POST | `/api/knowledge` | operator+ | Knowledge base |
| GET | `/api/analytics` | viewer+ | Usage aggregates |
| GET/POST | `/api/backup` | admin | Backup/restore |
| GET/POST | `/api/orchestrator` | viewer+/admin | Orchestrator control |
| GET/POST | `/api/provision` | admin | Add/remove agents |

## RBAC

| | Admin | Operator | Viewer |
|---|:---:|:---:|:---:|
| View dashboards | O | O | O |
| Chat with agents | O | O | — |
| Restart/start agents | O | O | — |
| Stop agents | O | — | — |
| Change model/settings | O | — | — |
| Secrets/audit/provision | O | — | — |

## Adding Agents

**From Dashboard:** Provision → + Add new Claw → role/model/memory → Create & Start

**What happens:** Generate token → Store in vault → Create config file → Start Docker container → Register in fleet → Ready to chat

## Security

- Passwords: scrypt (16-byte salt + 64-byte key)
- Secrets: AES-256-GCM (vault master key required)
- Sessions: HTTP-only cookie, 24h TTL
- Audit: Every action logged (JSONL, user + IP + timestamp)
- Docker socket: read-only mount
- For production: add reverse proxy with TLS, use Tailscale for remote access

## License

MIT
