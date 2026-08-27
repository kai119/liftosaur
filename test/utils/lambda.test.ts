import "mocha";
import { expect } from "chai";
import { LambdaUtil } from "../../lambda/utils/lambda";
import { MockLogUtil } from "./mockLogUtil";

describe("LambdaUtil (in-process, no self-invoke)", () => {
  async function captureError(fn: () => Promise<void>): Promise<Error | undefined> {
    try {
      await fn();
      return undefined;
    } catch (e) {
      return e as Error;
    }
  }

  it("throws instead of silently no-op'ing, for a RequestResponse invocation", async () => {
    const lambda = new LambdaUtil(new MockLogUtil());
    const error = await captureError(() =>
      lambda.invoke({ name: "someFunction", invocationType: "RequestResponse", payload: {} })
    );
    expect(error?.message).to.include("someFunction");
  });

  it("throws instead of silently no-op'ing, for an Event (fire-and-forget) invocation", async () => {
    const lambda = new LambdaUtil(new MockLogUtil());
    const error = await captureError(() =>
      lambda.invoke({ name: "anotherFunction", invocationType: "Event", payload: {} })
    );
    expect(error?.message).to.include("anotherFunction");
  });
});
