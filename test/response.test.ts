import "mocha";
import { expect } from "chai";
import { Config } from "../src/config";
import {
  allowedHosts,
  ResponseUtils_clearSessionCookie,
  ResponseUtils_getHost,
  ResponseUtils_getReferer,
} from "../lambda/utils/response";
import { APIGatewayProxyEvent } from "aws-lambda";

function buildEvent(headers: Record<string, string>): APIGatewayProxyEvent {
  return { headers } as unknown as APIGatewayProxyEvent;
}

describe("response config wiring", () => {
  it("derives allowedHosts from the configured host", () => {
    const configuredHost = new URL(Config.host).host;
    expect(allowedHosts).to.include(configuredHost);
  });

  it("clears the session cookie with a domain attribute in dev, without one in prod", () => {
    const serialized = ResponseUtils_clearSessionCookie();
    if (Config.isDev) {
      expect(serialized.toLowerCase()).to.include("domain=.liftosaur.com");
    } else {
      expect(serialized.toLowerCase()).to.not.include("domain=");
    }
  });

  it("falls back to the configured host when the Host header is missing", () => {
    expect(ResponseUtils_getHost(buildEvent({}))).to.equal(new URL(Config.host).host);
  });

  it("falls back to the configured host when no referer/origin header is present", () => {
    expect(ResponseUtils_getReferer(buildEvent({}))).to.equal(Config.host);
  });
});
