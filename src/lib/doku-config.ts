import { decryptSecret, encryptSecret } from "./encrypted-secret.ts";

export const DOKU_PAYMENT_CHANNELS = [
  "INTERNET_BANKING_FPX",
  "EWALLET_TNG",
  "EWALLET_GRABPAY",
  "EWALLET_SHOPEEPAY",
  "CREDIT_CARD",
] as const;

export type DokuPaymentChannel = (typeof DOKU_PAYMENT_CHANNELS)[number];
export type DokuConfigEnvironment = "sandbox" | "production";

export type DokuConfigDraft = {
  environment: DokuConfigEnvironment;
  clientId: string;
  apiKey: string;
  secretKey: string;
  enabledChannels: readonly string[];
};

export type DokuConfigStatus = {
  source: "none" | "database";
  health: "missing" | "ready" | "invalid";
  environment: DokuConfigEnvironment | null;
  configured: boolean;
  enabled: boolean;
  clientIdMasked: string;
  apiKeyMasked: string;
  secretKeyMasked: string;
  enabledChannels: DokuPaymentChannel[];
  configRevision: number | null;
};

export type DokuRuntimeConfig = {
  environment: DokuConfigEnvironment;
  clientId: string;
  apiKey: string;
  secretKey: string;
  enabledChannels: DokuPaymentChannel[];
  configRevision: number;
};

type DokuConfigRow = {
  environment: string;
  client_id: string | null;
  api_key_ciphertext: string | null;
  secret_key_ciphertext: string | null;
  enabled_channels_json: string;
  is_enabled: number;
  config_revision: number;
};

export class DokuConfigError extends Error {
  readonly code:
    | "DOKU_CONFIG_INVALID"
    | "DOKU_CONFIG_STORE_MISSING"
    | "DOKU_CONFIG_WRITE_FAILED"
    | "DOKU_CONFIG_STALE"
    | "DOKU_CONFIG_ACTIVE_ATTEMPTS"
    | "DOKU_CONFIG_NOT_READY";

  constructor(code: DokuConfigError["code"]) {
    super(code);
    this.name = "DokuConfigError";
    this.code = code;
  }
}

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const CREDENTIAL_PATTERN = /^[\x21-\x7E]{8,512}$/;

function isEnvironment(value: unknown): value is DokuConfigEnvironment {
  return value === "sandbox" || value === "production";
}

function normalizeCredential(value: string): string {
  const clean = value.trim();
  if (!CREDENTIAL_PATTERN.test(clean) || clean.includes(":")) {
    throw new DokuConfigError("DOKU_CONFIG_INVALID");
  }
  return clean;
}

function normalizeClientId(value: string): string {
  const clean = value.trim();
  if (!CLIENT_ID_PATTERN.test(clean)) throw new DokuConfigError("DOKU_CONFIG_INVALID");
  return clean;
}

function normalizeChannels(values: readonly string[]): DokuPaymentChannel[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > DOKU_PAYMENT_CHANNELS.length) {
    throw new DokuConfigError("DOKU_CONFIG_INVALID");
  }
  const unique = new Set(values);
  if (
    unique.size !== values.length ||
    values.some((value) => !DOKU_PAYMENT_CHANNELS.includes(value as DokuPaymentChannel))
  ) {
    throw new DokuConfigError("DOKU_CONFIG_INVALID");
  }
  return DOKU_PAYMENT_CHANNELS.filter((channel) => unique.has(channel));
}

function purpose(environment: DokuConfigEnvironment, field: "api-key" | "secret-key") {
  return `mybookcms:doku:${environment}:${field}:v1`;
}

