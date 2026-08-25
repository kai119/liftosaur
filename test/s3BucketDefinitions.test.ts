import "mocha";
import { expect } from "chai";
import { S3BucketDefinitions_all, S3BucketDefinitions_forSuffix } from "../scripts/s3BucketDefinitions";
import { LftS3Buckets } from "../lambda/dao/buckets";

describe("S3BucketDefinitions_all", () => {
  it("returns 18 buckets - both the unsuffixed and 'dev'-suffixed variant of every base bucket", () => {
    const buckets = S3BucketDefinitions_all();
    expect(buckets.length).to.equal(18);

    const names = new Set(buckets.map((b) => b.name));
    for (const base of [
      LftS3Buckets.caches,
      LftS3Buckets.debugs,
      LftS3Buckets.exceptions,
      LftS3Buckets.storages,
      LftS3Buckets.stats,
      LftS3Buckets.programs,
      LftS3Buckets.assets,
      LftS3Buckets.userimages,
      LftS3Buckets.static,
    ]) {
      expect(names.has(base), `expected unsuffixed ${base}`).to.equal(true);
      expect(names.has(`${base}dev`), `expected dev-suffixed ${base}dev`).to.equal(true);
    }
  });

  it("does not include the images bucket in either suffix variant (out of scope, belongs to issue #12)", () => {
    const buckets = S3BucketDefinitions_all();
    expect(buckets.some((b) => b.name.startsWith(LftS3Buckets.images))).to.equal(false);
  });

  it("carries the CDK-equivalent lifecycle days only for caches/debugs/exceptions/storages, for both suffix variants", () => {
    const buckets = S3BucketDefinitions_all();
    const byName = new Map(buckets.map((b) => [b.name, b.lifecycleDays]));

    for (const suffix of ["", "dev"] as const) {
      expect(byName.get(`${LftS3Buckets.caches}${suffix}`)).to.equal(1);
      expect(byName.get(`${LftS3Buckets.debugs}${suffix}`)).to.equal(365);
      expect(byName.get(`${LftS3Buckets.exceptions}${suffix}`)).to.equal(30);
      expect(byName.get(`${LftS3Buckets.storages}${suffix}`)).to.equal(14);
      expect(byName.get(`${LftS3Buckets.stats}${suffix}`)).to.equal(undefined);
      expect(byName.get(`${LftS3Buckets.programs}${suffix}`)).to.equal(undefined);
      expect(byName.get(`${LftS3Buckets.assets}${suffix}`)).to.equal(undefined);
      expect(byName.get(`${LftS3Buckets.userimages}${suffix}`)).to.equal(undefined);
      expect(byName.get(`${LftS3Buckets.static}${suffix}`)).to.equal(undefined);
    }
  });
});

describe("S3BucketDefinitions_forSuffix", () => {
  it("returns the 9 base buckets unsuffixed for ''", () => {
    const buckets = S3BucketDefinitions_forSuffix("");
    expect(buckets.length).to.equal(9);
    expect(buckets.some((b) => b.name === LftS3Buckets.caches)).to.equal(true);
    expect(buckets.some((b) => b.name === `${LftS3Buckets.caches}dev`)).to.equal(false);
  });

  it("returns the 9 base buckets suffixed with 'dev' for 'dev'", () => {
    const buckets = S3BucketDefinitions_forSuffix("dev");
    expect(buckets.length).to.equal(9);
    expect(buckets.some((b) => b.name === `${LftS3Buckets.caches}dev`)).to.equal(true);
    expect(buckets.some((b) => b.name === LftS3Buckets.caches)).to.equal(false);
  });
});
