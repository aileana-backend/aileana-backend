import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16; // 128-bit tag

export function encryptText(data: string, secretKey: string): string {
  const key = Buffer.from(secretKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: ciphertext + iv + authTag, all hex
  return `${encrypted}${iv.toString('hex')}${authTag.toString('hex')}`;
}

export function decryptText(encryptedData: string, secretKey: string): string {
  const key = Buffer.from(secretKey, 'hex');

  const authTagHex = encryptedData.slice(-AUTH_TAG_LENGTH * 2); // last 32 chars
  const ivHex = encryptedData.slice(
    -((AUTH_TAG_LENGTH + IV_LENGTH) * 2),
    -AUTH_TAG_LENGTH * 2,
  ); // before tag
  const encrypted = encryptedData.slice(
    0,
    -((AUTH_TAG_LENGTH + IV_LENGTH) * 2),
  );

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
