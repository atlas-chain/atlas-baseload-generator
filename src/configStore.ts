import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBaseloadConfig, serializeBaseloadConfig, type BaseloadConfig } from "./baseloadConfig";

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
  constructor(
    private readonly configDir: string,
    private readonly mnemonic: string
  ) {}

  async list(): Promise<StoredBaseloadConfigSummary[]> {
    await mkdir(this.configDir, { recursive: true });
    const entries = await readdir(this.configDir, { withFileTypes: true });
    const configs = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const name = decodeFileName(entry.name);
          const [json, stats] = await Promise.all([readFile(this.filePath(name), "utf8"), stat(this.filePath(name))]);
          const config = normalizeBaseloadConfig(JSON.parse(json), this.mnemonic);
          return {
            name,
            workerCount: config.workers.length,
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString()
          };
        })
    );
    return configs.sort((a, b) => a.name.localeCompare(b.name));
  }

  async get(name: string): Promise<StoredBaseloadConfig | undefined> {
    const filePath = this.filePath(name);
    let json: string;
    let stats;
    try {
      [json, stats] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    } catch (error) {
      if (isNotFoundError(error)) return undefined;
      throw error;
    }
    const config = normalizeBaseloadConfig(JSON.parse(json), this.mnemonic);
    return {
      name,
      workerCount: config.workers.length,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      config
    };
  }

  async save(name: string, config: BaseloadConfig): Promise<StoredBaseloadConfig> {
    await mkdir(this.configDir, { recursive: true });
    const normalized = normalizeBaseloadConfig(config, this.mnemonic);
    await writeFile(this.filePath(name), serializeBaseloadConfig(normalized), "utf8");
    const saved = await this.get(name);
    if (!saved) throw new Error("Failed to save Baseload config");
    return saved;
  }

  async delete(name: string): Promise<boolean> {
    try {
      await rm(this.filePath(name));
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  private filePath(name: string): string {
    return path.join(this.configDir, `${encodeFileName(name)}.json`);
  }
}

function encodeFileName(name: string): string {
  return encodeURIComponent(name).replaceAll("%20", "+");
}

function decodeFileName(fileName: string): string {
  return decodeURIComponent(fileName.slice(0, -".json".length).replaceAll("+", "%20"));
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
