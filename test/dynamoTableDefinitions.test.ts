import "mocha";
import { expect } from "chai";
import { DynamoTableDefinitions_forSuffix, DynamoTableDefinitions_all } from "../scripts/dynamoTableDefinitions";

describe("DynamoTableDefinitions", () => {
  it("defines all 23 tables from the CDK stack, for both prod and dev suffixes", () => {
    expect(DynamoTableDefinitions_forSuffix("")).to.have.length(23);
    expect(DynamoTableDefinitions_forSuffix("Dev")).to.have.length(23);
    expect(DynamoTableDefinitions_all()).to.have.length(46);
  });

  it("suffixes table names and GSI names for the dev variant", () => {
    const users = DynamoTableDefinitions_forSuffix("Dev").find((t) => t.name === "lftUsersDev");
    expect(users).to.exist;
    expect(users?.gsis?.map((g) => g.name)).to.deep.equal([
      "lftUsersGoogleIdDev",
      "lftUsersAppleIdDev",
      "lftUsersEmailDev",
      "lftUsersNicknameDev",
    ]);
  });

  it("keeps the aiLogs userId-timestamp-index GSI name unsuffixed, matching the CDK quirk", () => {
    const prodAiLogs = DynamoTableDefinitions_forSuffix("").find((t) => t.name === "lftAiLogs");
    const devAiLogs = DynamoTableDefinitions_forSuffix("Dev").find((t) => t.name === "lftAiLogsDev");
    expect(prodAiLogs?.gsis?.[0].name).to.equal("userId-timestamp-index");
    expect(devAiLogs?.gsis?.[0].name).to.equal("userId-timestamp-index");
  });

  it("declares a ttlAttribute for every table that sets timeToLiveAttribute in the CDK stack", () => {
    const ttlTables = DynamoTableDefinitions_forSuffix("")
      .filter((t) => t.ttlAttribute)
      .map((t) => t.name)
      .sort();
    expect(ttlTables).to.deep.equal(
      ["lftAiLogs", "lftEmailAuthTokens", "lftEvents", "lftOauthAuthCodes", "lftOauthTokens"].sort()
    );
  });

  it("declares a composite key for lftHistoryRecords, matching userDao's expectations", () => {
    const historyRecords = DynamoTableDefinitions_forSuffix("").find((t) => t.name === "lftHistoryRecords");
    expect(historyRecords?.partitionKey).to.deep.equal({ name: "userId", type: "S" });
    expect(historyRecords?.sortKey).to.deep.equal({ name: "id", type: "N" });
    expect(historyRecords?.gsis).to.deep.equal([
      {
        name: "lftHistoryRecordsDate",
        partitionKey: { name: "userId", type: "S" },
        sortKey: { name: "date", type: "S" },
      },
    ]);
  });
});
