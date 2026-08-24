export type IDynamoAttributeType = "S" | "N" | "B";

export interface IDynamoKeyAttribute {
  name: string;
  type: IDynamoAttributeType;
}

export interface IDynamoGsiDefinition {
  name: string;
  partitionKey: IDynamoKeyAttribute;
  sortKey?: IDynamoKeyAttribute;
  // CDK creates this one GSI with the same literal name in both the dev and prod stacks
  // (liftosaur-cdk/liftosaur-cdk.ts:297-301) instead of suffixing it like every other index.
  suffixed?: boolean;
}

export interface IDynamoTableDefinition {
  name: string;
  partitionKey: IDynamoKeyAttribute;
  sortKey?: IDynamoKeyAttribute;
  gsis?: IDynamoGsiDefinition[];
  ttlAttribute?: string;
}

const baseTableDefinitions: IDynamoTableDefinition[] = [
  {
    name: "lftUsers",
    partitionKey: { name: "id", type: "S" },
    gsis: [
      { name: "lftUsersGoogleId", partitionKey: { name: "googleId", type: "S" } },
      { name: "lftUsersAppleId", partitionKey: { name: "appleId", type: "S" } },
      { name: "lftUsersEmail", partitionKey: { name: "email", type: "S" } },
      { name: "lftUsersNickname", partitionKey: { name: "nickname", type: "S" } },
    ],
  },
  {
    name: "lftAffiliates",
    partitionKey: { name: "affiliateId", type: "S" },
    sortKey: { name: "userId", type: "S" },
    gsis: [{ name: "lftAffiliatesUserId", partitionKey: { name: "userId", type: "S" } }],
  },
  {
    name: "lftSubscriptionDetails",
    partitionKey: { name: "userId", type: "S" },
    gsis: [
      {
        name: "lftSubscriptionDetailsOriginalTransactionId",
        partitionKey: { name: "originalTransactionId", type: "S" },
      },
    ],
  },
  {
    name: "lftPayments",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "timestamp", type: "N" },
    gsis: [{ name: "lftPaymentsTransactionId", partitionKey: { name: "transactionId", type: "S" } }],
  },
  { name: "lftGoogleAuthKeys", partitionKey: { name: "token", type: "S" } },
  { name: "lftAppleAuthKeys", partitionKey: { name: "token", type: "S" } },
  {
    name: "lftHistoryRecords",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "id", type: "N" },
    gsis: [
      {
        name: "lftHistoryRecordsDate",
        partitionKey: { name: "userId", type: "S" },
        sortKey: { name: "date", type: "S" },
      },
    ],
  },
  {
    name: "lftStats",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "name", type: "S" },
    gsis: [
      {
        name: "lftStatsTimestamp",
        partitionKey: { name: "userId", type: "S" },
        sortKey: { name: "timestamp", type: "N" },
      },
    ],
  },
  {
    name: "lftLogs",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "action", type: "S" },
    gsis: [
      { name: "lftLogsDate", partitionKey: { name: "year", type: "N" }, sortKey: { name: "month", type: "N" } },
    ],
  },
  { name: "lftUserPrograms", partitionKey: { name: "userId", type: "S" }, sortKey: { name: "id", type: "S" } },
  { name: "lftPrograms", partitionKey: { name: "id", type: "S" } },
  {
    name: "lftUrls",
    partitionKey: { name: "id", type: "S" },
    gsis: [{ name: "lftUrlsUserId", partitionKey: { name: "userId", type: "S" } }],
  },
  { name: "lftFreeUsers", partitionKey: { name: "id", type: "S" } },
  { name: "lftCoupons", partitionKey: { name: "code", type: "S" } },
  {
    name: "lftApiKeys",
    partitionKey: { name: "key", type: "S" },
    gsis: [{ name: "lftApiKeysUserId", partitionKey: { name: "userId", type: "S" } }],
  },
  { name: "lftOauthClients", partitionKey: { name: "clientId", type: "S" } },
  { name: "lftOauthAuthCodes", partitionKey: { name: "code", type: "S" }, ttlAttribute: "ttl" },
  {
    name: "lftOauthTokens",
    partitionKey: { name: "token", type: "S" },
    ttlAttribute: "ttl",
    gsis: [{ name: "lftOauthTokensRefreshToken", partitionKey: { name: "refreshToken", type: "S" } }],
  },
  { name: "lftEmailAuthTokens", partitionKey: { name: "token", type: "S" }, ttlAttribute: "ttl" },
  { name: "lftDebug", partitionKey: { name: "id", type: "S" } },
  {
    name: "lftEvents",
    partitionKey: { name: "userId", type: "S" },
    sortKey: { name: "timestamp", type: "N" },
    ttlAttribute: "ttl",
    gsis: [
      { name: "lftEventsName", partitionKey: { name: "name", type: "S" }, sortKey: { name: "timestamp", type: "N" } },
    ],
  },
  {
    name: "lftAiLogs",
    partitionKey: { name: "id", type: "S" },
    ttlAttribute: "ttl",
    gsis: [
      {
        name: "userId-timestamp-index",
        partitionKey: { name: "userId", type: "S" },
        sortKey: { name: "timestamp", type: "N" },
        suffixed: false,
      },
    ],
  },
  { name: "lftAiMuscleCaches", partitionKey: { name: "key", type: "S" } },
];

export function DynamoTableDefinitions_forSuffix(suffix: "" | "Dev"): IDynamoTableDefinition[] {
  return baseTableDefinitions.map((table) => ({
    ...table,
    name: `${table.name}${suffix}`,
    gsis: table.gsis?.map((gsi) => ({
      ...gsi,
      name: gsi.suffixed === false ? gsi.name : `${gsi.name}${suffix}`,
    })),
  }));
}

export function DynamoTableDefinitions_all(): IDynamoTableDefinition[] {
  return [...DynamoTableDefinitions_forSuffix(""), ...DynamoTableDefinitions_forSuffix("Dev")];
}
