import { CliHelpRequested, coercePort, parseCli, type CliSpec } from "./cli";

export interface ServerConfig {
  port: number;
  hostname?: string;
  baseloadAdminBearerToken?: string;
  baseloadInitialConfigPath?: string;
  baseloadConfigDir: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_CONFIG_DIR = "baseload-config";

export class ServerHelpRequested extends CliHelpRequested {}

const SPEC: CliSpec = {
  name: "serve",
  summary: "BASELOAD_RPC_NODE=http://node:8545 bun run serve",
  options: [
    {
      flags: "--port <port>",
      description: "TCP port to listen on. Defaults to 3000 (or SERVER_PORT).",
      env: ["SERVER_PORT"],
      default: DEFAULT_PORT.toString()
    },
    {
      flags: "--host <host>",
      description: "Hostname/interface to bind. Defaults to Bun's default.",
      env: ["SERVER_HOSTNAME"]
    },
    {
      flags: "--baseload-admin-bearer-token <token>",
      description:
        "Bearer token required for mutating Baseload requests. Defaults to BASELOAD_ADMIN_BEARER_TOKEN. If unset, mutations are unrestricted.",
      env: ["BASELOAD_ADMIN_BEARER_TOKEN"]
    },
    {
      flags: "--baseload-initial-config <path>",
      description:
        "Optional Baseload worker config JSON file to load once at backend startup. Defaults to BASELOAD_INITIAL_CONFIG_PATH.",
      env: ["BASELOAD_INITIAL_CONFIG_PATH"]
    },
    {
      flags: "--baseload-config-dir <path>",
      description:
        "Directory for saved Baseload config JSON files. Defaults to BASELOAD_CONFIG_DIR or baseload-config.",
      env: ["BASELOAD_CONFIG_DIR"],
      default: DEFAULT_CONFIG_DIR
    }
  ]
};

export function parseServerConfig(args: string[], env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const cli = parseCli(SPEC, args, env);

  if (cli.helpRequested) {
    throw new ServerHelpRequested(cli.helpText);
  }

  const port = coercePort("--port", cli.value("port")!);
  const hostname = cli.value("host");
  const baseloadAdminBearerToken = cli.value("baseload-admin-bearer-token");
  const baseloadInitialConfigPath = cli.value("baseload-initial-config");
  const baseloadConfigDir = cli.value("baseload-config-dir") || DEFAULT_CONFIG_DIR;

  return {
    port,
    ...(hostname ? { hostname } : {}),
    ...(baseloadAdminBearerToken ? { baseloadAdminBearerToken } : {}),
    ...(baseloadInitialConfigPath ? { baseloadInitialConfigPath } : {}),
    baseloadConfigDir
  };
}
