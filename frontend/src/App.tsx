import { useEffect, useState } from "react";
import {
  deleteBaseloadConfig,
  fetchBaseloadConfigs,
  fetchBaseloadState,
  loadBaseloadConfig,
  saveBaseloadConfig,
  updateBaseloadConfig as putBaseloadConfig,
  verifyAdminToken,
  type BaseloadStateResponse,
  type BaseloadTaskStatus,
  type BaseloadWorkerBalance,
  type StoredBaseloadConfigSummary
} from "./api";
import { BaseloadView } from "./BaseloadView";
import { EMPTY_BASELOAD_CONFIG, type BaseloadConfig } from "./baseloadConfig";
import { readStoredString, writeStoredString } from "./localStorage";

const BASELOAD_ADMIN_TOKEN_STORAGE_KEY = "baseload.adminBearerToken";
const TOKEN_SYMBOL = import.meta.env.VITE_TOKEN_SYMBOL ?? "ETH";

export function App() {
  const [baseloadConfig, setBaseloadConfig] = useState<BaseloadConfig>(EMPTY_BASELOAD_CONFIG);
  const [baseloadTaskStatuses, setBaseloadTaskStatuses] = useState<Record<string, BaseloadTaskStatus>>({});
  const [baseloadBalances, setBaseloadBalances] = useState<Record<string, BaseloadWorkerBalance>>({});
  const [baseloadError, setBaseloadError] = useState<string | null>(null);
  const [baseloadSavedConfigs, setBaseloadSavedConfigs] = useState<StoredBaseloadConfigSummary[]>([]);
  const [baseloadConfigManagerError, setBaseloadConfigManagerError] = useState<string | null>(null);
  const [baseloadAdminToken, setBaseloadAdminToken] = useState(() =>
    readStoredString(BASELOAD_ADMIN_TOKEN_STORAGE_KEY, "")
  );
  const [verifiedAdminToken, setVerifiedAdminToken] = useState("");

  const trimmedAdminToken = baseloadAdminToken.trim();
  const adminVerified = trimmedAdminToken !== "" && trimmedAdminToken === verifiedAdminToken;

  useEffect(() => {
    writeStoredString(BASELOAD_ADMIN_TOKEN_STORAGE_KEY, baseloadAdminToken);
  }, [baseloadAdminToken]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const state = await fetchBaseloadState();
        if (cancelled) return;
        applyBaseloadState(state);
      } catch (error) {
        if (!cancelled) {
          setBaseloadError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const body = await fetchBaseloadConfigs(adminBearerToken());
        if (cancelled) return;
        setBaseloadSavedConfigs(body.configs);
        setBaseloadConfigManagerError(null);
      } catch (error) {
        if (!cancelled) {
          setBaseloadSavedConfigs([]);
          setBaseloadConfigManagerError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [baseloadAdminToken, verifiedAdminToken]);

  useEffect(() => {
    if (!trimmedAdminToken) {
      setVerifiedAdminToken("");
      return;
    }
    let cancelled = false;
    verifyAdminToken(trimmedAdminToken)
      .then(() => {
        if (!cancelled) setVerifiedAdminToken(trimmedAdminToken);
      })
      .catch(() => {
        if (!cancelled) setVerifiedAdminToken("");
      });
    return () => {
      cancelled = true;
    };
  }, [trimmedAdminToken]);

  const adminBearerToken = () => (adminVerified ? trimmedAdminToken : undefined);

  const applyBaseloadState = (state: BaseloadStateResponse) => {
    setBaseloadConfig(state.config);
    setBaseloadTaskStatuses(state.statuses);
    setBaseloadBalances(state.balances ?? {});
    setBaseloadError(state.enabled ? null : "BASELOAD_RPC_NODE is not configured on the backend");
  };

  const updateBaseloadConfig = async (config: BaseloadConfig) => {
    try {
      applyBaseloadState(await putBaseloadConfig(config, adminBearerToken()));
    } catch (error) {
      setBaseloadError(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshBaseloadSavedConfigs = async () => {
    const body = await fetchBaseloadConfigs(adminBearerToken());
    setBaseloadSavedConfigs(body.configs);
    setBaseloadConfigManagerError(null);
  };

  const saveCurrentBaseloadConfig = async (name: string) => {
    try {
      await saveBaseloadConfig(name, baseloadConfig, adminBearerToken());
      await refreshBaseloadSavedConfigs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseloadConfigManagerError(message);
      throw new Error(message);
    }
  };

  const loadSavedBaseloadConfig = async (name: string) => {
    try {
      applyBaseloadState(await loadBaseloadConfig(name, adminBearerToken()));
      await refreshBaseloadSavedConfigs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseloadConfigManagerError(message);
      throw new Error(message);
    }
  };

  const deleteSavedBaseloadConfig = async (name: string) => {
    try {
      await deleteBaseloadConfig(name, adminBearerToken());
      await refreshBaseloadSavedConfigs();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseloadConfigManagerError(message);
      throw new Error(message);
    }
  };

  return (
    <>
      <header>
        <div className="header-inner">
          <h1>
            <span className="brand-name">Atlas</span>
            <span className="brand-sub">Baseload Generator</span>
          </h1>
        </div>
      </header>
      <main className="contained">
        <BaseloadView
          config={baseloadConfig}
          onConfigChange={updateBaseloadConfig}
          taskStatuses={baseloadTaskStatuses}
          balances={baseloadBalances}
          backendError={baseloadError}
          adminToken={baseloadAdminToken}
          onAdminTokenChange={setBaseloadAdminToken}
          savedConfigs={baseloadSavedConfigs}
          configManagerError={baseloadConfigManagerError}
          onRefreshSavedConfigs={refreshBaseloadSavedConfigs}
          onSaveCurrentConfig={saveCurrentBaseloadConfig}
          onLoadSavedConfig={loadSavedBaseloadConfig}
          onDeleteSavedConfig={deleteSavedBaseloadConfig}
          tokenSymbol={TOKEN_SYMBOL}
        />
      </main>
    </>
  );
}
