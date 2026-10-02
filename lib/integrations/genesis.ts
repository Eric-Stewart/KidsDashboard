import "server-only";
// School login stays in the local collector. The web server accepts only validated imports.
export { importGenesisBrowser } from "../import-genesis-browser";
export const genesisIntegration = { source: "local-browser", endpoint: "/api/genesis/import" } as const;
