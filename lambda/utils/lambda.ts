import { ILogUtil } from "./log";

export interface ILambdaUtil {
  invoke<T>(args: { name: string; invocationType: "RequestResponse" | "Event"; payload: T }): Promise<void>;
}

// Self-invoke has no live callers in this fork (the feature that used it,
// "freeform", was already removed upstream) and there's no generic way to
// fulfill "invoke a function by name" in a single process without a
// name -> handler registry nothing needs yet. Throwing means a future
// caller fails loudly in development instead of silently doing nothing -
// the exact risk issue #5 called out. If a real need shows up, replace this
// with a direct function call to whatever "someFunction" actually is.
export class LambdaUtil implements ILambdaUtil {
  constructor(private readonly log: ILogUtil) {}

  public async invoke<T>(args: {
    name: string;
    invocationType: "RequestResponse" | "Event";
    payload: T;
  }): Promise<void> {
    this.log.log(`LambdaUtil.invoke('${args.name}', '${args.invocationType}') has no in-process implementation`);
    throw new Error(
      `LambdaUtil.invoke('${args.name}') has no in-process implementation. There's only one process now - replace this call with a direct function call.`
    );
  }
}
