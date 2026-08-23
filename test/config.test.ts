import "mocha";
import { expect } from "chai";
import { resolveConfig } from "../config";

describe("resolveConfig", () => {
  describe("dev mode", () => {
    it("derives host/apiHost/streamingApiHost from localdomain.default when NODE_ENV is not production", () => {
      const domains = require("../localdomain.default");
      const config = resolveConfig({});
      expect(config.isDev).to.equal(true);
      expect(config.host).to.equal(`https://${domains.main}.liftosaur.com:${domains.port}`);
      expect(config.apiHost).to.equal(`https://${domains.api}.liftosaur.com:${domains.apiPort}`);
      expect(config.streamingApiHost).to.equal(
        `https://${domains.streamingapi}.liftosaur.com:${domains.streamingApiPort}`
      );
      expect(config.port).to.equal(domains.port);
      expect(config.apiPort).to.equal(domains.apiPort);
      expect(config.streamingApiPort).to.equal(domains.streamingApiPort);
      expect(config.metroPort).to.equal(domains.metroPort);
    });

    it("defaults storage endpoints to local emulator addresses", () => {
      const config = resolveConfig({});
      expect(config.storage.dynamoEndpoint).to.equal("http://localhost:8000");
      expect(config.storage.s3Endpoint).to.equal("http://localhost:9000");
    });

    it("reads storage endpoints from env vars when set", () => {
      const config = resolveConfig({ DYNAMO_ENDPOINT: "http://db:9999", S3_ENDPOINT: "http://minio:9001" });
      expect(config.storage.dynamoEndpoint).to.equal("http://db:9999");
      expect(config.storage.s3Endpoint).to.equal("http://minio:9001");
    });

    it("exposes an empty, extensible flags object", () => {
      const config = resolveConfig({});
      expect(config.flags).to.deep.equal({});
    });
  });

  describe("production mode", () => {
    it("throws when HOST is not set", () => {
      expect(() => resolveConfig({ NODE_ENV: "production" })).to.throw(/HOST/);
    });

    it("collapses host, apiHost, and streamingApiHost onto the single HOST origin", () => {
      const config = resolveConfig({ NODE_ENV: "production", HOST: "https://lift.example.com" });
      expect(config.isDev).to.equal(false);
      expect(config.host).to.equal("https://lift.example.com");
      expect(config.apiHost).to.equal("https://lift.example.com");
      expect(config.streamingApiHost).to.equal("https://lift.example.com");
    });

    it("defaults the server port to 3000 and reads SERVER_PORT when set", () => {
      const defaultConfig = resolveConfig({ NODE_ENV: "production", HOST: "https://lift.example.com" });
      expect(defaultConfig.port).to.equal(3000);
      expect(defaultConfig.apiPort).to.equal(3000);
      expect(defaultConfig.streamingApiPort).to.equal(3000);

      const customConfig = resolveConfig({
        NODE_ENV: "production",
        HOST: "https://lift.example.com",
        SERVER_PORT: "4000",
      });
      expect(customConfig.port).to.equal(4000);
    });

    it("has no metroPort in production", () => {
      const config = resolveConfig({ NODE_ENV: "production", HOST: "https://lift.example.com" });
      expect(config.metroPort).to.equal(null);
    });
  });
});
