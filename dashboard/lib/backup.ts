import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { addAuditLog } from "./audit";

// ─── Types ──────────────────────────────────────────────────────────────
export interface BackupManifest {
  id: string;
  timestamp: string;
  createdBy: string;
  type: "full" | "config" | "data";
  files: string[];
  sizeBytes: number;
  description: string;
}

// ─── Paths ──────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "..", "data");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "..", "backups");
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(process.cwd(), "..", "configs");
const MANIFEST_FILE = path.join(BACKUP_DIR, "manifests.json");

function ensureDirs() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadManifests(): BackupManifest[] {
  ensureDirs();
  if (!fs.existsSync(MANIFEST_FILE)) return [];
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
}

function saveManifests(manifests: BackupManifest[]): void {
  ensureDirs();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifests, null, 2));
}

// ─── Collect files to backup ────────────────────────────────────────────
function collectFiles(type: "full" | "config" | "data"): string[] {
  const files: string[] = [];

  if (type === "full" || type === "config") {
    // Fleet config
    const fleetConfig = path.join(process.cwd(), "..", "fleet-config.json");
    if (fs.existsSync(fleetConfig)) files.push(fleetConfig);

    // OpenClaw configs
    if (fs.existsSync(CONFIG_DIR)) {
      for (const f of fs.readdirSync(CONFIG_DIR)) {
        if (f.endsWith(".json")) files.push(path.join(CONFIG_DIR, f));
      }
    }
  }

  if (type === "full" || type === "data") {
    // All data files (users, vault, routing, tasks, KB, notifications, audit)
    if (fs.existsSync(DATA_DIR)) {
      collectRecursive(DATA_DIR, files);
    }
  }

  return files;
}

function collectRecursive(dir: string, files: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRecursive(full, files);
    } else {
      files.push(full);
    }
  }
}

// ─── Create backup ──────────────────────────────────────────────────────
export function createBackup(
  type: "full" | "config" | "data",
  createdBy: string,
  description?: string
): BackupManifest {
  ensureDirs();
  const id = `backup-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const backupPath = path.join(BACKUP_DIR, `${id}.tar.gz`);

  const files = collectFiles(type);
  if (files.length === 0) {
    throw new Error("No files to backup");
  }

  // Create tar.gz
  const baseDir = path.join(process.cwd(), "..");
  const relFiles = files.map((f) => path.relative(baseDir, f));

  try {
    execSync(
      `cd "${baseDir}" && tar -czf "${backupPath}" ${relFiles.map((f) => `"${f}"`).join(" ")}`,
      { stdio: "pipe" }
    );
  } catch (err: any) {
    throw new Error(`Backup failed: ${err.message}`);
  }

  const stat = fs.statSync(backupPath);
  const manifest: BackupManifest = {
    id,
    timestamp,
    createdBy,
    type,
    files: relFiles,
    sizeBytes: stat.size,
    description: description || `${type} backup — ${files.length} files`,
  };

  const manifests = loadManifests();
  manifests.unshift(manifest);
  // Keep max 50 manifests
  if (manifests.length > 50) manifests.length = 50;
  saveManifests(manifests);

  return manifest;
}

// ─── Restore from backup ────────────────────────────────────────────────
export function restoreBackup(backupId: string): { restored: number; files: string[] } {
  ensureDirs();
  const manifests = loadManifests();
  const manifest = manifests.find((m) => m.id === backupId);
  if (!manifest) throw new Error("Backup not found");

  const backupPath = path.join(BACKUP_DIR, `${backupId}.tar.gz`);
  if (!fs.existsSync(backupPath)) throw new Error("Backup file missing");

  const baseDir = path.join(process.cwd(), "..");

  try {
    execSync(`cd "${baseDir}" && tar -xzf "${backupPath}"`, { stdio: "pipe" });
  } catch (err: any) {
    throw new Error(`Restore failed: ${err.message}`);
  }

  return { restored: manifest.files.length, files: manifest.files };
}

// ─── List backups ───────────────────────────────────────────────────────
export function listBackups(): BackupManifest[] {
  return loadManifests();
}

// ─── Delete old backups ─────────────────────────────────────────────────
export function deleteBackup(backupId: string): boolean {
  const manifests = loadManifests();
  const idx = manifests.findIndex((m) => m.id === backupId);
  if (idx === -1) return false;

  const backupPath = path.join(BACKUP_DIR, `${backupId}.tar.gz`);
  if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

  manifests.splice(idx, 1);
  saveManifests(manifests);
  return true;
}

// ─── Auto-backup (call from cron/scheduler) ─────────────────────────────
export async function autoBackup(): Promise<BackupManifest> {
  const manifest = createBackup("full", "system", "Automatic daily backup");
  await addAuditLog({
    userId: "system",
    username: "system",
    action: "settings_updated",
    target: `backup:${manifest.id}`,
    detail: `Auto backup: ${manifest.files.length} files, ${Math.round(manifest.sizeBytes / 1024)}KB`,
  });
  return manifest;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
