import { buildDi } from "../lambda/utils/di";
import { LogUtil } from "../lambda/utils/log";

async function main(): Promise<void> {
  const [, , dateArg, userid, endpoint] = process.argv;
  if (!dateArg) {
    console.error("Usage: npm run admin:getlogs -- <YYYY-MM-DD> [userid] [endpoint]");
    process.exit(1);
  }
  const date = new Date(dateArg);
  if (Number.isNaN(date.getTime())) {
    console.error(`Invalid date: ${dateArg}`);
    process.exit(1);
  }
  const di = buildDi(new LogUtil(), fetch);
  await di.cloudwatch.getLogs(date, userid || undefined, endpoint || undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
