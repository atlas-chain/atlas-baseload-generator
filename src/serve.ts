import { BaseloadConfigStore } from "./configStore";
import { parseBaseloadRuntimeConfig, readBaseloadConfigFile } from "./baseloadConfig";
import { BaseloadRuntime } from "./baseloadRuntime";
import { createBaseloadServer } from "./server";
import { parseServerConfig, ServerHelpRequested } from "./serverConfig";

async function main(): Promise<void> {
  let baseloadRuntime: BaseloadRuntime | undefined;

  try {
    const config = parseServerConfig(process.argv.slice(2));
    const baseloadRuntimeConfig = parseBaseloadRuntimeConfig();
    baseloadRuntime = new BaseloadRuntime(baseloadRuntimeConfig);

    if (config.baseloadInitialConfigPath) {
      const initialConfig = await readBaseloadConfigFile(
        config.baseloadInitialConfigPath,
        baseloadRuntimeConfig.mnemonic
      );
      baseloadRuntime.updateConfig(initialConfig);
      console.log(
        `Loaded initial Baseload config from ${config.baseloadInitialConfigPath} (${initialConfig.workers.length} workers)`
      );
    }

    const configStore = new BaseloadConfigStore(config.baseloadConfigDir, baseloadRuntimeConfig.mnemonic);
    const server = createBaseloadServer({
      port: config.port,
      ...(config.hostname !== undefined ? { hostname: config.hostname } : {}),
      baseloadRuntime,
      configStore,
      ...(config.baseloadAdminBearerToken !== undefined
        ? { baseloadAdminBearerToken: config.baseloadAdminBearerToken }
        : {})
    });
    console.log(`Baseload server listening on http://${server.hostname}:${server.port}`);
    console.log(`Baseload RPC: ${baseloadRuntimeConfig.rpcUrl ? "configured" : "not configured"}`);

    const shutdown = async () => {
      baseloadRuntime?.stop();
      await server.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    if (error instanceof ServerHelpRequested) {
      console.log(error.message);
      return;
    }

    console.error(error);
    baseloadRuntime?.stop();
    process.exitCode = 1;
  }
}

await main();
