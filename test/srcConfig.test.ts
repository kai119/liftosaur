import "mocha";
import { expect } from "chai";
import { Config } from "../src/config";

describe("Config (src wrapper)", () => {
  it("re-exports the resolved config from config.js", () => {
    expect(Config.host).to.be.a("string");
    expect(Config.host).to.match(/^https:\/\//);
    expect(Config.apiHost).to.be.a("string");
    expect(Config.streamingApiHost).to.be.a("string");
    expect(Config.storage.dynamoEndpoint).to.be.a("string");
    expect(Config.storage.s3Endpoint).to.be.a("string");
    expect(Config.flags).to.deep.equal({});
  });
});
