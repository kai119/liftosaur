import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { S3Util_clientConfig } from "../lambda/utils/s3";

const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 1000;

async function waitForS3(): Promise<void> {
  const client = new S3Client(S3Util_clientConfig());
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await client.send(new ListBucketsCommand({}));
      console.log(`S3-compatible endpoint is up after ${attempt} attempt(s)`);
      return;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `S3-compatible endpoint did not become reachable after ${MAX_ATTEMPTS} attempts: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

waitForS3().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
