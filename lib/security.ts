import * as Crypto from "expo-crypto";

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `wealthos:${pin}`);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const candidate = await hashPin(pin);
  return candidate === hash;
}
