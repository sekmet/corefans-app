import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Polyfills for libraries under Jest/jsdom (e.g., viem, wagmi)
// Ensure TextEncoder/TextDecoder exist
// @ts-ignore
if (!(global as any).TextEncoder) (global as any).TextEncoder = TextEncoder;
// @ts-ignore
if (!(global as any).TextDecoder) (global as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;

// Provide webcrypto if missing
try {
  // @ts-ignore
  if (!(global as any).crypto) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { webcrypto } = require("crypto");
    // @ts-ignore
    (global as any).crypto = webcrypto;
  }
} catch {}
