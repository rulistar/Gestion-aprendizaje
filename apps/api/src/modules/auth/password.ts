import argon2 from 'argon2';

/**
 * Hash Argon2id con los parámetros por defecto de la librería (64 MiB, 3 iteraciones),
 * que cumplen la recomendación de OWASP. El resultado incluye sal y parámetros:
 * "$argon2id$v=19$m=65536,t=3,p=4$<sal>$<hash>".
 */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
