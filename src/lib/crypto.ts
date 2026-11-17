import crypto from 'node:crypto';

const MASTER_SECRET =
  process.env.VAULT_ENCRYPTION_SECRET ||
  process.env.SQL_PASSWORD ||
  'steufa-stream-aes256gcm-fallback-vault-key-2026';

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(MASTER_SECRET).digest();
}

export function encryptAES256GCM(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptAES256GCM(cipherPayload: string): string {
  const parts = cipherPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export function signLedgerEntry(payload: Record<string, unknown>): string {
  return crypto
    .createHmac('sha256', getEncryptionKey())
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
