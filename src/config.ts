// eslint-disable-next-line @typescript-eslint/no-var-requires
const resolvedConfig = require("../config");

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

export const Config: ILftConfig = resolvedConfig;
