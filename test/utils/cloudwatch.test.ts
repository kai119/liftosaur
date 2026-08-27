import "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CloudwatchUtil } from "../../lambda/utils/cloudwatch";
import { MockLogUtil } from "./mockLogUtil";
import { DateUtils_formatYYYYMMDD } from "../../src/utils/date";

function tempLogDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lft-cloudwatch-test-"));
}

describe("CloudwatchUtil (local file-backed)", () => {
  const date = new Date(2026, 0, 15, 12, 0, 0);
  const dayStr = DateUtils_formatYYYYMMDD(date, "-");
  let originalCwd: string;
  let outDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lft-cloudwatch-out-"));
    process.chdir(outDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("groups matching lines by request id into the output file", async () => {
    const logDir = tempLogDir();
    fs.writeFileSync(
      path.join(logDir, `${dayStr}.log`),
      [
        "10:00:00.000 [req1][userA] GET /api/history",
        "10:00:00.500 [req1][userA] 200 OK",
        "10:05:00.000 [req2][userB] GET /api/programs",
      ].join("\n") + "\n"
    );

    const cw = new CloudwatchUtil(new MockLogUtil(), logDir);
    await cw.getLogs(date);

    const outputFile = `logs-${dayStr}.txt`;
    expect(fs.existsSync(path.join(outDir, outputFile))).to.equal(true);
    const content = fs.readFileSync(path.join(outDir, outputFile), "utf8");
    expect(content).to.include("req1");
    expect(content).to.include("req2");
  });

  it("filters by userid when given", async () => {
    const logDir = tempLogDir();
    fs.writeFileSync(
      path.join(logDir, `${dayStr}.log`),
      ["10:00:00.000 [req1][userA] hello", "10:05:00.000 [req2][userB] world"].join("\n") + "\n"
    );

    const cw = new CloudwatchUtil(new MockLogUtil(), logDir);
    await cw.getLogs(date, "userA");

    const outputFile = `logs-${dayStr}-userA.txt`;
    const content = fs.readFileSync(path.join(outDir, outputFile), "utf8");
    expect(content).to.include("userA");
    expect(content).to.not.include("userB");
  });

  it("logs and returns without writing an output file when the day's log file doesn't exist", async () => {
    const log = new MockLogUtil();
    const cw = new CloudwatchUtil(log, tempLogDir());
    await cw.getLogs(date);

    expect(fs.existsSync(path.join(outDir, `logs-${dayStr}.txt`))).to.equal(false);
    expect(log.logs.join("\n")).to.include("not found");
  });
});
