import { rootCertificates } from "node:tls";

export function databaseOptions(env: NodeJS.ProcessEnv) {
  let url: URL | null = null;
  if (env.DATABASE_URL) {
    try {
      url = new URL(env.DATABASE_URL);
      if (!["postgres:", "postgresql:"].includes(url.protocol))
        throw new Error();
    } catch {
      throw new Error("DATABASE_URL_INVALID");
    }
  }
  const sslEnabled = env.DATABASE_SSL === "true";
  const sslParameters = ["sslmode", "sslcert", "sslkey", "sslrootcert"];
  if (url && sslParameters.some((key) => url.searchParams.has(key))) {
    if (!sslEnabled) throw new Error("DATABASE_SSL_REQUIRED");
    // pg connection-string SSL fields override the explicit CA options; use one verified configuration.
    for (const key of sslParameters) url.searchParams.delete(key);
  }
  const max = Number(env.DATABASE_POOL_MAX || "10");
  if (!Number.isInteger(max) || max < 1 || max > 20)
    throw new Error("DATABASE_POOL_MAX_INVALID");
  let ca: string[] | undefined;
  if (env.DATABASE_SSL_CA_BASE64) {
    const pem = Buffer.from(env.DATABASE_SSL_CA_BASE64, "base64").toString(
      "utf8",
    );
    if (
      !sslEnabled ||
      !pem.includes("-----BEGIN CERTIFICATE-----") ||
      !pem.includes("-----END CERTIFICATE-----")
    )
      throw new Error("DATABASE_SSL_CA_INVALID");
    ca = [...rootCertificates, pem];
  }
  return {
    url: url?.toString(),
    ssl: sslEnabled
      ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
      : (false as const),
    extra: { max, connectionTimeoutMillis: 5000 },
  };
}
