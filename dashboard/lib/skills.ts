import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string; // productivity, communication, data, finance, devops, custom
  installedOn: string[]; // agent IDs
  enabled: boolean;
  config?: Record<string, any>;
  source: "bundled" | "community" | "custom";
  installDate: string;
  lastUpdated: string;
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  downloads: number;
  rating: number;
  source: "community";
}

// ─── Store ──────────────────────────────────────────────────────────────
const SKILLS_FILE =
  process.env.SKILLS_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "skills.json");

function ensureDir() {
  const dir = path.dirname(SKILLS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load(): Skill[] {
  ensureDir();
  if (!fs.existsSync(SKILLS_FILE)) return getDefaultSkills();
  return JSON.parse(fs.readFileSync(SKILLS_FILE, "utf-8"));
}

function save(skills: Skill[]): void {
  ensureDir();
  fs.writeFileSync(SKILLS_FILE, JSON.stringify(skills, null, 2));
}

function getDefaultSkills(): Skill[] {
  return [
    { id: "skill-gmail", name: "Gmail", description: "Read/send emails via Gmail API", version: "1.0.0", author: "openclaw", category: "communication", installedOn: ["claw-1", "claw-5"], enabled: true, source: "bundled", installDate: new Date().toISOString(), lastUpdated: new Date().toISOString() },
    { id: "skill-calendar", name: "Google Calendar", description: "Manage calendar events", version: "1.0.0", author: "openclaw", category: "productivity", installedOn: ["claw-1", "claw-6"], enabled: true, source: "bundled", installDate: new Date().toISOString(), lastUpdated: new Date().toISOString() },
    { id: "skill-browser", name: "Browser Control", description: "Web browsing, screenshots, form filling", version: "1.2.0", author: "openclaw", category: "productivity", installedOn: ["claw-3", "claw-4"], enabled: true, source: "bundled", installDate: new Date().toISOString(), lastUpdated: new Date().toISOString() },
    { id: "skill-github", name: "GitHub", description: "PRs, issues, code review", version: "1.0.0", author: "openclaw", category: "devops", installedOn: ["claw-4"], enabled: true, source: "bundled", installDate: new Date().toISOString(), lastUpdated: new Date().toISOString() },
  ];
}

// ─── CRUD ───────────────────────────────────────────────────────────────
export function listSkills(): Skill[] { return load(); }

export function installSkill(agentId: string, skillId: string): boolean {
  const skills = load();
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return false;
  if (!skill.installedOn.includes(agentId)) {
    skill.installedOn.push(agentId);
    save(skills);
  }
  return true;
}

export function uninstallSkill(agentId: string, skillId: string): boolean {
  const skills = load();
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return false;
  skill.installedOn = skill.installedOn.filter((id) => id !== agentId);
  save(skills);
  return true;
}

export function addCustomSkill(skill: Omit<Skill, "id" | "installDate" | "lastUpdated">): Skill {
  const skills = load();
  const full: Skill = {
    ...skill,
    id: `skill-custom-${Date.now()}`,
    installDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
  skills.push(full);
  save(skills);
  return full;
}

export function getSkillsForAgent(agentId: string): Skill[] {
  return load().filter((s) => s.installedOn.includes(agentId) && s.enabled);
}
