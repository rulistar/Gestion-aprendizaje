# Sprint 3 — publicar la app

- **Fechas:** 2026-11-07 →
- **Objetivo:** dejar la app publicada gratis, con forma de recuperar la cuenta, y definir la integración con Gestor de Proyectos.
- **Capacidad:** por definir con el PO.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-09 | Restablecer una contraseña desde la terminal | 1 | Terminado |
| TEC-04 | Despliegue gratuito (verificar los límites de Render y Neon con dos apps) | 3 | Terminado |
| TEC-05 | Recorrido en el navegador con Playwright y su check en el CI | 3 | En revisión |
| TEC-06 | Medir la cobertura de pruebas en el CI | 2 | Pendiente |
| INT-01 | ADR de integración con Gestor de Proyectos | 3 | Pendiente |

## Notas

- **HU-09:** el PO la pidió antes de TEC-04: sin ella, olvidar la contraseña en producción dejaría la cuenta sin salida, porque `setup:admin` solo funciona sin usuarios. Es el mismo comando de Gestor de Proyectos: pide el correo y la contraseña sin mostrarla, y cierra las sesiones de esa cuenta. No incluye el enlace desde la web.
- **TEC-04:** los límites se revisaron el 2026-11-07 ([ADR-0003](../adr/ADR-0003-despliegue.md)). Las 750 h de Render son por workspace y las dos apps las comparten; el PO decidió usar el mismo workspace. Neon no se comparte: cada app tiene su proyecto. Publicada el 2026-11-08 en <https://gestion-aprendizaje.onrender.com>, con su primer Admin.
- **TEC-05:** el recorrido inicia sesión, crea un elemento con una actividad, la marca como Hecha y comprueba el avance en la ficha y en la lista. Corre en un job propio del CI; al fusionarlo, el PO agrega ese check (**Pruebas en el navegador (Playwright)**) a los obligatorios del ruleset de `main`, y Render espera también a ese check para desplegar.
