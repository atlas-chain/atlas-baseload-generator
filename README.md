# Atlas Baseload Generator

Standalone Baseload worker generator extracted from `Arkiv-Network/arkiv-chain-indexer`.

## Run locally

```sh
bun install
bun run serve
```

In another shell:

```sh
cd frontend
npm install
npm run dev
```

The frontend proxies `/api` to `http://127.0.0.1:3000`.

## Docker Compose

```sh
ATLAS_BASELOAD_RPC_NODE=http://host.docker.internal:8545 docker compose up --build
```

The UI listens on `127.0.0.1:23560` by default. Saved worker configs are stored as JSON files in `./baseload-config`.

## Configuration

- `ATLAS_BASELOAD_RPC_NODE`: RPC endpoint used by worker wallets.
- `ATLAS_BASELOAD_MNEMONIC`: mnemonic used for worker wallet derivation.
- `ATLAS_BASELOAD_ADMIN_BEARER_TOKEN`: optional bearer token required for mutating worker configs.
- `ATLAS_BASELOAD_INITIAL_CONFIG_PATH`: optional JSON config loaded once at backend startup.
- `ATLAS_BASELOAD_CONFIG_DIR`: saved config directory, defaults to `./baseload-config` locally and `/app/baseload-config` in Docker.
- `ATLAS_BASELOAD_PAYLOAD_PROVIDER_URL`: optional payload provider URL for reference payload mode.
- `ATLAS_BASELOAD_PAYLOAD_PROVIDER_BEARER_KEY`: optional payload provider bearer token.
- `ATLAS_BASELOAD_PAYLOAD_PROVIDER_NAMESPACE`: payload provider namespace, defaults to `arkiv.entities`.
- `ATLAS_BASELOAD_PAYLOAD_PROVIDER_VERIFY_RECEIPT`: defaults to `true`.
