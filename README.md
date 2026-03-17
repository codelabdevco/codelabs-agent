# Agent Fleet Dashboard

> Unified control center for **OpenClaw AI agents** + **n8n workflows**.  
> One-click provisioning, real-time monitoring, built-in chat, cost tracking, and full audit trail.

**82 files · 18 services · 19 API routes · 15 pages · 5 components**

## Deployed

| Service | URL | Port |
|---------|-----|------|
| Fleet Dashboard | http://76.13.217.242:3002 | 3002 |
| OpenClaw 1-6 | http://76.13.217.242:18789 ... :18794 | 18789-18794 |
| n8n | http://76.13.217.242:5679 | 5679 |
| cAdvisor | http://76.13.217.242:8081 | 8081 |
| Portainer | http://76.13.217.242:9000 | 9000 |

Stack managed via Portainer → `codelabs-agent`

## Quick Start

```bash
git clone https://github.com/codelabdevco/codelabs-agent.git
cd codelabs-agent
cp .env.example .env

# Generate secrets
echo "VAULT_MASTER_KEY=$(openssl rand -hex 32)" >> .env
for i in 1 2 3 4 5 6; do echo "CLAW_${i}_TOKEN=$(openssl rand -hex 32)" >> .env; done

# Set your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE" >> .env

# Launch everything
docker compose up -d
# Dashboard: http://localhost:3000 (login: admin / admin)
```

## Features (15 pages)

**Core:** Overview, Agents (model selector + control), Chat (per-agent, switchable model, cost/token per message), n8n Workflows

**Control:** Agent Routing (keyword/intent auto-delegation), Task Scheduler (cron from UI), AI Orchestrator (auto-heal, CPU alerts, analytics)

**Monitor:** Live Logs (real-time, filterable), Resources (CPU/RAM live), Knowledge Base (shared memory, categories, tags), Billing (THB/USD, budget alerts 50/75/90/100%)

**Admin:** Provision (one-click add/remove Claw), Audit Log (who/what/when/IP), Backup & Restore, Settings, Secret Vault (AES-256-GCM), Auth + RBAC (admin/operator/viewer), Notifications (Discord/LINE/webhook)

## Architecture

```
Fleet Dashboard (:3002) ─── Next.js 14 + React + SWR
    ├── Auth (scrypt + session cookie) + RBAC (3 roles, 18 permissions)
    ├── Secret Vault (AES-256-GCM encrypted at rest)
    ├── Audit Log (JSONL, daily rotation)
    ├── AI Orchestrator (auto-restart, CPU alerts, analytics, scheduler)
    │
    ├──→ OpenClaw x6+ (:18789-18794) ─── Gateway Health API + Session API
    ├──→ n8n (:5679) ─── REST API (workflows + executions)
    ├──→ cAdvisor (:8081) ─── Container metrics
    └──→ Docker Engine API ─── Stats, restart, stop, start, logs, provision
```

## Project Structure (82 files)

```
codelabs-agent/
├── docker-compose.yml          # 6 Claw + n8n + cAdvisor + Dashboard
├── fleet-config.json           # Agent registry (auto-updated by provisioner)
├── .env.example                # Secrets template
├── configs/                    # OpenClaw configs (1 per agent)
│   ├── claw-1.json             # Sales
│   ├── claw-2.json             # Support
│   ├── claw-3.json             # Docs
│   ├── claw-4.json             # DevOps
│   ├── claw-5.json             # Finance
│   └── claw-6.json             # HR
│
└── dashboard/                  # Next.js 14 app
    ├── Dockerfile
    ├── package.json
    │
    ├── app/api/                # 19 API routes
    │   ├── auth, users         # Authentication + user management
    │   ├── health, agents/[id] # Agent health + detail
    │   ├── chat                # Proxy messages to agents + token/cost tracking
    │   ├── docker, logs        # Container stats/actions + aggregated logs
    │   ├── n8n                 # Workflow monitoring
    │   ├── billing             # Real-time cost, budget management, alerts
    │   ├── vault, audit        # Secret vault + audit log
    │   ├── notifications       # Discord/LINE/webhook config
    │   ├── routing, scheduler  # Agent routing + cron tasks
    │   ├── knowledge           # Shared knowledge base
    │   ├── analytics, backup   # Usage trends + backup/restore
    │   ├── orchestrator        # Meta-agent control
    │   └── provision           # One-click add/remove agents
    │
    ├── app/dashboard/          # 15 pages (sidebar: 4 groups)
    │   ├── page.tsx            # Overview
    │   ├── agents/             # Agent management + model selector
    │   ├── chat/               # Built-in chat with any agent
    │   ├── n8n/                # n8n workflow monitoring
    │   ├── routing/            # Agent-to-agent routing rules
    │   ├── scheduler/          # Cron task manager
    │   ├── orchestrator/       # AI orchestrator panel
    │   ├── logs/               # Real-time log viewer
    │   ├── resources/          # CPU/RAM monitoring
    │   ├── knowledge/          # Shared knowledge base
    │   ├── billing/            # Cost tracking + budget alerts
    │   ├── provision/          # Add/remove agents
    │   ├── audit/              # Audit log viewer
    │   ├── backup/             # Backup & restore
    │   └── settings/           # Configuration
    │
    ├── components/             # StatusDot, MetricCard, UsageBar, AgentCard, LogViewer
    │
    └── lib/                    # 18 service libraries
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
| GET/POST | `/api/chat` | operator+ | Chat with agent (proxy + cost tracking) |
| GET/POST | `/api/docker` | viewer+/varies | Stats + actions (restart/stop/start) |
| GET | `/api/logs` | viewer+ | Aggregated logs |
| GET | `/api/n8n` | viewer+ | Workflows + executions |
| GET/POST | `/api/billing` | viewer+/admin | Cost tracking + budget management |
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
| Set budget | O | — | — |
| Secrets/audit/provision | O | — | — |

## Adding Agents

**From Dashboard:** Provision → + Add new Claw → role/model/memory → Create & Start

**What happens automatically:**
1. Generate gateway token
2. Store token in encrypted vault
3. Create OpenClaw config file
4. Start Docker container
5. Register in fleet-config.json
6. Agent appears in dashboard — ready to chat

**Available roles:** Sales, Support, Docs, DevOps, Finance, HR, Marketing, QA, Accounting, General

## Security

- Passwords: scrypt (16-byte salt + 64-byte key)
- Secrets: AES-256-GCM (vault master key required)
- Sessions: HTTP-only cookie, 24h TTL
- Audit: Every action logged (JSONL, user + IP + timestamp)
- Docker socket: read-only mount
- For production: add reverse proxy with TLS, use Tailscale for remote access

## TODO

- [ ] Set real `ANTHROPIC_API_KEY`
- [ ] Generate proper tokens for `CLAW_1-6_TOKEN` and `VAULT_MASTER_KEY`
- [ ] Change `N8N_PASSWORD` from default
- [ ] Resolve port 3002 conflict with `demo-lim` container
- [ ] Mount config files to Claw containers
- [ ] Change default dashboard password from `admin/admin`

## License

MIT
