import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import { ILogUtil } from "./log";

export interface IGoogleServiceAccountPubsub {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface IAllSecrets {
  apiKey: string;
  cookieSecret: string;
  webpushrKey: string;
  webpushrAuthToken: string;
  cryptoKey: string;
  appleAppSharedSecret: string;
  applePrivateKey: string;
  appleKeyId: string;
  appleIssuerId: string;
  googleServiceAccountPubsub: IGoogleServiceAccountPubsub;
  openAiKey: string;
  anthropicApiKey: string;
  applePromotionalOfferKeyId: string;
  applePromotionalOfferPrivateKey: string;
  updatesPrivateKey: string;
}

export interface ISecretsUtil {
  getCookieSecret(): Promise<string>;
  getCryptoKey(): Promise<string>;
  getApiKey(): Promise<string>;
  getWebpushrKey(): Promise<string>;
  getWebpushrAuthToken(): Promise<string>;
  getAppleAppSharedSecret(): Promise<string>;
  getApplePrivateKey(): Promise<string>;
  getAppleKeyId(): Promise<string>;
  getAppleIssuerId(): Promise<string>;
  getGoogleServiceAccountPubsub(): Promise<IGoogleServiceAccountPubsub>;
  getOpenAiKey(): Promise<string>;
  getAnthropicKey(): Promise<string>;
  getApplePromotionalOfferKeyId(): Promise<string>;
  getApplePromotionalOfferPrivateKey(): Promise<string>;
  getUpdatesPrivateKey(): Promise<string>;
}

type IGeneratedSecretKey = "cookieSecret" | "cryptoKey" | "apiKey" | "updatesPrivateKey";

const GENERATED_SECRET_ENV_VARS: Record<IGeneratedSecretKey, string> = {
  cookieSecret: "COOKIE_SECRET",
  cryptoKey: "CRYPTO_KEY",
  apiKey: "API_KEY",
  updatesPrivateKey: "UPDATES_PRIVATE_KEY",
};

const EMPTY_GOOGLE_SERVICE_ACCOUNT: IGoogleServiceAccountPubsub = {
  type: "",
  project_id: "",
  private_key_id: "",
  private_key: "",
  client_email: "",
  client_id: "",
  auth_uri: "",
  token_uri: "",
  auth_provider_x509_cert_url: "",
  client_x509_cert_url: "",
};

export function resolveSecretsPath(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  return env.SECRETS_PATH || path.join(cwd, "secrets.json");
}

function readSecretsFile(filePath: string): Partial<IAllSecrets> {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw e;
  }
}

function writeSecretsFile(filePath: string, secrets: Partial<IAllSecrets>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function generateRandomSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateUpdatesPrivateKey(): string {
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return privateKey as unknown as string;
}

export class SecretsUtil implements ISecretsUtil {
  private readonly cache: Partial<IAllSecrets> = {};
  private loaded = false;

  constructor(
    public readonly log: ILogUtil,
    private readonly secretsPath: string = resolveSecretsPath()
  ) {}

  private ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const stored = readSecretsFile(this.secretsPath);
    let changed = false;

    for (const key of Object.keys(GENERATED_SECRET_ENV_VARS) as IGeneratedSecretKey[]) {
      const envValue = process.env[GENERATED_SECRET_ENV_VARS[key]];
      if (envValue) {
        continue;
      }
      if (!stored[key]) {
        stored[key] = (key === "updatesPrivateKey" ? generateUpdatesPrivateKey() : generateRandomSecret()) as never;
        this.log.log("Secrets: generated new", key);
        changed = true;
      }
    }

    if (changed) {
      writeSecretsFile(this.secretsPath, stored);
    }
    Object.assign(this.cache, stored);
  }

  private async getGeneratedSecret(key: IGeneratedSecretKey): Promise<string> {
    this.ensureLoaded();
    const envValue = process.env[GENERATED_SECRET_ENV_VARS[key]];
    if (envValue) {
      return envValue;
    }
    return (this.cache[key] as string | undefined) ?? "";
  }

  private async getOptionalSecret<T extends keyof IAllSecrets>(key: T): Promise<IAllSecrets[T] | ""> {
    this.ensureLoaded();
    return (this.cache[key] as IAllSecrets[T] | undefined) ?? "";
  }

  public async getCookieSecret(): Promise<string> {
    return this.getGeneratedSecret("cookieSecret");
  }

  public async getCryptoKey(): Promise<string> {
    return this.getGeneratedSecret("cryptoKey");
  }

  public async getApiKey(): Promise<string> {
    return this.getGeneratedSecret("apiKey");
  }

  public async getUpdatesPrivateKey(): Promise<string> {
    return this.getGeneratedSecret("updatesPrivateKey");
  }

  public async getWebpushrKey(): Promise<string> {
    return this.getOptionalSecret("webpushrKey");
  }

  public async getWebpushrAuthToken(): Promise<string> {
    return this.getOptionalSecret("webpushrAuthToken");
  }

  public async getAppleAppSharedSecret(): Promise<string> {
    return this.getOptionalSecret("appleAppSharedSecret");
  }

  public async getApplePrivateKey(): Promise<string> {
    return this.getOptionalSecret("applePrivateKey");
  }

  public async getAppleKeyId(): Promise<string> {
    return this.getOptionalSecret("appleKeyId");
  }

  public async getAppleIssuerId(): Promise<string> {
    return this.getOptionalSecret("appleIssuerId");
  }

  public async getApplePromotionalOfferKeyId(): Promise<string> {
    return this.getOptionalSecret("applePromotionalOfferKeyId");
  }

  public async getApplePromotionalOfferPrivateKey(): Promise<string> {
    return this.getOptionalSecret("applePromotionalOfferPrivateKey");
  }

  public async getOpenAiKey(): Promise<string> {
    return this.getOptionalSecret("openAiKey");
  }

  public async getAnthropicKey(): Promise<string> {
    return this.getOptionalSecret("anthropicApiKey");
  }

  public async getGoogleServiceAccountPubsub(): Promise<IGoogleServiceAccountPubsub> {
    this.ensureLoaded();
    return this.cache.googleServiceAccountPubsub ?? EMPTY_GOOGLE_SERVICE_ACCOUNT;
  }
}
