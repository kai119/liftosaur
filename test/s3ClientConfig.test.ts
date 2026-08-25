import "mocha";
import { expect } from "chai";
import { S3Util_clientConfig } from "../lambda/utils/s3";
import { Config } from "../src/config";

describe("S3Util_clientConfig", () => {
  it("points the S3 client at the configured local endpoint with dummy credentials and path-style addressing", () => {
    const clientConfig = S3Util_clientConfig();
    expect(clientConfig.endpoint).to.equal(Config.storage.s3Endpoint);
    expect(clientConfig.region).to.equal("us-east-1");
    expect(clientConfig.forcePathStyle).to.equal(true);
    expect(clientConfig.requestChecksumCalculation).to.equal("WHEN_REQUIRED");
    expect(clientConfig.credentials).to.deep.equal({ accessKeyId: "local", secretAccessKey: "locallocal" });
  });

  it("never requires real AWS credentials to be present in the environment", () => {
    const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    try {
      expect(() => S3Util_clientConfig()).to.not.throw();
    } finally {
      if (originalAccessKey !== undefined) {
        process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
      }
      if (originalSecretKey !== undefined) {
        process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
      }
    }
  });
});
