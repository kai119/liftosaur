function safeRequireLocaldomain() {
  try {
    return require("./localdomain");
  } catch (e) {
    return require("./localdomain.default");
  }
}

function resolveConfig(env) {
  env = env || process.env;
  const isDev = env.NODE_ENV !== "production";
  const storage = {
    dynamoEndpoint: env.DYNAMO_ENDPOINT || "http://localhost:8000",
    s3Endpoint: env.S3_ENDPOINT || "http://localhost:9000",
  };
  const flags = {};

  if (isDev) {
    const domains = safeRequireLocaldomain();
    const port = domains.port || 8080;
    const apiPort = domains.apiPort || 3000;
    const streamingApiPort = domains.streamingApiPort || 3001;
    return {
      isDev: true,
      host: `https://${domains.main}.liftosaur.com:${port}`,
      apiHost: `https://${domains.api}.liftosaur.com:${apiPort}`,
      streamingApiHost: `https://${domains.streamingapi}.liftosaur.com:${streamingApiPort}`,
      port,
      apiPort,
      streamingApiPort,
      metroPort: domains.metroPort || 8081,
      storage,
      flags,
    };
  }

  if (!env.HOST) {
    throw new Error(
      "HOST environment variable is required when NODE_ENV=production. " +
        "Set it to your self-hosted origin, e.g. https://lift.example.com"
    );
  }
  const serverPort = Number(env.SERVER_PORT) || 3000;
  return {
    isDev: false,
    host: env.HOST,
    apiHost: env.HOST,
    streamingApiHost: env.HOST,
    port: serverPort,
    apiPort: serverPort,
    streamingApiPort: serverPort,
    metroPort: null,
    storage,
    flags,
  };
}

module.exports = resolveConfig();
module.exports.resolveConfig = resolveConfig;
