/* eslint-disable @typescript-eslint/no-explicit-any */
import Rollbar from "rollbar";
import * as fs from "fs";
import * as path from "path";
import { UidFactory_generateUid } from "./generator";
import { Utils_getEnv } from "../utils";
import { DateUtils_formatYYYYMMDD } from "../../src/utils/date";

export interface ILogUtil {
  id: string;
  log(...str: any[]): void;
  setUser(userid: string): void;
  setRollbar(rollbar: Rollbar): void;
}

export function resolveLogDirPath(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): string {
  return env.LOG_DIR || path.join(cwd, "logs");
}

export class LogUtil implements ILogUtil {
  public id: string;
  private userid: string | undefined;
  private rollbar?: Rollbar;

  constructor(private readonly logDirPath: string = resolveLogDirPath()) {
    this.id = UidFactory_generateUid(4);
  }

  public setUser(userid: string): void {
    this.userid = userid;
  }

  public log(...str: any[]): void {
    const env = Utils_getEnv();
    const time = new Date();
    const plainTimeStr = `${this.prefixTime(time.getHours())}:${this.prefixTime(time.getMinutes())}:${this.prefixTime(
      time.getSeconds()
    )}.${time.getMilliseconds().toString().padStart(3, "0")}`;

    if (env === "dev") {
      console.log(
        this.colorize(plainTimeStr, 36),
        `[${this.colorize(this.id, 33)}]${this.userid ? `[${this.colorize(this.userid, 32)}]` : ""}`,
        ...str
      );
    } else {
      console.log(`[${this.colorize(this.id, 33)}]${this.userid ? `[${this.colorize(this.userid, 32)}]` : ""}`, ...str);
    }

    const message = this.formatMessage(str);
    if (this.rollbar) {
      this.rollbar.captureEvent({ msg: message }, "info");
    }
    this.appendToFile(plainTimeStr, message);
  }

  public setRollbar(rollbar: Rollbar): void {
    this.rollbar = rollbar;
  }

  private formatMessage(str: any[]): string {
    return str.map((s) => (typeof s === "object" ? JSON.stringify(s) : String(s))).join(" ");
  }

  private appendToFile(timeStr: string, message: string): void {
    try {
      fs.mkdirSync(this.logDirPath, { recursive: true });
      const fileName = `${DateUtils_formatYYYYMMDD(new Date(), "-")}.log`;
      const line = `${timeStr} [${this.id}]${this.userid ? `[${this.userid}]` : ""} ${message.replace(/\n/g, "\\n")}\n`;
      fs.appendFileSync(path.join(this.logDirPath, fileName), line);
    } catch (e) {
      // Best-effort: a full disk, missing permissions, or a read-only fs
      // (e.g. some test/container setups) must not crash request handling.
    }
  }

  private prefixTime(time: number): string {
    return `${time}`.padStart(2, "0");
  }

  private colorize(str: string, color: number): string {
    const env = Utils_getEnv();

    if (env === "dev") {
      return "\x1b[" + color.toString() + "m" + str + "\x1b[0m";
    } else {
      return str;
    }
  }
}
