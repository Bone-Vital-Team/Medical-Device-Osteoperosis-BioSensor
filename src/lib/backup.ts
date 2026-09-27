import { requireConsent, createJsonBackup } from "./export";
import { validateStore } from "./storage";
import type { StoreData } from "./model";
const ITERATIONS = 310000;
function base64(bytes: Uint8Array) {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text);
}
function unbase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
async function keyFrom(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (!crypto.subtle)
    throw new Error(
      "Encrypted backups require HTTPS or localhost. Open the secure published app, or choose an unencrypted backup.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptBackup(
  data: StoreData,
  password: string,
  consent: boolean,
): Promise<string> {
  requireConsent(consent);
  if (password.length < 12)
    throw new Error("Use a backup passphrase of at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(createJsonBackup(data, consent)),
  );
  return JSON.stringify(
    {
      format: "bonevital-encrypted-v1",
      kdf: "PBKDF2-SHA256",
      iterations: ITERATIONS,
      cipher: "AES-256-GCM",
      salt: base64(salt),
      iv: base64(iv),
      ciphertext: base64(new Uint8Array(encrypted)),
    },
    null,
    2,
  );
}
export async function decodeBackup(
  text: string,
  password: string,
): Promise<StoreData> {
  if (text.length > 10000000)
    throw new Error("Backup is too large (maximum 10 MB).");
  const envelope = JSON.parse(text);
  if (envelope?.format !== "bonevital-encrypted-v1")
    return validateStore(envelope);
  if (
    envelope.iterations !== ITERATIONS ||
    envelope.kdf !== "PBKDF2-SHA256" ||
    envelope.cipher !== "AES-256-GCM"
  )
    throw new Error("Unsupported encryption format.");
  try {
    const salt = unbase64(envelope.salt),
      iv = unbase64(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error();
    const key = await keyFrom(password, salt);
    const bytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      unbase64(envelope.ciphertext),
    );
    return validateStore(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    throw new Error(
      "Could not open this backup. Check the passphrase and file.",
    );
  }
}
