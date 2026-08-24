import "mocha";
import { expect } from "chai";
import { DynamoUtil_clientConfig } from "../lambda/utils/dynamo";
import { Config } from "../src/config";

describe("DynamoUtil_clientConfig", () => {
  it("points the DynamoDB client at the configured local endpoint with dummy credentials", () => {
    const clientConfig = DynamoUtil_clientConfig();
    expect(clientConfig.endpoint).to.equal(Config.storage.dynamoEndpoint);
    expect(clientConfig.region).to.equal("local");
    expect(clientConfig.credentials).to.deep.equal({ accessKeyId: "local", secretAccessKey: "local" });
  });

  it("never requires real AWS credentials to be present in the environment", () => {
    const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    try {
      expect(() => DynamoUtil_clientConfig()).to.not.throw();
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
