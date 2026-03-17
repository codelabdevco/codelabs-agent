import fs from "fs";
import path from "path";
import crypto from "crypto";
import Docker from "dockerode";
import { setSecret } from "./vault";
import { addAuditLog } from "./audit";

// ─── Types ──────────────────────────────────────────────────────────────
export interface ProvisionRequest {
  role: string; // e.g. "marketing", "qa", "accounting"
  displayName?: string; // e.g. "Marketing Agent"
  description?: string;
  model?: string; // default model, e.g. "claude-sonnet-4-20250514"
  systemPrompt?: string;
  memoryLimitMB?: number; // default 512
  cpuLimit?: string; // default "1.0"
  channels?: Record<string, any>; // optional channel config
}

export interface ProvisionResult {
  success: boolean;
  agent?: {
    id: string;
    name: string;
    container: string;
    port: number;
    host: string;
    role: string;
    token: string; // masked
  };
  error?: string;
}

// ─── Config paths ───────────────────────────────────────────────────────
const FLEET_CONFIG_PATH =
  process.env.FLEET_CONFIG_PATH ||
  path.join(process.cwd(), "..", "fleet-config.json");

const CONFIGS_DIR =
  process.env.CONFIGS_DIR ||
  path.join(process.cwd(), "..", "configs");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// ─── Helpers ────────────────────────────────────────────────────────────
function loadFleetConfig(): any {
  return JSON.parse(fs.readFileSync(FLEET_CONFIG_PATH, "utf-8"));
}

