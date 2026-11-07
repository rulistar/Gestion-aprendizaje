# Sprint 3 — publicar la app

- **Fechas:** 2026-11-07 →
- **Objetivo:** dejar la app publicada gratis, con forma de recuperar la cuenta, y definir la integración con Gestor de Proyectos.
- **Capacidad:** por definir con el PO.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-09 | Restablecer una contraseña desde la terminal | 1 | En revisión |
| TEC-04 | Despliegue gratuito (verificar los límites de Render y Neon con dos apps) | 3 | Pendiente |
| TEC-05 | Recorrido en el navegador con Playwright y su check en el CI | 3 | Pendiente |
| TEC-06 | Medir la cobertura de pruebas en el CI | 2 | Pendiente |
| INT-01 | ADR de integración con Gestor de Proyectos | 3 | Pendiente |

## Notas

- **HU-09:** el PO la pidió antes de TEC-04: sin ella, olvidar la contraseña en producción dejaría la cuenta sin salida, porque `setup:admin` solo funciona sin usuarios. Es el mismo comando de Gestor de Proyectos: pide el correo y la contraseña sin mostrarla, y cierra las sesiones de esa cuenta. No incluye el enlace desde la web.
