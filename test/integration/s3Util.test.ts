import "mocha";
import { expect } from "chai";
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  ListObjectsCommand,
} from "@aws-sdk/client-s3";
import { S3Util, S3Util_clientConfig } from "../../lambda/utils/s3";
import { MockLogUtil } from "../utils/mockLogUtil";

const TEST_BUCKET = "lft-integration-test-bucket";

async function isReachable(client: S3Client): Promise<boolean> {
  try {
    await client.send(new ListBucketsCommand({}));
    return true;
  } catch (e) {
    return false;
  }
}

async function emptyBucket(client: S3Client, bucket: string): Promise<void> {
  const listed = await client.send(new ListObjectsCommand({ Bucket: bucket }));
  for (const obj of listed.Contents ?? []) {
    if (obj.Key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
    }
  }
}

describe("S3Util (integration, real local object storage)", function () {
  this.timeout(30000);
  let client: S3Client;
  let s3Util: S3Util;
  let unreachable = false;

  before(async function () {
    client = new S3Client(S3Util_clientConfig());
    if (!(await isReachable(client))) {
      console.warn(
        "\n  Skipping S3Util integration tests: no reachable S3-compatible server at the configured endpoint.\n" +
          '  Run "npm run s3:up" (and "npm run s3:wait") first, then re-run "npm run test:s3".\n'
      );
      unreachable = true;
      this.skip();
      return;
    }

    s3Util = new S3Util(new MockLogUtil());

    try {
      await emptyBucket(client, TEST_BUCKET);
      await client.send(new DeleteBucketCommand({ Bucket: TEST_BUCKET }));
    } catch (e) {
      // bucket didn't exist yet - fine
    }
    await client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
  });

  after(async function () {
    if (unreachable) {
      return;
    }
    await emptyBucket(client, TEST_BUCKET);
    await client.send(new DeleteBucketCommand({ Bucket: TEST_BUCKET }));
  });

  beforeEach(function () {
    if (unreachable) {
      this.skip();
    }
  });

  it("putObject writes an object and getObject reads it back", async () => {
    await s3Util.putObject({ bucket: TEST_BUCKET, key: "greeting.txt", body: "hello seaweed" });
    const result = await s3Util.getObject({ bucket: TEST_BUCKET, key: "greeting.txt" });
    expect(result?.toString("utf-8")).to.equal("hello seaweed");
  });

  it("getObject returns undefined for a key that doesn't exist", async () => {
    const result = await s3Util.getObject({ bucket: TEST_BUCKET, key: "does-not-exist.txt" });
    expect(result).to.equal(undefined);
  });

  it("listObjects returns every key under a prefix", async () => {
    await s3Util.putObject({ bucket: TEST_BUCKET, key: "listing/a.txt", body: "a" });
    await s3Util.putObject({ bucket: TEST_BUCKET, key: "listing/b.txt", body: "b" });
    await s3Util.putObject({ bucket: TEST_BUCKET, key: "elsewhere/c.txt", body: "c" });

    const keys = await s3Util.listObjects({ bucket: TEST_BUCKET, prefix: "listing/" });
    expect(keys.sort()).to.deep.equal(["listing/a.txt", "listing/b.txt"]);
  });

  it("deleteObject removes an object", async () => {
    await s3Util.putObject({ bucket: TEST_BUCKET, key: "to-delete.txt", body: "bye" });
    await s3Util.deleteObject({ bucket: TEST_BUCKET, key: "to-delete.txt" });
    const result = await s3Util.getObject({ bucket: TEST_BUCKET, key: "to-delete.txt" });
    expect(result).to.equal(undefined);
  });

  it("getPresignedUploadUrl produces a URL that actually accepts a PUT", async () => {
    const uploadUrl = await s3Util.getPresignedUploadUrl({
      bucket: TEST_BUCKET,
      key: "presigned-upload.txt",
      contentType: "text/plain",
      expiresIn: 60,
    });

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: "uploaded via presigned url",
    });
    expect(response.ok).to.equal(true);

    const stored = await s3Util.getObject({ bucket: TEST_BUCKET, key: "presigned-upload.txt" });
    expect(stored?.toString("utf-8")).to.equal("uploaded via presigned url");
  });

  it("getPresignedDownloadUrl produces a URL that actually serves a GET, and honours expiresIn", async () => {
    await s3Util.putObject({
      bucket: TEST_BUCKET,
      key: "presigned-download.txt",
      body: "downloaded via presigned url",
    });

    const downloadUrl = await s3Util.getPresignedDownloadUrl({
      bucket: TEST_BUCKET,
      key: "presigned-download.txt",
      expiresIn: 60,
    });
    const response = await fetch(downloadUrl);
    expect(response.ok).to.equal(true);
    expect(await response.text()).to.equal("downloaded via presigned url");

    const expiredUrl = await s3Util.getPresignedDownloadUrl({
      bucket: TEST_BUCKET,
      key: "presigned-download.txt",
      expiresIn: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const expiredResponse = await fetch(expiredUrl);
    expect(expiredResponse.ok).to.equal(false);
  });
});
