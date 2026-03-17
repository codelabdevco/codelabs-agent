import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { User, Session, Role } from "./auth-types";

// ─── Password hashing (scrypt) ──────────────────────────────────────────
const SALT_LEN = 16;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

// ─── Session tokens ─────────────────────────────────────────────────────
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map<string, Session>();

export function createSession(userId: string, role: Role): Session {
  const token = crypto.randomBytes(32).toString("hex");
  const session: Session = {
    token,
    userId,
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(token, session);
  return session;
}

export function validateSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

// ─── User store (JSON file-based, production should use DB) ─────────────
const USERS_FILE =
  process.env.USERS_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "users.json");

function ensureDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadUsers(): User[] {
  ensureDir();
  if (!fs.existsSync(USERS_FILE)) {
    // Create default admin user on first run
    const defaultAdmin: User = {
      id: crypto.randomUUID(),
      username: "admin",
      displayName: "Administrator",
      role: "admin",
      passwordHash: hashPassword("admin"), // ← CHANGE THIS!
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify([defaultAdmin], null, 2));
    return [defaultAdmin];
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

export function saveUsers(users: User[]): void {
  ensureDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function findUser(username: string): User | undefined {
  return loadUsers().find((u) => u.username === username);
}

export function findUserById(id: string): User | undefined {
  return loadUsers().find((u) => u.id === id);
}

export function createUser(
  username: string,
  displayName: string,
  password: string,
  role: Role
): User {
  const users = loadUsers();
  if (users.find((u) => u.username === username)) {
    throw new Error("Username already exists");
  }
  const user: User = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

export function updateUserLastLogin(userId: string): void {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
  }
}

export function deleteUser(userId: string): boolean {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  users.splice(idx, 1);
  saveUsers(users);
  return true;
}

export function listUsers(): Omit<User, "passwordHash">[] {
  return loadUsers().map(({ passwordHash, ...u }) => u);
}
