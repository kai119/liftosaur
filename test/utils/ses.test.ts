import "mocha";
import { expect } from "chai";
import { SesUtil } from "../../lambda/utils/ses";
import { MockLogUtil } from "./mockLogUtil";

describe("SesUtil (local, no MTA)", () => {
  it("logs the destination, subject and body instead of sending the email", async () => {
    const log = new MockLogUtil();
    const ses = new SesUtil(log);

    await ses.sendEmail({
      destination: "someone@example.com",
      source: "info@liftosaur.com",
      subject: "Test subject",
      body: "Test body",
    });

    const logText = log.logs.join("\n");
    expect(logText).to.include("someone@example.com");
    expect(logText).to.include("Test subject");
    expect(logText).to.include("Test body");
  });

  it("resolves without throwing, even though nothing is actually delivered", async () => {
    const ses = new SesUtil(new MockLogUtil());
    await ses.sendEmail({ destination: "x@example.com", source: "a@b.com", subject: "s", body: "b" });
  });
});
