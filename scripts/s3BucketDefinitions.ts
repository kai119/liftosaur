import { LftS3Buckets } from "../lambda/dao/buckets";
import { Utils_getEnv } from "../lambda/utils";

export interface IS3BucketDefinition {
  name: string;
  lifecycleDays?: number;
}

const baseBucketDefinitions: { key: Exclude<keyof typeof LftS3Buckets, "images">; lifecycleDays?: number }[] = [
  { key: "caches", lifecycleDays: 1 },
  { key: "debugs", lifecycleDays: 365 },
  { key: "exceptions", lifecycleDays: 30 },
  { key: "storages", lifecycleDays: 14 },
  { key: "stats" },
  { key: "programs" },
  { key: "assets" },
  { key: "userimages" },
  { key: "static" },
];

export function S3BucketDefinitions_all(): IS3BucketDefinition[] {
  const suffix = Utils_getEnv() === "dev" ? "dev" : "";
  return baseBucketDefinitions.map((b) => ({
    name: `${LftS3Buckets[b.key]}${suffix}`,
    lifecycleDays: b.lifecycleDays,
  }));
}
