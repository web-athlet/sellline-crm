import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

interface CipherBlob {
  encrypted: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob: CipherBlob = {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
  return JSON.stringify(blob);
}

export function decryptToken(ciphertext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const { encrypted, iv, authTag } = JSON.parse(ciphertext) as CipherBlob;
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
