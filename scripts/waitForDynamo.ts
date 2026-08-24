import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoUtil_clientConfig } from "../lambda/utils/dynamo";

const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 1000;

async function waitForDynamo(): Promise<void> {
  const client = new DynamoDBClient(DynamoUtil_clientConfig());
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log(`Dynamo-compatible endpoint is up after ${attempt} attempt(s)`);
      return;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Dynamo-compatible endpoint did not become reachable after ${MAX_ATTEMPTS} attempts: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

waitForDynamo().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