export function maskDokuCredential(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function normalizeDokuConfigDraft(draft: DokuConfigDraft): DokuConfigDraft & {
  enabledChannels: DokuPaymentChannel[];
} {
  if (!isEnvironment(draft.environment)) throw new DokuConfigError("DOKU_CONFIG_INVALID");
  return {
    environment: draft.environment,
    clientId: normalizeClientId(draft.clientId),
    apiKey: normalizeCredential(draft.apiKey),
    secretKey: normalizeCredential(draft.secretKey),
    enabledChannels: normalizeChannels(draft.enabledChannels),
  };
}

async function firstStoreId(database: D1Database): Promise<number> {
  const store = await database
    .prepare("SELECT id FROM stores ORDER BY id LIMIT 1")
    .first<{ id: number }>();
  if (!store || !Number.isSafeInteger(store.id) || store.id <= 0) {
    throw new DokuConfigError("DOKU_CONFIG_STORE_MISSING");
  }
  return store.id;
}

async function readRow(database: D1Database): Promise<DokuConfigRow | null> {
  return database
    .prepare(`
      SELECT environment, client_id, api_key_ciphertext, secret_key_ciphertext,
        enabled_channels_json, is_enabled, config_revision
      FROM payment_provider_configs
      WHERE provider = 'doku'
      ORDER BY id
      LIMIT 1
    `)
    .first<DokuConfigRow>();
}

async function hasCurrentRevisionAttempt(
  database: D1Database,
  configRevision: number,
): Promise<boolean> {
  return Boolean(await database.prepare(`
    SELECT 1 AS found
    FROM payment_attempts pa
    JOIN payment_provider_configs pc ON pc.id = pa.provider_config_id
    WHERE pc.provider = 'doku'
      AND pa.config_revision = ?
      AND pa.local_status IN ('created', 'pending', 'attention_required')
    LIMIT 1
  `).bind(configRevision).first<{ found: number }>());
}

async function mutationConflict(
  database: D1Database,
  expectedRevision: number | null,
): Promise<DokuConfigError> {
  const row = await readRow(database);
  if (!row || expectedRevision === null || row.config_revision !== expectedRevision) {
    return new DokuConfigError("DOKU_CONFIG_STALE");
  }
  if (await hasCurrentRevisionAttempt(database, expectedRevision)) {
    return new DokuConfigError("DOKU_CONFIG_ACTIVE_ATTEMPTS");
  }
  return new DokuConfigError("DOKU_CONFIG_WRITE_FAILED");
}

export async function replaceDokuConfigDraft(
  database: D1Database,
  rootSecret: string,
  draft: DokuConfigDraft,
  expectedRevision: number | null,
): Promise<void> {
  const normalized = normalizeDokuConfigDraft(draft);
  const [apiKeyCiphertext, secretKeyCiphertext, storeId] = await Promise.all([
    encryptSecret(normalized.apiKey, rootSecret, purpose(normalized.environment, "api-key")),
    encryptSecret(normalized.secretKey, rootSecret, purpose(normalized.environment, "secret-key")),
    firstStoreId(database),
  ]);
  const channels = JSON.stringify(normalized.enabledChannels);
  const statement = expectedRevision === null
    ? database.prepare(`
        INSERT INTO payment_provider_configs (
          store_id, provider, environment, client_id, api_key_ciphertext,
          secret_key_ciphertext, enabled_channels_json, is_enabled,
          config_revision, created_at, updated_at
        ) VALUES (?, 'doku', ?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(store_id, provider) DO NOTHING
      `).bind(
        storeId,
        normalized.environment,
        normalized.clientId,
        apiKeyCiphertext,
        secretKeyCiphertext,
        channels,
      )
    : database.prepare(`
        UPDATE payment_provider_configs SET
          environment = ?, client_id = ?, api_key_ciphertext = ?,
          secret_key_ciphertext = ?, enabled_channels_json = ?, is_enabled = 0,
          config_revision = config_revision + 1, updated_at = CURRENT_TIMESTAMP
        WHERE store_id = ? AND provider = 'doku' AND config_revision = ?
          AND NOT EXISTS (
            SELECT 1 FROM payment_attempts
            WHERE provider_config_id = payment_provider_configs.id
              AND config_revision = payment_provider_configs.config_revision
              AND local_status IN ('created', 'pending', 'attention_required')
          )
      `).bind(
        normalized.environment,
        normalized.clientId,
        apiKeyCiphertext,
        secretKeyCiphertext,
        channels,
        storeId,
        expectedRevision,
      );
  const result = await statement.run();
  if ((result.meta?.changes ?? 0) !== 1) {
    throw await mutationConflict(database, expectedRevision);
  }
}

export async function saveDokuConfigDraft(
  database: D1Database,
  rootSecret: string,
  draft: DokuConfigDraft,
): Promise<void> {
  const current = await readRow(database);
  await replaceDokuConfigDraft(database, rootSecret, draft, current?.config_revision ?? null);
}

export async function clearDokuConfigDraft(
  database: D1Database,
  expectedRevision?: number,
): Promise<void> {
  const revision = expectedRevision ?? (await readRow(database))?.config_revision ?? null;
  if (revision === null) throw new DokuConfigError("DOKU_CONFIG_STALE");
  const result = await database
    .prepare(`
      UPDATE payment_provider_configs SET
        client_id = NULL,
        api_key_ciphertext = NULL,
        secret_key_ciphertext = NULL,
        enabled_channels_json = '[]',
        is_enabled = 0,
        config_revision = config_revision + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE provider = 'doku' AND config_revision = ?
        AND NOT EXISTS (
          SELECT 1 FROM payment_attempts
          WHERE provider_config_id = payment_provider_configs.id
            AND config_revision = payment_provider_configs.config_revision
            AND local_status IN ('created', 'pending', 'attention_required')
        )
    `)
    .bind(revision)
    .run();
  if ((result.meta?.changes ?? 0) !== 1) throw await mutationConflict(database, revision);
}

export async function setDokuConfigEnabled(
  database: D1Database,
  rootSecret: string,
  expectedRevision: number,
  enabled: boolean,
): Promise<void> {
  const status = await getDokuConfigStatus(database, rootSecret);
  if (status.configRevision !== expectedRevision) {
    throw new DokuConfigError("DOKU_CONFIG_STALE");
  }
  if (enabled && (status.health !== "ready" || !status.configured)) {
    throw new DokuConfigError("DOKU_CONFIG_NOT_READY");
  }
  const result = await database.prepare(`
    UPDATE payment_provider_configs SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE provider = 'doku' AND config_revision = ?
      AND client_id IS NOT NULL AND api_key_ciphertext IS NOT NULL
      AND secret_key_ciphertext IS NOT NULL
      AND json_array_length(enabled_channels_json) > 0
  `).bind(enabled ? 1 : 0, expectedRevision).run();
  if ((result.meta?.changes ?? 0) !== 1) {
    const current = await readRow(database);
    throw new DokuConfigError(
      current?.config_revision === expectedRevision
        ? "DOKU_CONFIG_NOT_READY"
        : "DOKU_CONFIG_STALE",
    );
  }
}

async function inspectRow(
  row: DokuConfigRow,
  rootSecret: string,
): Promise<{ status: DokuConfigStatus; runtime: DokuRuntimeConfig | null }> {
  const base = {
    source: "database" as const,
    environment: isEnvironment(row.environment) ? row.environment : null,
    enabled: row.is_enabled === 1,
    configRevision:
      Number.isSafeInteger(row.config_revision) && row.config_revision > 0
        ? row.config_revision
        : null,
  };
  const empty =
    !row.client_id &&
    !row.api_key_ciphertext &&
    !row.secret_key_ciphertext &&
    row.enabled_channels_json === "[]";
  if (empty && base.environment && base.configRevision) {
    return {
      status: {
        ...base,
        health: "missing",
        configured: false,
        enabled: false,
        clientIdMasked: "",
        apiKeyMasked: "",
        secretKeyMasked: "",
        enabledChannels: [],
      },
      runtime: null,
    };
  }

  try {
    if (
      !base.environment ||
      !base.configRevision ||
      !row.client_id ||
      !row.api_key_ciphertext ||
      !row.secret_key_ciphertext ||
      ![0, 1].includes(row.is_enabled)
    ) {
      throw new DokuConfigError("DOKU_CONFIG_INVALID");
    }
    const channelsValue = JSON.parse(row.enabled_channels_json) as unknown;
    if (!Array.isArray(channelsValue) || channelsValue.some((value) => typeof value !== "string")) {
      throw new DokuConfigError("DOKU_CONFIG_INVALID");
    }
    const enabledChannels = normalizeChannels(channelsValue);
    const [apiKey, secretKey] = await Promise.all([
      decryptSecret(
        row.api_key_ciphertext,
        rootSecret,
        purpose(base.environment, "api-key"),
      ),
      decryptSecret(
        row.secret_key_ciphertext,
        rootSecret,
        purpose(base.environment, "secret-key"),
      ),
    ]);
    const clientId = normalizeClientId(row.client_id);
    normalizeCredential(apiKey);
    normalizeCredential(secretKey);
    const runtime: DokuRuntimeConfig = {
      environment: base.environment,
      clientId,
      apiKey,
      secretKey,
      enabledChannels,
      configRevision: base.configRevision,
    };
    return {
      status: {
        ...base,
        health: "ready",
        configured: true,
        clientIdMasked: maskDokuCredential(clientId),
        apiKeyMasked: maskDokuCredential(apiKey),
        secretKeyMasked: maskDokuCredential(secretKey),
        enabledChannels,
      },
      runtime,
    };
  } catch {
    return {
      status: {
        ...base,
        health: "invalid",
        configured: false,
        enabled: false,
        clientIdMasked: "",
        apiKeyMasked: "",
        secretKeyMasked: "",
        enabledChannels: [],
      },
      runtime: null,
    };
  }
}

const MISSING_STATUS: DokuConfigStatus = {
  source: "none",
  health: "missing",
  environment: null,
  configured: false,
  enabled: false,
  clientIdMasked: "",
  apiKeyMasked: "",
  secretKeyMasked: "",
  enabledChannels: [],
  configRevision: null,
};

export async function getDokuConfigStatus(
  database: D1Database,
  rootSecret: string,
): Promise<DokuConfigStatus> {
  const row = await readRow(database);
  return row ? (await inspectRow(row, rootSecret)).status : { ...MISSING_STATUS };
}

export async function getEnabledDokuConfig(
  database: D1Database,
  rootSecret: string,
): Promise<DokuRuntimeConfig | null> {
  const row = await readRow(database);
  if (!row || row.is_enabled !== 1) return null;
  return (await inspectRow(row, rootSecret)).runtime;
}
