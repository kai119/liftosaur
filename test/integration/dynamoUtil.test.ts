import "mocha";
import { expect } from "chai";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from "@aws-sdk/client-dynamodb";
import { DynamoUtil, DynamoUtil_clientConfig } from "../../lambda/utils/dynamo";
import { MockLogUtil } from "../utils/mockLogUtil";

const TEST_TABLE = "lftIntegrationTestTable";

async function isReachable(client: DynamoDBClient): Promise<boolean> {
  try {
    await client.send(new ListTablesCommand({}));
    return true;
  } catch (e) {
    return false;
  }
}

describe("DynamoUtil (integration, real local datastore)", function () {
  this.timeout(30000);
  let client: DynamoDBClient;
  let dynamoUtil: DynamoUtil;
  let unreachable = false;

  before(async function () {
    client = new DynamoDBClient(DynamoUtil_clientConfig());
    if (!(await isReachable(client))) {
      console.warn(
        "\n  Skipping DynamoUtil integration tests: no reachable datastore at the configured endpoint.\n" +
          '  Run "npm run dynamo:up" (and "npm run dynamo:wait") first, then re-run "npm run test:dynamo".\n'
      );
      unreachable = true;
      this.skip();
      return;
    }

    dynamoUtil = new DynamoUtil(new MockLogUtil());

    try {
      await client.send(new DeleteTableCommand({ TableName: TEST_TABLE }));
      await waitUntilTableNotExists({ client, maxWaitTime: 30 }, { TableName: TEST_TABLE });
    } catch (e) {
      // table didn't exist yet - fine
    }

    await client.send(
      new CreateTableCommand({
        TableName: TEST_TABLE,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "id", AttributeType: "S" },
          { AttributeName: "email", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "id", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "byEmail",
            KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      })
    );
    await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: TEST_TABLE });
  });

  after(async function () {
    if (unreachable) {
      return;
    }
    await client.send(new DeleteTableCommand({ TableName: TEST_TABLE }));
  });

  beforeEach(function () {
    if (unreachable) {
      this.skip();
    }
  });

  it("putIfNotExists inserts a new item and rejects a duplicate", async () => {
    const inserted = await dynamoUtil.putIfNotExists({
      tableName: TEST_TABLE,
      item: { userId: "u1", id: "i1", email: "a@example.com", name: "first" },
      partitionKey: "userId",
      sortKey: "id",
    });
    expect(inserted).to.equal(true);

    const rejected = await dynamoUtil.putIfNotExists({
      tableName: TEST_TABLE,
      item: { userId: "u1", id: "i1", email: "dup@example.com", name: "second" },
      partitionKey: "userId",
      sortKey: "id",
    });
    expect(rejected).to.equal(false);

    const stored = await dynamoUtil.get<{ name: string }>({ tableName: TEST_TABLE, key: { userId: "u1", id: "i1" } });
    expect(stored?.name).to.equal("first");
  });

  it("query reads items back by partition key", async () => {
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u2", id: "i1", email: "b@example.com" } });
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u2", id: "i2", email: "c@example.com" } });

    const items = await dynamoUtil.query<{ id: string }>({
      tableName: TEST_TABLE,
      expression: "#userId = :userId",
      attrs: { "#userId": "userId" },
      values: { ":userId": "u2" },
    });
    expect(items.map((i) => i.id).sort()).to.deep.equal(["i1", "i2"]);
  });

  it("query against a GSI finds an item by its indexed attribute", async () => {
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u3", id: "i1", email: "unique@example.com" } });

    const items = await dynamoUtil.query<{ userId: string }>({
      tableName: TEST_TABLE,
      indexName: "byEmail",
      expression: "#email = :email",
      attrs: { "#email": "email" },
      values: { ":email": "unique@example.com" },
    });
    expect(items).to.have.length(1);
    expect(items[0].userId).to.equal("u3");
  });

  it("scan returns every item in the table, with a filter expression narrowing results", async () => {
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u4", id: "i1", email: "scan1@example.com" } });

    const all = await dynamoUtil.scan<{ userId: string }>({ tableName: TEST_TABLE });
    expect(all.length).to.be.greaterThan(0);

    const filtered = await dynamoUtil.scan<{ userId: string }>({
      tableName: TEST_TABLE,
      filterExpression: "#userId = :userId",
      names: { "#userId": "userId" },
      values: { ":userId": "u4" },
    });
    expect(filtered).to.have.length(1);
  });

  it("streamingQuery yields matching items across one or more batches", async () => {
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u5", id: "i1", email: "s1@example.com" } });
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u5", id: "i2", email: "s2@example.com" } });

    const collected: string[] = [];
    for await (const batch of dynamoUtil.streamingQuery<{ id: string }>({
      tableName: TEST_TABLE,
      expression: "#userId = :userId",
      attrs: { "#userId": "userId" },
      values: { ":userId": "u5" },
    })) {
      collected.push(...batch.map((i) => i.id));
    }
    expect(collected.sort()).to.deep.equal(["i1", "i2"]);
  });

  it("streamingScan yields items across the whole table", async () => {
    const collected: unknown[] = [];
    for await (const batch of dynamoUtil.streamingScan({ tableName: TEST_TABLE })) {
      collected.push(...batch);
    }
    expect(collected.length).to.be.greaterThan(0);
  });

  it("update applies a SET expression and returns the new attributes", async () => {
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u6", id: "i1", email: "u6@example.com" } });

    const updated = await dynamoUtil.update({
      tableName: TEST_TABLE,
      key: { userId: "u6", id: "i1" },
      expression: "SET #nickname = :nickname",
      attrs: { "#nickname": "nickname" },
      values: { ":nickname": "kai" },
      returnValues: "ALL_NEW",
    });
    expect(updated?.nickname).to.equal("kai");
  });

  it("batchPut and batchGet write and read multiple items in one round trip", async () => {
    await dynamoUtil.batchPut({
      tableName: TEST_TABLE,
      items: [
        { userId: "u7", id: "i1", email: "d@example.com" },
        { userId: "u7", id: "i2", email: "e@example.com" },
      ],
    });

    const items = await dynamoUtil.batchGet<{ id: string }>({
      tableName: TEST_TABLE,
      keys: [
        { userId: "u7", id: "i1" },
        { userId: "u7", id: "i2" },
      ],
    });
    expect(items.map((i) => i.id).sort()).to.deep.equal(["i1", "i2"]);
  });

  it("batchDelete removes multiple items in one round trip", async () => {
    await dynamoUtil.batchPut({
      tableName: TEST_TABLE,
      items: [{ userId: "u8", id: "i1", email: "f@example.com" }],
    });

    await dynamoUtil.batchDelete({ tableName: TEST_TABLE, keys: [{ userId: "u8", id: "i1" }] });

    const remaining = await dynamoUtil.get({ tableName: TEST_TABLE, key: { userId: "u8", id: "i1" } });
    expect(remaining).to.equal(undefined);
  });

  it("remove deletes a single item", async () => {
    await dynamoUtil.put({ tableName: TEST_TABLE, item: { userId: "u9", id: "i1", email: "g@example.com" } });
    await dynamoUtil.remove({ tableName: TEST_TABLE, key: { userId: "u9", id: "i1" } });
    const remaining = await dynamoUtil.get({ tableName: TEST_TABLE, key: { userId: "u9", id: "i1" } });
    expect(remaining).to.equal(undefined);
  });
});
