import { betterAuth } from "better-auth";
import { siwe } from "better-auth/plugins";
import { generateRandomString } from "better-auth/crypto";
import { Pool } from "pg";
import { verifyMessage } from "viem";

const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const DOMAIN = (() => {
  try {
    const u = new URL(BASE_URL);
    return u.hostname;
  } catch {
    return "localhost";
  }
})();
// Cookie/security configuration
const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_PROD = NODE_ENV === "production";
// When deploying cross-site (separate auth/app domains), SameSite must be "none" and cookies must be secure.
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE ?? (IS_PROD ? "none" : "lax")) as
  | "lax"
  | "strict"
  | "none";
const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? String(IS_PROD)) === "true";
const COOKIE_PARTITIONED = (process.env.COOKIE_PARTITIONED ?? (IS_PROD ? "true" : "false")) === "true";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN; // e.g. .example.com when using subdomains
// Comma-separated list of trusted origins for CORS and CSRF protections (in addition to server/index.ts CORS)
const TRUSTED_ORIGINS = (process.env.TRUSTED_ORIGINS ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Extra hardening and cookie behavior
  advanced: {
    // Force secure cookies in production or when COOKIE_SECURE=true
    useSecureCookies: COOKIE_SECURE,
    // Default attributes applied to all Better Auth cookies (session_token, etc.)
    defaultCookieAttributes: {
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE,
      // Partitioned cookies are becoming required for some cross-site scenarios
      partitioned: COOKIE_PARTITIONED,
      httpOnly: true,
    },
    // Share cookies across subdomains when a domain is provided
    crossSubDomainCookies: COOKIE_DOMAIN
      ? {
          enabled: true,
          domain: COOKIE_DOMAIN,
        }
      : undefined,
  },
  // Better Auth uses this to validate cross-origin requests
  trustedOrigins: TRUSTED_ORIGINS,
  // Add social providers here if needed, e.g. github/google using env vars
  // socialProviders: { ... }
  plugins: [
    siwe({
      domain: DOMAIN,
      // In dev we allow anonymous SIWE (no email). Set to false to require email on verify.
      anonymous: true,
      getNonce: async () => generateRandomString(32),
      verifyMessage: async ({ message, signature, address }) => {
        try {
          return await verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
          });
        } catch (err) {
          console.error("SIWE verification failed", err);
          return false;
        }
      },
    }),
  ],
});
