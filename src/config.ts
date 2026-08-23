export interface ILftStorageConfig {
  dynamoEndpoint: string;
  s3Endpoint: string;
}

export interface ILftConfig {
  isDev: boolean;
  host: string;
  apiHost: string;
  streamingApiHost: string;
  port: number;
  apiPort: number;
  streamingApiPort: number;
  metroPort: number | null;
  storage: ILftStorageConfig;
  flags: Record<string, never>;
}

declare const __LFT_CONFIG__: string | undefined;

function resolveClientConfig(): ILftConfig {
  if (typeof __LFT_CONFIG__ !== "undefined") {
    return JSON.parse(__LFT_CONFIG__);
  }

  return require("../config");
}

export const Config: ILftConfig = resolveClientConfig();
