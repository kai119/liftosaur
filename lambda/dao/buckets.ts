import { Config } from "../../src/config";

export const LftS3Buckets = {
  caches: "liftosaurcaches2",
  stats: "liftosaurstats",
  debugs: "liftosaurdebugs2",
  exceptions: "liftosaurexceptions2",
  storages: "liftosaurstorages",
  programs: "liftosaurprograms",
  assets: "liftosaurassets",
  images: "liftosaurimages2",
  userimages: "liftosauruserimages",
  static: "lftstatic",
};

export function getUserImagesPrefix(): string {
  return `${Config.host}/userimages/`;
}
