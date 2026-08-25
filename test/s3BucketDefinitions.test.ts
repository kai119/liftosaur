import "mocha";
import { expect } from "chai";
import { S3BucketDefinitions_all } from "../scripts/s3BucketDefinitions";
import { LftS3Buckets } from "../lambda/dao/buckets";

describe("S3BucketDefinitions_all", () => {
  it("leaves bucket names unsuffixed in the default test env (IS_DEV unset, so Utils_getEnv() resolves to 'prod')", () => {
    const buckets = S3BucketDefinitions_all();
    const byBaseName = new Map(buckets.map((b) => [b.name.replace(/dev$/, ""), b]));

    expect(byBaseName.get(LftS3Buckets.caches)?.name).to.equal(LftS3Buckets.caches);
    expect(byBaseName.get(LftS3Buckets.debugs)?.name).to.equal(LftS3Buckets.debugs);
    expect(byBaseName.get(LftS3Buckets.exceptions)?.name).to.equal(LftS3Buckets.exceptions);
    expect(byBaseName.get(LftS3Buckets.storages)?.name).to.equal(LftS3Buckets.storages);
    expect(byBaseName.get(LftS3Buckets.stats)?.name).to.equal(LftS3Buckets.stats);
    expect(byBaseName.get(LftS3Buckets.programs)?.name).to.equal(LftS3Buckets.programs);
    expect(byBaseName.get(LftS3Buckets.assets)?.name).to.equal(LftS3Buckets.assets);
    expect(byBaseName.get(LftS3Buckets.userimages)?.name).to.equal(LftS3Buckets.userimages);
    expect(byBaseName.get(LftS3Buckets.static)?.name).to.equal(LftS3Buckets.static);
  });

  it("suffixes every bucket name with 'dev' when IS_DEV=true", () => {
    const original = process.env.IS_DEV;
    process.env.IS_DEV = "true";
    try {
      const buckets = S3BucketDefinitions_all();
      const byBaseName = new Map(buckets.map((b) => [b.name.replace(/dev$/, ""), b]));

      expect(byBaseName.get(LftS3Buckets.caches)?.name).to.equal(`${LftS3Buckets.caches}dev`);
      expect(byBaseName.get(LftS3Buckets.static)?.name).to.equal(`${LftS3Buckets.static}dev`);
    } finally {
      if (original === undefined) {
        delete process.env.IS_DEV;
      } else {
        process.env.IS_DEV = original;
      }
    }
  });

  it("does not include the images bucket (out of scope, belongs to issue #12)", () => {
    const buckets = S3BucketDefinitions_all();
    expect(buckets.some((b) => b.name.startsWith(LftS3Buckets.images))).to.equal(false);
  });

  it("carries the CDK-equivalent lifecycle days only for caches/debugs/exceptions/storages", () => {
    const buckets = S3BucketDefinitions_all();
    const byName = new Map(buckets.map((b) => [b.name, b.lifecycleDays]));

    expect(byName.get(LftS3Buckets.caches)).to.equal(1);
    expect(byName.get(LftS3Buckets.debugs)).to.equal(365);
    expect(byName.get(LftS3Buckets.exceptions)).to.equal(30);
    expect(byName.get(LftS3Buckets.storages)).to.equal(14);
    expect(byName.get(LftS3Buckets.stats)).to.equal(undefined);
    expect(byName.get(LftS3Buckets.programs)).to.equal(undefined);
    expect(byName.get(LftS3Buckets.assets)).to.equal(undefined);
    expect(byName.get(LftS3Buckets.userimages)).to.equal(undefined);
    expect(byName.get(LftS3Buckets.static)).to.equal(undefined);
  });
});
