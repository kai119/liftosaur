import { S3Client, CreateBucketCommand, PutBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3";
import { S3Util_clientConfig } from "../lambda/utils/s3";
import { S3BucketDefinitions_all } from "./s3BucketDefinitions";

async function createBucket(client: S3Client, name: string): Promise<boolean> {
  try {
    await client.send(new CreateBucketCommand({ Bucket: name }));
    return true;
  } catch (e) {
    const err = e as Error & { name?: string };
    if (err.name === "BucketAlreadyOwnedByYou" || err.name === "BucketAlreadyExists") {
      return false;
    }
    throw e;
  }
}

async function applyLifecycle(client: S3Client, name: string, days: number): Promise<void> {
  try {
    await client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: name,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "expire",
              Status: "Enabled",
              Filter: { Prefix: "" },
              Expiration: { Days: days },
            },
          ],
        },
      })
    );
  } catch (e) {
    console.log(`  Lifecycle on ${name}: ${e instanceof Error ? e.message : String(e)} (continuing without it)`);
  }
}

async function provisionAll(): Promise<void> {
  const client = new S3Client(S3Util_clientConfig());
  const buckets = S3BucketDefinitions_all();
  for (const bucket of buckets) {
    const created = await createBucket(client, bucket.name);
    console.log(created ? `Created ${bucket.name}` : `${bucket.name} already exists, skipping`);
    if (bucket.lifecycleDays != null) {
      await applyLifecycle(client, bucket.name, bucket.lifecycleDays);
    }
  }
  console.log(`\nProvisioned ${buckets.length} buckets (idempotent — safe to re-run)`);
}

provisionAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
