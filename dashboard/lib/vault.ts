import crypto from "crypto";
import fs from "fs";
import path from "path";

// ─── Encryption (AES-256-GCM) ───────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  // In production, use a proper KMS or HSM.
  // For now, derive from VAULT_MASTER_KEY env variable.
  const master = process.env.VAULT_MASTER_KEY;
  if (!master) {
    throw new Error(
      "VAULT_MASTER_KEY not set. Generate one with: openssl rand -hex 32"
    );
  }
  return crypto.scryptSync(master, "fleet-vault-salt", 32);
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, cipherHex] = encoded.split(":");
  if (!ivHex || !tagHex || !cipherHex) throw new Error("Invalid encrypted data");

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf-8");
}

// ─── Vault store ────────────────────────────────────────────────────────
interface VaultEntry {
  key: string;
  encryptedValue: string;
  description: string;
  lastUpdated: string;
  updatedBy: string;
}

const VAULT_FILE =
  process.env.VAULT_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "vault.json");

function ensureDir() {
  const dir = path.dirname(VAULT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadVault(): VaultEntry[] {
  ensureDir();
  if (!fs.existsSync(VAULT_FILE)) return [];
  return JSON.parse(fs.readFileSync(VAULT_FILE, "utf-8"));
}

function saveVault(entries: VaultEntry[]): void {
  ensureDir();
  fs.writeFileSync(VAULT_FILE, JSON.stringify(entries, null, 2));
}

// ─── Public API ─────────────────────────────────────────────────────────

/** List all secrets (key + description only, NO values) */
export function listSecrets(): { key: string; description: string; lastUpdated: string }[] {
  return loadVault().map((e) => ({
    key: e.key,
    description: e.description,
    lastUpdated: e.lastUpdated,
  }));
}

/** Get a decrypted secret value */
export function getSecret(key: string): string | null {
  const entry = loadVault().find((e) => e.key === key);
  if (!entry) return null;
  try {
    return decrypt(entry.encryptedValue);
  } catch {
    return null;
  }
}

/** Set (create or update) a secret */
export function setSecret(
  key: string,
  value: string,
  description: string,
  updatedBy: string
): void {
  const vault = loadVault();
  const idx = vault.findIndex((e) => e.key === key);
  const entry: VaultEntry = {
    key,
    encryptedValue: encrypt(value),
    description,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };
  if (idx >= 0) {
    vault[idx] = entry;
  } else {
    vault.push(entry);
  }
  saveVault(vault);
}

/** Delete a secret */
export function deleteSecret(key: string): boolean {
  const vault = loadVault();
  const idx = vault.findIndex((e) => e.key === key);
  if (idx === -1) return false;
  vault.splice(idx, 1);
  saveVault(vault);
  return true;
}

/** Mask a secret value for display (show first 4 and last 4 chars) */
export function maskSecret(value: string): string {
  if (value.length <= 12) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`;
}

// ─── Initialize default secrets from .env (first run only) ──────────────
export function initializeVaultFromEnv(): void {
  const vault = loadVault();
  if (vault.length > 0) return; // already initialized

  const envKeys = [
    { key: "ANTHROPIC_API_KEY", desc: "Anthropic API key (shared)" },
    { key: "CLAW_1_TOKEN", desc: "OpenClaw 1 gateway token" },
    { key: "CLAW_2_TOKEN", desc: "OpenClaw 2 gateway token" },
    { key: "CLAW_3_TOKEN", desc: "OpenClaw 3 gateway token" },
    { key: "CLAW_4_TOKEN", desc: "OpenClaw 4 gateway token" },
    { key: "CLAW_5_TOKEN", desc: "OpenClaw 5 gateway token" },
    { key: "CLAW_6_TOKEN", desc: "OpenClaw 6 gateway token" },
    { key: "N8N_API_KEY", desc: "n8n REST API key" },
  ];

  for (const { key, desc } of envKeys) {
    const val = process.env[key];
    if (val) {
      setSecret(key, val, desc, "system");
    }
  }
}
