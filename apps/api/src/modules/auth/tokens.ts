import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes aleatorios (256 bits): imposible de adivinar. Es lo único que recibe el usuario */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * En la BD solo se guarda el hash: quien lea la tabla no puede usar los tokens.
 * Lo usan las sesiones y las invitaciones.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
