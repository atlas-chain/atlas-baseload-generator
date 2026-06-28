import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Database } from "bun:sqlite";
import { normalizeBaseloadConfig, type BaseloadConfig } from "./baseloadConfig";

export interface StoredBaseloadConfigSummary {
  name: string;
  workerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredBaseloadConfig extends StoredBaseloadConfigSummary {
  config: BaseloadConfig;
}

export class BaseloadConfigStore {
  private constructor(
    private readonly db: Database,
    private readonly mnemonic: string
  ) {}

  static async open(databasePath: string, mnemonic: string): Promise<BaseloadConfigStore> {
    await mkdir(path.dirname(databasePath), { recursive: true });
    const db = new Database(databasePath, { create: true });
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
    db.run(`
      CREATE TABLE IF NOT EXISTS baseload_configs (
        name TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `);
    return new BaseloadConfigStore(db, mnemonic);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async list(): Promise<StoredBaseloadConfigSummary[]> {
    const rows = this.db
      .query<BaseloadConfigRow, []>(
        `SELECT name, config_json, created_at, updated_at
         FROM baseload_configs
         ORDER BY name ASC`
      )
      .all();
    return rows.map((row) => mapSummaryRow(row, this.mnemonic));
  }

  async get(name: string): Promise<StoredBaseloadConfig | undefined> {
    const row = this.db
      .query<BaseloadConfigRow, [string]>(
        `SELECT name, config_json, created_at, updated_at
         FROM baseload_configs
         WHERE name = ?`
      )
      .get(name);
    return row ? mapConfigRow(row, this.mnemonic) : undefined;
  }

  async save(name: string, config: BaseloadConfig): Promise<StoredBaseloadConfig> {
    const normalized = normalizeBaseloadConfig(config, this.mnemonic);
    this.db
      .query<never, [string, string]>(
        `INSERT INTO baseload_configs (name, config_json, created_at, updated_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(name) DO UPDATE SET
           config_json = excluded.config_json,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
      )
      .run(name, JSON.stringify(normalized));

    const saved = await this.get(name);
    if (!saved) throw new Error("Failed to save Baseload config");
    return saved;
  }

  async delete(name: string): Promise<boolean> {
    const result = this.db.query<never, [string]>("DELETE FROM baseload_configs WHERE name = ?").run(name);
    return result.changes > 0;
  }
}

interface BaseloadConfigRow {
  name: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

function mapSummaryRow(row: BaseloadConfigRow, mnemonic: string): StoredBaseloadConfigSummary {
  const config = normalizeBaseloadConfig(JSON.parse(row.config_json), mnemonic);
  return {
    name: row.name,
    workerCount: config.workers.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConfigRow(row: BaseloadConfigRow, mnemonic: string): StoredBaseloadConfig {
  return {
    ...mapSummaryRow(row, mnemonic),
    config: normalizeBaseloadConfig(JSON.parse(row.config_json), mnemonic),
  };
}
