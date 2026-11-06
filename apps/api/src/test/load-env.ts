// Cada archivo de pruebas corre en su propio proceso: se carga el .env de la raíz si existe
try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // Sin .env (por ejemplo en CI): se usan las variables de entorno del sistema
}
