import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export { initialPasswordHash } from "./password-bootstrap.mjs";
export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw new Error("Use a password between 8 and 128 characters.");
}
export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: unknown, hash: string) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [algorithm, salt, digest] = hash.split(":");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = await derive(password, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
