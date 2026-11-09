# Sprint 3 — publicar la app

- **Fechas:** 2026-11-07 → 2026-11-08 (cerrado)
- **Objetivo:** dejar la app publicada gratis, con forma de recuperar la cuenta, y definir la integración con Gestor de Proyectos.
- **Capacidad:** no se fijó al inicio; se entregaron 12 puntos.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-09 | Restablecer una contraseña desde la terminal | 1 | Terminado |
| TEC-04 | Despliegue gratuito (verificar los límites de Render y Neon con dos apps) | 3 | Terminado |
| TEC-05 | Recorrido en el navegador con Playwright y su check en el CI | 3 | Terminado |
| TEC-06 | Medir la cobertura de pruebas en el CI | 2 | Terminado |
| INT-01 | ADR de integración con Gestor de Proyectos | 3 | Terminado |

## Notas

- **HU-09:** el PO la pidió antes de TEC-04: sin ella, olvidar la contraseña en producción dejaría la cuenta sin salida, porque `setup:admin` solo funciona sin usuarios. Es el mismo comando de Gestor de Proyectos: pide el correo y la contraseña sin mostrarla, y cierra las sesiones de esa cuenta. No incluye el enlace desde la web.
- **TEC-04:** los límites se revisaron el 2026-11-07 ([ADR-0003](../adr/ADR-0003-despliegue.md)). Las 750 h de Render son por workspace y las dos apps las comparten; el PO decidió usar el mismo workspace. Neon no se comparte: cada app tiene su proyecto. Publicada el 2026-11-08 en <https://gestion-aprendizaje.onrender.com>, con su primer Admin.
- **TEC-05:** el recorrido inicia sesión, crea un elemento con una actividad, la marca como Hecha y comprueba el avance en la ficha y en la lista. Corre en un job propio del CI; al fusionarlo, el PO agrega ese check (**Pruebas en el navegador (Playwright)**) a los obligatorios del ruleset de `main`, y Render espera también a ese check para desplegar.
- **TEC-06:** el PO decidió que el CI **falle** si la cobertura baja del 70 % (objetivo 3 del acta), no solo que la informe. Medición inicial (2026-11-08): shared 75.5 % de líneas y la API 98.2 %. En shared, lo que baja el número son los esquemas Zod de auth, catálogos, invitaciones y workspaces, que solo se prueban a través de la API.
- **INT-01:** [ADR-0004](../adr/ADR-0004-integracion-gestor-proyectos.md). Decisiones del PO: solo de Aprendizaje a Proyectos, la estructura completa (elemento → proyecto, capítulo o curso → fase, actividad → tarea), envío automático con reintentos y Aprendizaje primero. Proyectos necesita TEC-08 y HU-18 en su v2; por eso el objetivo 4 del acta cambió de fecha y se agregó INT-04.

## Cierre (2026-11-08)

- **Entregado:** 5 de 5 elementos, 12 puntos (PR 13, 14, 15, 16, 18 y 20). Objetivo cumplido: la app está publicada gratis, la cuenta se puede recuperar y la integración quedó diseñada.
- **`main`** exige ahora 4 checks: lint, tipos y pruebas con cobertura; auditoría; gitleaks; y el recorrido de Playwright. Render solo despliega cuando pasan.

### Lo que aprendimos

- **Publicar:** Neon llama `production` a su rama principal, y el host de la cadena con `-pooler` indica que el pooling sigue activo. A Render se entra con el botón de GitHub, no con correo y contraseña; demasiados intentos bloquean el acceso un rato. La acción para crear el servicio se llama **Create web service**. Todo quedó en [despliegue.md](../despliegue.md).
- **Verificar antes de seguir:** confirmar en `origin/main` que un PR se fusionó evitó empezar una historia sobre una base vieja.
- **Un check obligatorio** solo aparece en el ruleset después de correr una vez. Escribirlo a mano con otro nombre bloquearía todas las fusiones.
- **Seguridad en las dependencias:** `@fastify/static` 10.1.6 traía una alerta moderada en `glob`; la 10.1.10 la quita. Gestor de Proyectos sigue en la 10.1.6.
- **`WEB_DIST_DIR`** debe ser una ruta absoluta: ahora la configuración lo valida al arrancar. El `.env.example` de Gestor de Proyectos todavía trae el ejemplo relativo.

### Pendiente

- PRs de Dependabot abiertos: revisarlos antes de empezar a construir el Sprint 4.