function saveFleetConfig(config: any): void {
  fs.writeFileSync(FLEET_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getNextClawNumber(): number {
  const config = loadFleetConfig();
  const existing = config.openclaw || [];
  // Find highest claw number
  let max = 0;
  for (const agent of existing) {
    const match = agent.id.match(/claw-(\d+)/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return max + 1;
}

function getNextPort(): number {
  const config = loadFleetConfig();
  const existing = config.openclaw || [];
  const usedPorts = existing.map((a: any) => a.externalPort);
  // Start from 18789, find next available
  let port = 18789;
  while (usedPorts.includes(port)) port++;
  return port;
}

// ─── Create OpenClaw config file ────────────────────────────────────────
function createClawConfig(opts: {
  role: string;
  displayName: string;
  model: string;
  systemPrompt: string;
  channels?: Record<string, any>;
}): string {
  const config = {
    $schema: "https://openclaw.ai/schema/config.json",
    gateway: {
      port: 3001,
      bind: "0.0.0.0",
    },
    agents: {
      defaults: {
        model: `anthropic:${opts.model}`,
        thinking: true,
        compaction: {
          enabled: true,
          maxTokens: 150000,
        },
      },
      list: [
        {
          id: `${opts.role}-agent`,
          name: opts.displayName,
          systemPrompt: opts.systemPrompt,
        },
      ],
    },
    channels: opts.channels || {},
    models: {
      anthropic: {
        provider: "anthropic",
        models: [
          "claude-sonnet-4-20250514",
          "claude-opus-4-20250514",
          "claude-haiku-4-5-20251001",
        ],
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

// ─── Default system prompts by role ─────────────────────────────────────
const DEFAULT_PROMPTS: Record<string, string> = {
  sales:
    "You are a sales assistant. Help with lead generation, client follow-up, proposal drafting, and CRM management. Respond in Thai unless the user writes in English.",
  support:
    "You are a customer support agent. Help resolve customer issues, manage tickets, and provide helpful answers. Be patient and empathetic. Respond in Thai.",
  docs:
    "You are a document management agent. Help create reports, manage documents, build knowledge base entries, and organize files. Respond in Thai.",
  devops:
    "You are a DevOps agent. Help with CI/CD pipelines, deployments, monitoring, and infrastructure management. You can interact with GitHub and cloud services.",
  finance:
    "You are a finance agent. Help with invoicing, accounting, bank reconciliation, and financial reporting. Be precise with numbers. Respond in Thai.",
  hr:
    "You are an HR agent. Help with recruitment, onboarding, employee management, leave tracking, and HR policies. Respond in Thai.",
  marketing:
    "You are a marketing agent. Help with content creation, social media management, campaign planning, and analytics. Respond in Thai.",
  qa:
    "You are a QA agent. Help with test planning, bug tracking, quality assurance processes, and test automation. Respond in Thai.",
  accounting:
    "You are an accounting agent. Help with bookkeeping, tax preparation, financial statements, and compliance. Be precise. Respond in Thai.",
  general:
    "You are a helpful assistant for a waterworks contracting business. Help with any task requested. Respond in Thai unless the user writes in English.",
};

function getDefaultPrompt(role: string): string {
  return DEFAULT_PROMPTS[role] || DEFAULT_PROMPTS.general;
}

// ─── Main provisioning function ─────────────────────────────────────────
export async function provisionNewClaw(
  request: ProvisionRequest,
  createdBy: string
): Promise<ProvisionResult> {
  try {
    const num = getNextClawNumber();
    const port = getNextPort();
    const id = `claw-${num}`;
    const role = request.role.toLowerCase().replace(/\s+/g, "-");
    const displayName =
      request.displayName || `Claw ${num} — ${role.charAt(0).toUpperCase() + role.slice(1)}`;
    const containerName = `claw-${num}-${role}`;
    const description = request.description || `Agent for ${role}`;
    const model = request.model || "claude-sonnet-4-20250514";
    const systemPrompt = request.systemPrompt || getDefaultPrompt(role);
    const memoryLimit = request.memoryLimitMB || 512;
    const cpuLimit = request.cpuLimit || "1.0";

    // 1. Generate gateway token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenKey = `CLAW_${num}_TOKEN`;

    // 2. Store token in vault
    setSecret(tokenKey, token, `OpenClaw ${num} gateway token`, createdBy);

    // 3. Create OpenClaw config file
    if (!fs.existsSync(CONFIGS_DIR)) {
      fs.mkdirSync(CONFIGS_DIR, { recursive: true });
    }
    const configContent = createClawConfig({
      role,
      displayName,
      model,
      systemPrompt,
      channels: request.channels,
    });
    const configPath = path.join(CONFIGS_DIR, `claw-${num}.json`);
    fs.writeFileSync(configPath, configContent);

    // 4. Get ANTHROPIC_API_KEY from env or vault
    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || (await getAnthropicKeyFromVault());

    // 5. Create and start Docker container
    const volumeName = `claw${num}_data`;

    // Create volume
    try {
      await docker.createVolume({ Name: volumeName });
    } catch {
      // Volume might already exist
    }

    const container = await docker.createContainer({
      Image: "openclaw/openclaw:latest",
      name: containerName,
      ExposedPorts: { "3001/tcp": {} },
      HostConfig: {
        PortBindings: {
          "3001/tcp": [{ HostPort: String(port) }],
        },
        Binds: [
          `${volumeName}:/app/data`,
          `${path.resolve(configPath)}:/app/data/.openclaw/openclaw.json:ro`,
        ],
        Memory: memoryLimit * 1024 * 1024,
        NanoCpus: Math.round(parseFloat(cpuLimit) * 1e9),
        RestartPolicy: { Name: "unless-stopped" },
      },
      Env: [
        `OPENCLAW_GATEWAY_TOKEN=${token}`,
        `ANTHROPIC_API_KEY=${anthropicKey}`,
      ],
      Labels: {
        "fleet.role": role,
        "fleet.agent": "openclaw",
        "fleet.managed": "true",
        "fleet.num": String(num),
      },
    });

    await container.start();

    // 6. Register in fleet-config.json
    const fleetConfig = loadFleetConfig();
    fleetConfig.openclaw.push({
      id,
      name: displayName,
      container: containerName,
      host: `http://${containerName}:3001`,
      externalPort: port,
      role,
      description,
    });
    saveFleetConfig(fleetConfig);

    // 7. Invalidate cached config
    invalidateFleetConfigCache();

    // 8. Audit log
    await addAuditLog({
      userId: createdBy,
      username: createdBy,
      action: "settings_updated",
      target: `provision:${id}`,
      detail: `Provisioned new OpenClaw: ${displayName} (${containerName}:${port}, model: ${model})`,
    });

    return {
      success: true,
      agent: {
        id,
        name: displayName,
        container: containerName,
        port,
        host: `http://localhost:${port}`,
        role,
        token: `${token.slice(0, 4)}${"•".repeat(20)}${token.slice(-4)}`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Decommission (remove) a Claw ───────────────────────────────────────
export async function decommissionClaw(
  agentId: string,
  removedBy: string,
  deleteData: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const fleetConfig = loadFleetConfig();
    const idx = fleetConfig.openclaw.findIndex((a: any) => a.id === agentId);
    if (idx === -1) return { success: false, error: "Agent not found" };

    const agent = fleetConfig.openclaw[idx];
    const containerName = agent.container;

    // 1. Stop and remove container
    try {
      const container = docker.getContainer(containerName);
      try {
        await container.stop({ t: 5 });
      } catch {
        // Might already be stopped
      }
      await container.remove({ force: true });
    } catch (err: any) {
      // Container might not exist
      if (!err.message?.includes("No such container")) {
        throw err;
      }
    }

    // 2. Remove from fleet-config
    fleetConfig.openclaw.splice(idx, 1);
    saveFleetConfig(fleetConfig);

    // 3. Optionally delete volume & config
    if (deleteData) {
      const num = agentId.replace("claw-", "");
      // Remove config file
      const configPath = path.join(CONFIGS_DIR, `claw-${num}.json`);
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

      // Remove Docker volume
      try {
        const volume = docker.getVolume(`claw${num}_data`);
        await volume.remove();
      } catch {
        // Volume might not exist
      }
    }

    // 4. Invalidate config cache
    invalidateFleetConfigCache();

    // 5. Audit
    await addAuditLog({
      userId: removedBy,
      username: removedBy,
      action: "settings_updated",
      target: `decommission:${agentId}`,
      detail: `Decommissioned ${agent.name} (${containerName}). Data ${deleteData ? "deleted" : "preserved"}.`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── List available roles (for UI dropdown) ─────────────────────────────
export function getAvailableRoles(): { value: string; label: string }[] {
  return Object.keys(DEFAULT_PROMPTS).map((k) => ({
    value: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
  }));
}

// ─── Get fleet summary ──────────────────────────────────────────────────
export function getFleetSummary(): {
  totalAgents: number;
  nextNumber: number;
  nextPort: number;
  agents: { id: string; name: string; port: number; role: string; container: string }[];
} {
  const config = loadFleetConfig();
  return {
    totalAgents: config.openclaw.length,
    nextNumber: getNextClawNumber(),
    nextPort: getNextPort(),
    agents: config.openclaw.map((a: any) => ({
      id: a.id,
      name: a.name,
      port: a.externalPort,
      role: a.role,
      container: a.container,
    })),
  };
}

// ─── Helper: get Anthropic key from vault ───────────────────────────────
async function getAnthropicKeyFromVault(): Promise<string> {
  const { getSecret } = await import("./vault");
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not found in vault or environment");
  return key;
}

// ─── Invalidate fleet config cache ──────────────────────────────────────
function invalidateFleetConfigCache(): void {
  // The fleet.ts module caches config in _config variable
  // We need to clear it so next read picks up changes
  try {
    const fleetModule = require("./fleet");
    if (fleetModule._config !== undefined) {
      fleetModule._config = null;
    }
  } catch {
    // Module might not be loaded yet
  }
}
