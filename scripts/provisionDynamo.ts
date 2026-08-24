import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { DynamoUtil_clientConfig } from "../lambda/utils/dynamo";
import { DynamoTableDefinitions_all, IDynamoAttributeType, IDynamoTableDefinition } from "./dynamoTableDefinitions";

function collectAttributeDefinitions(
  table: IDynamoTableDefinition
): { AttributeName: string; AttributeType: IDynamoAttributeType }[] {
  const attrs = new Map<string, IDynamoAttributeType>();
  attrs.set(table.partitionKey.name, table.partitionKey.type);
  if (table.sortKey) {
    attrs.set(table.sortKey.name, table.sortKey.type);
  }
  for (const gsi of table.gsis ?? []) {
    attrs.set(gsi.partitionKey.name, gsi.partitionKey.type);
    if (gsi.sortKey) {
      attrs.set(gsi.sortKey.name, gsi.sortKey.type);
    }
  }
  return Array.from(attrs.entries()).map(([name, type]) => ({ AttributeName: name, AttributeType: type }));
}

async function createTable(client: DynamoDBClient, table: IDynamoTableDefinition): Promise<boolean> {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: table.name,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: collectAttributeDefinitions(table),
        KeySchema: [
          { AttributeName: table.partitionKey.name, KeyType: "HASH" },
          ...(table.sortKey ? [{ AttributeName: table.sortKey.name, KeyType: "RANGE" as const }] : []),
        ],
        GlobalSecondaryIndexes: table.gsis?.map((gsi) => ({
          IndexName: gsi.name,
          KeySchema: [
            { AttributeName: gsi.partitionKey.name, KeyType: "HASH" as const },
            ...(gsi.sortKey ? [{ AttributeName: gsi.sortKey.name, KeyType: "RANGE" as const }] : []),
          ],
          Projection: { ProjectionType: "ALL" as const },
        })),
      })
    );
    return true;
  } catch (e) {
    if (e instanceof ResourceInUseException) {
      return false;
    }
    throw e;
  }
}

async function enableTtl(client: DynamoDBClient, table: IDynamoTableDefinition, justCreated: boolean): Promise<void> {
  if (!table.ttlAttribute) {
    return;
  }
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: table.name,
        TimeToLiveSpecification: { AttributeName: table.ttlAttribute, Enabled: true },
      })
    );
  } catch (e) {
    if (justCreated) {
      throw e;
    }
    console.log(`  TTL on ${table.name}: ${e instanceof Error ? e.message : String(e)} (likely already enabled)`);
  }
}

async function provisionTable(client: DynamoDBClient, table: IDynamoTableDefinition): Promise<void> {
  const created = await createTable(client, table);
  if (created) {
    await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: table.name });
    console.log(`Created ${table.name}`);
  } else {
    console.log(`${table.name} already exists, skipping`);
  }
  await enableTtl(client, table, created);
}

async function provisionAll(): Promise<void> {
  const client = new DynamoDBClient(DynamoUtil_clientConfig());
  const tables = DynamoTableDefinitions_all();
  for (const table of tables) {
    await provisionTable(client, table);
  }
  console.log(`\nProvisioned ${tables.length} tables (idempotent — safe to re-run)`);
}

provisionAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
