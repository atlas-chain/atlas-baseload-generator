export const BASELOAD_WORKER_BEHAVIORS = [
  "create",
  "create-update",
  "create-ownership",
  "time-bomb",
  "create-update-delete"
] as const;

export type BaseloadWorkerBehavior = (typeof BASELOAD_WORKER_BEHAVIORS)[number];

export interface BaseloadWorkerConfig {
  id: string;
  behavior: BaseloadWorkerBehavior;
  maxGasPriceGwei: number;
  opsPerMinute: number;
  entitiesPerRequest: number;
  singleCreatePayloadSize: number;
  singleCreateStringArgumentCount: number;
  singleCreateNumberArgumentCount: number;
  entityPoolSize: number;
  timeBombOffsetSeconds: number;
  walletNumber: number;
  walletAddress: string;
  startBlock: number;
  endBlock: number | null;
  durationSeconds: number | null;
  ttlSeconds: number;
}

export interface BaseloadConfig {
  version: 2;
  workers: BaseloadWorkerConfig[];
}

export interface BaseloadTaskStatus {
  workerId: string;
  walletNumber: number;
  status: "starting" | "ready" | "updated" | "running" | "waiting" | "completed" | "error" | "stopped";
  updatedAt: string;
  currentBlock?: number;
  message?: string;
  attemptedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  ownershipChangedCount?: number;
  poolSize?: number;
  detonationAt?: string;
  entityKey?: string;
  txHash?: string;
}

export interface BaseloadWorkerBalance {
  balanceWei: string;
  updatedAt: string;
  error?: string;
}

export interface BaseloadStateResponse {
  enabled: boolean;
  config: BaseloadConfig;
  statuses: Record<string, BaseloadTaskStatus>;
  balances: Record<string, BaseloadWorkerBalance>;
}

export interface StoredBaseloadConfigSummary {
  name: string;
  workerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredBaseloadConfig extends StoredBaseloadConfigSummary {
  config: BaseloadConfig;
}

export interface BaseloadConfigsResponse {
  configs: StoredBaseloadConfigSummary[];
}

interface AdminVerifyResponse {
  authorized: true;
}

const API_BASE = "/api";

export async function verifyAdminToken(adminBearerToken: string): Promise<AdminVerifyResponse> {
  const response = await fetch(`${API_BASE}/admin/verify`, {
    headers: { Authorization: `Bearer ${adminBearerToken}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<AdminVerifyResponse>;
}

export function fetchBaseloadState(): Promise<BaseloadStateResponse> {
  return getJson<BaseloadStateResponse>("/baseload");
}

export function updateBaseloadConfig(
  config: BaseloadConfig,
  adminBearerToken?: string
): Promise<BaseloadStateResponse> {
  return sendJson<BaseloadStateResponse>("PUT", "/baseload", config, adminBearerToken);
}

export function fetchBaseloadConfigs(adminBearerToken?: string): Promise<BaseloadConfigsResponse> {
  return getJson<BaseloadConfigsResponse>("/baseload/configs", adminBearerToken);
}

export function saveBaseloadConfig(
  name: string,
  config: BaseloadConfig,
  adminBearerToken?: string
): Promise<StoredBaseloadConfig> {
  return sendJson<StoredBaseloadConfig>(
    "PUT",
    `/baseload/configs/${encodeURIComponent(name)}`,
    config,
    adminBearerToken
  );
}

export function loadBaseloadConfig(
  name: string,
  adminBearerToken?: string
): Promise<BaseloadStateResponse> {
  return sendJson<BaseloadStateResponse>(
    "PUT",
    `/baseload/configs/${encodeURIComponent(name)}/load`,
    {},
    adminBearerToken
  );
}

export function deleteBaseloadConfig(
  name: string,
  adminBearerToken?: string
): Promise<{ deleted: boolean }> {
  return sendJson<{ deleted: boolean }>(
    "DELETE",
    `/baseload/configs/${encodeURIComponent(name)}`,
    undefined,
    adminBearerToken
  );
}

async function getJson<T>(path: string, adminBearerToken?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: adminBearerToken ? { Authorization: `Bearer ${adminBearerToken}` } : undefined
  });
  return readJsonResponse<T>(response);
}

async function sendJson<T>(
  method: "PUT" | "DELETE",
  path: string,
  body?: unknown,
  adminBearerToken?: string
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (adminBearerToken) headers.Authorization = `Bearer ${adminBearerToken}`;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return readJsonResponse<T>(response);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}
