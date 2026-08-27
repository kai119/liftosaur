import * as fs from "fs";
import * as path from "path";
import { DateUtils_formatYYYYMMDD } from "../../src/utils/date";
import { ILogUtil } from "./log";
import { resolveLogDirPath } from "./log";

export interface ICloudwatchUtil {
  getLogs(date: Date, userid?: string, endpoint?: string): Promise<void>;
}

export class CloudwatchUtil implements ICloudwatchUtil {
  constructor(
    private readonly log: ILogUtil,
    private readonly logDirPath: string = resolveLogDirPath()
  ) {}

  public async getLogs(date: Date, userid?: string, endpoint?: string): Promise<void> {
    this.log.log(
      ...[
        "Fetching logs for",
        date,
        ...(userid ? ["for user", userid] : []),
        ...(endpoint ? ["endpoint", endpoint] : []),
      ]
    );

    const inputFile = path.join(this.logDirPath, `${DateUtils_formatYYYYMMDD(date, "-")}.log`);
    if (!fs.existsSync(inputFile)) {
      this.log.log("Log file not found:", inputFile);
      return;
    }

    const lines = fs.readFileSync(inputFile, "utf8").split("\n").filter(Boolean);
    this.log.log(`Read ${lines.length} log lines from ${inputFile}`);

    const endpointSuffix = endpoint ? `-${endpoint.replace(/\//g, "-")}` : "";
    const outputFile = `logs-${DateUtils_formatYYYYMMDD(date, "-")}${userid ? `-${userid}` : ""}${endpointSuffix}.txt`;
    await this.writeGroupedOutput(lines, outputFile, userid, endpoint);

    this.log.log(`Done! Output written to ${outputFile}`);
  }

  private async writeGroupedOutput(
    lines: string[],
    outputFile: string,
    userid?: string,
    endpoint?: string
  ): Promise<void> {
    let matchingRequestIds: Set<string> | undefined;
    if (endpoint) {
      matchingRequestIds = new Set();
      for (const log of lines) {
        if (log.includes(endpoint)) {
          const match = log.match(/\[(\w+)\]/);
          if (match) {
            matchingRequestIds.add(match[1]);
          }
        }
      }
      this.log.log(`Found ${matchingRequestIds.size} requests matching endpoint ${endpoint}`);
    }

    const sortedResult = new Map<string, Map<string, string[]>>();
    for (const log of lines) {
      const hhmm = log.substring(0, 5);
      const match = log.match(/\[(\w+)\](?:\[(\w+)\])?/);
      if (match) {
        const requestId = match[1];
        const loguserid = match[2];
        if (userid && userid !== loguserid) {
          continue;
        }
        if (matchingRequestIds && !matchingRequestIds.has(requestId)) {
          continue;
        }
        let hours = sortedResult.get(hhmm);
        if (!hours) {
          hours = new Map<string, string[]>();
          sortedResult.set(hhmm, hours);
        }
        let keys = hours.get(requestId);
        if (!keys) {
          keys = [];
          hours.set(requestId, keys);
        }
        keys.push(log);
      }
    }

    const output = fs.createWriteStream(outputFile, { encoding: "utf8" });
    for (const [, hours] of sortedResult) {
      for (const [, keys] of hours) {
        for (const k of keys) {
          output.write(k + "\n");
        }
        output.write("\n");
      }
    }
    output.end();

    await new Promise<void>((resolve, reject) => {
      output.on("finish", resolve);
      output.on("error", reject);
    });
  }
}
