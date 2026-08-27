import { ILogUtil } from "./log";

export interface ISesUtil {
  sendEmail(args: { destination: string; source: string; subject: string; body: string }): Promise<void>;
}

// No MTA in the self-hosted fork - the only inbox that would ever receive
// this belongs to the account holder, who already has server access. Call
// sites that used to depend on delivery (verify-email, password reset) were
// rewritten in issue #5 to not need it; this just logs the content so
// nothing silently vanishes if a future code path still calls it.
export class SesUtil implements ISesUtil {
  constructor(public readonly log: ILogUtil) {}

  public async sendEmail(args: {
    destination: string;
    source: string;
    subject: string;
    body: string;
  }): Promise<void> {
    this.log.log(`Email (not sent, no MTA configured) to '${args.destination}': ${args.subject}\n${args.body}`);
  }
}
