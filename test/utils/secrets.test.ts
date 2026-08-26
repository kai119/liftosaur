import "mocha";
import { expect } from "chai";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SecretsUtil, resolveSecretsPath } from "../../lambda/utils/secrets";
import { MockLogUtil } from "./mockLogUtil";

function tempSecretsPath(...segments: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lft-secrets-test-"));
  return path.join(dir, ...segments);
}

describe("resolveSecretsPath", () => {
  it("defaults to secrets.json in the given working directory when SECRETS_PATH is not set", () => {
    expect(resolveSecretsPath({}, "/tmp/some-cwd")).to.equal(path.join("/tmp/some-cwd", "secrets.json"));
  });

  it("uses SECRETS_PATH when set, ignoring the working directory", () => {
    expect(resolveSecretsPath({ SECRETS_PATH: "/custom/secrets.json" }, "/tmp/some-cwd")).to.equal(
      "/custom/secrets.json"
    );
  });
});

describe("SecretsUtil (local file-backed)", () => {
  const envKeysToRestore = ["COOKIE_SECRET", "CRYPTO_KEY", "API_KEY", "UPDATES_PRIVATE_KEY"] as const;
  const savedEnv: Partial<Record<(typeof envKeysToRestore)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of envKeysToRestore) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeysToRestore) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("generates and persists cookieSecret, cryptoKey, apiKey, and updatesPrivateKey on first run", async () => {
    const secretsPath = tempSecretsPath("secrets.json");
    const secrets = new SecretsUtil(new MockLogUtil(), secretsPath);

    const cookieSecret = await secrets.getCookieSecret();
    const cryptoKey = await secrets.getCryptoKey();
    const apiKey = await secrets.getApiKey();
    const updatesPrivateKey = await secrets.getUpdatesPrivateKey();

    expect(cookieSecret).to.match(/^[0-9a-f]{32,}$/);
    expect(cryptoKey).to.match(/^[0-9a-f]{32,}$/);
    expect(apiKey).to.match(/^[0-9a-f]{32,}$/);
    expect(updatesPrivateKey).to.match(/^-----BEGIN PRIVATE KEY-----/);

    expect(fs.existsSync(secretsPath)).to.equal(true);
    const persisted = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    expect(persisted.cookieSecret).to.equal(cookieSecret);
    expect(persisted.cryptoKey).to.equal(cryptoKey);
    expect(persisted.apiKey).to.equal(apiKey);
    expect(persisted.updatesPrivateKey).to.equal(updatesPrivateKey);
  });

  it("reuses previously generated secrets across instances, surviving a restart", async () => {
    const secretsPath = tempSecretsPath("secrets.json");
    const first = new SecretsUtil(new MockLogUtil(), secretsPath);
    const originalCookieSecret = await first.getCookieSecret();

    const second = new SecretsUtil(new MockLogUtil(), secretsPath);
    const reloadedCookieSecret = await second.getCookieSecret();

    expect(reloadedCookieSecret).to.equal(originalCookieSecret);
  });

  it("creates the secrets file and its parent directory with restrictive permissions", async () => {
    const secretsPath = tempSecretsPath("nested-dir", "secrets.json");
    const secrets = new SecretsUtil(new MockLogUtil(), secretsPath);
    await secrets.getCookieSecret();

    const fileMode = fs.statSync(secretsPath).mode.toString(8).slice(-3);
    const dirMode = fs.statSync(path.dirname(secretsPath)).mode.toString(8).slice(-3);
    expect(fileMode).to.equal("600");
    expect(dirMode).to.equal("700");
  });

  it("does not regenerate a secret already present in the secrets file", async () => {
    const secretsPath = tempSecretsPath("secrets.json");
    fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
    fs.writeFileSync(secretsPath, JSON.stringify({ cookieSecret: "existing-cookie-secret" }));

    const secrets = new SecretsUtil(new MockLogUtil(), secretsPath);
    const cookieSecret = await secrets.getCookieSecret();
    const apiKey = await secrets.getApiKey();

    expect(cookieSecret).to.equal("existing-cookie-secret");
    expect(apiKey).to.match(/^[0-9a-f]{32,}$/);

    const persisted = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    expect(persisted.cookieSecret).to.equal("existing-cookie-secret");
    expect(persisted.apiKey).to.equal(apiKey);
  });

  it("prefers an environment variable over the persisted file value, without persisting the override", async () => {
    process.env.COOKIE_SECRET = "env-provided-cookie-secret";
    const secretsPath = tempSecretsPath("secrets.json");
    const secrets = new SecretsUtil(new MockLogUtil(), secretsPath);

    const cookieSecret = await secrets.getCookieSecret();
    await secrets.getApiKey();

    expect(cookieSecret).to.equal("env-provided-cookie-secret");
    const persisted = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    expect(persisted.cookieSecret).to.equal(undefined);
  });

  it("produces an updatesPrivateKey that can sign data verifiable with its derived public key", async () => {
    const secretsPath = tempSecretsPath("secrets.json");
    const secrets = new SecretsUtil(new MockLogUtil(), secretsPath);
    const privateKey = await secrets.getUpdatesPrivateKey();

    const publicKey = crypto.createPublicKey(privateKey);
    const signer = crypto.createSign("RSA-SHA256");
    signer.update("hello world");
    signer.end();
    const signature = signer.sign(privateKey);

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update("hello world");
    verifier.end();
    expect(verifier.verify(publicKey, signature)).to.equal(true);
  });

  it("never logs secret values, only that a secret was generated", async () => {
    const secretsPath = tempSecretsPath("secrets.json");
    const log = new MockLogUtil();
    const secrets = new SecretsUtil(log, secretsPath);

    const cookieSecret = await secrets.getCookieSecret();
    const cryptoKey = await secrets.getCryptoKey();
    const apiKey = await secrets.getApiKey();
    const updatesPrivateKey = await secrets.getUpdatesPrivateKey();

    const logText = log.logs.join("\n");
    expect(logText).to.not.include(cookieSecret);
    expect(logText).to.not.include(cryptoKey);
    expect(logText).to.not.include(apiKey);
    expect(logText).to.not.include(updatesPrivateKey);
  });

  it("returns empty defaults for secrets whose features were not configured locally", async () => {
    const secretsPath = tempSecretsPath("secrets.json");
    const secrets = new SecretsUtil(new MockLogUtil(), secretsPath);

    expect(await secrets.getWebpushrKey()).to.equal("");
    expect(await secrets.getAppleAppSharedSecret()).to.equal("");
    expect(await secrets.getOpenAiKey()).to.equal("");
    expect(await secrets.getAnthropicKey()).to.equal("");
    expect((await secrets.getGoogleServiceAccountPubsub()).client_email).to.equal("");
  });
});
