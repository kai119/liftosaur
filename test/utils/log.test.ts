import "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LogUtil, resolveLogDirPath } from "../../lambda/utils/log";
import { DateUtils_formatYYYYMMDD } from "../../src/utils/date";

function tempLogDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lft-log-test-"));
}

function todayLogPath(dir: string): string {
  return path.join(dir, `${DateUtils_formatYYYYMMDD(new Date(), "-")}.log`);
}

describe("resolveLogDirPath", () => {
  it("defaults to logs/ under the given working directory when LOG_DIR is not set", () => {
    expect(resolveLogDirPath({}, "/tmp/some-cwd")).to.equal(path.join("/tmp/some-cwd", "logs"));
  });

  it("uses LOG_DIR when set, ignoring the working directory", () => {
    expect(resolveLogDirPath({ LOG_DIR: "/custom/logs" }, "/tmp/some-cwd")).to.equal("/custom/logs");
  });
});

describe("LogUtil (local file-backed)", () => {
  it("appends a line to today's log file with the request id and message", () => {
    const dir = tempLogDir();
    const log = new LogUtil(dir);
    log.log("hello", "world");

    const filePath = todayLogPath(dir);
    expect(fs.existsSync(filePath)).to.equal(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).to.include(`[${log.id}]`);
    expect(content).to.include("hello world");
  });

  it("includes the user id once setUser has been called", () => {
    const dir = tempLogDir();
    const log = new LogUtil(dir);
    log.setUser("user123");
    log.log("did a thing");

    const content = fs.readFileSync(todayLogPath(dir), "utf8");
    expect(content).to.include(`[${log.id}][user123]`);
  });

  it("serializes object arguments the same way the Rollbar path does", () => {
    const dir = tempLogDir();
    const log = new LogUtil(dir);
    log.log("payload", { a: 1 });

    const content = fs.readFileSync(todayLogPath(dir), "utf8");
    expect(content).to.include(`payload ${JSON.stringify({ a: 1 })}`);
  });

  it("escapes embedded newlines so one log() call produces exactly one physical line", () => {
    const dir = tempLogDir();
    const log = new LogUtil(dir);
    log.log("stack trace:\nat foo.js:1\nat bar.js:2");
    log.log("second call");

    const content = fs.readFileSync(todayLogPath(dir), "utf8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines.length).to.equal(2);
    expect(lines[0]).to.include("stack trace:\\nat foo.js:1\\nat bar.js:2");
    expect(lines[0]).to.not.include("\n");
  });

  it("does not throw if the log directory can't be created", () => {
    // A real file in place of a directory component reliably fails mkdirSync
    // (ENOTDIR) on every OS. Using a /proc path here is not portable: on
    // this machine's kernel (6.18), Node's native recursive mkdirSync walk
    // hangs indefinitely against procfs instead of failing fast, and macOS
    // has no /proc at all.
    const dir = tempLogDir();
    const blockerFile = path.join(dir, "blocker");
    fs.writeFileSync(blockerFile, "");
    const log = new LogUtil(path.join(blockerFile, "logs"));
    expect(() => log.log("should not throw")).to.not.throw();
  });
});
