import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class DiagnosticStore {
  constructor({ filePath = path.join(process.cwd(), 'data', 'diagnostics.json') } = {}) {
    this.filePath = filePath;
    this.sessions = new Map();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    try {
      const payload = JSON.parse(await readFile(this.filePath, 'utf8'));
      for (const session of payload.sessions ?? []) this.sessions.set(session.id, session);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }

  async persist() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify({ sessions: [...this.sessions.values()] }, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }

  async create(metadata = {}) {
    await this.load();
    const now = new Date().toISOString();
    const session = {
      id: crypto.randomUUID(),
      version: 'DIAG30-v2.1',
      created_at: now,
      updated_at: now,
      metadata,
      answers: [],
      consent: null,
      evidence_request: null,
      score: null
    };
    this.sessions.set(session.id, session);
    await this.persist();
    return structuredClone(session);
  }

  async get(id) {
    await this.load();
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async update(id, updater) {
    await this.load();
    const current = this.sessions.get(id);
    if (!current) return null;
    const next = await updater(structuredClone(current));
    next.updated_at = new Date().toISOString();
    this.sessions.set(id, next);
    await this.persist();
    return structuredClone(next);
  }
}
