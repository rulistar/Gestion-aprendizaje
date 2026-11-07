# Despliegue (TEC-04, ADR-0003)

**Producción:** todavía sin publicar; al crear el servicio, anota aquí su URL.

La aplicación corre en **Render** (un servicio web gratuito que sirve la API y la web) con la base de datos en **Neon**, igual que Gestor de Proyectos pero con servicio y base de datos propios. Este documento explica el primer despliegue, cómo desplegar cambios, ver los registros y respaldar la base de datos.

> **Secretos**: la cadena de conexión de Neon solo se pega en Render y en tu terminal. Nunca en el repositorio, en un issue ni en un chat.

## 1. Primer despliegue (una sola vez)

Ya tienes cuentas en Neon y en Render por Gestor de Proyectos: usa las mismas.

### Neon (base de datos)

1. Crea un proyecto **nuevo**: nombre `gestion-aprendizaje`, **PostgreSQL 17**, región **AWS US East 1 (N. Virginia)**. No uses el de Gestor de Proyectos: cada app es dueña de sus datos.
2. En **Connect**, desactiva **Connection pooling** y copia la cadena (`postgresql://…neon.tech/neondb?sslmode=require`). Esa es la `DATABASE_URL` de producción.

### Render (aplicación)

1. **New → Blueprint** y elige el repositorio `Gestion-aprendizaje`. Si no aparece en la lista, dale acceso a Render desde su integración con GitHub.
2. Render lee [`render.yaml`](../render.yaml) y pide dos valores:
   - `DATABASE_URL`: la cadena de Neon del paso anterior.
   - `CORS_ORIGINS`: la URL que tendrá el servicio, sin `/` al final (`https://gestion-aprendizaje.onrender.com`). Render puede agregarle un sufijo al nombre; si la que asigna es otra, corrígela en **Environment** y vuelve a desplegar.
3. **Apply**. El primer build instala, compila, aplica las migraciones en Neon y arranca. Tarda unos minutos.
4. Abre la URL: debe cargar el inicio de sesión con el candado de HTTPS.

### Primer Admin

El plan gratuito de Render no tiene consola, así que el Admin se crea desde tu PC contra la BD de Neon. **Usa una contraseña distinta a la de desarrollo.** En PowerShell, desde la raíz del repositorio:

```powershell
$env:DATABASE_URL = '<cadena de Neon>'
pnpm setup:admin
Remove-Item Env:DATABASE_URL
```

La variable de la terminal tiene prioridad sobre tu `.env`; al quitarla, `pnpm dev` vuelve a usar tu BD de Docker.

### Olvidé mi contraseña (HU-09)

Se restablece desde tu PC, igual que el primer Admin. Pide el correo y la contraseña nueva sin mostrarla, y cierra las sesiones abiertas de esa cuenta:

```powershell
$env:DATABASE_URL = '<cadena de Neon>'
pnpm reset:password
Remove-Item Env:DATABASE_URL
```

## 2. Desplegar cambios

No hay pasos manuales: cada PR fusionado a `main` se despliega solo **cuando pasan los checks de CI** (`autoDeployTrigger: checksPass`). Las migraciones nuevas se aplican en el build; si una falla, el despliegue se cancela y sigue la versión anterior.

Si un build falla, sigue corriendo la versión anterior. Si el error es raro y no viene de tu cambio, prueba **Manual Deploy → Clear build cache & deploy**.

Para volver a una versión anterior: Render → servicio → **Events** → en un despliegue anterior, **Rollback**. Ojo: el rollback no deshace migraciones.

## 3. Registros

Render → servicio → **Logs**. La API escribe una línea JSON por petición (sin contraseñas, tokens ni cookies). Para ver solo errores, busca `"level":50`.

**La primera visita tarda ~1 min**: el plan gratuito duerme el servicio tras 15 min sin tráfico. No es un error.

## 4. Límites (compartidos con Gestor de Proyectos)

Las 750 horas gratis de Render al mes son **por workspace**: las dos apps gastan de la misma bolsa. Solo cuentan las horas despierto. Si se agotan, **las dos apps** quedan suspendidas hasta el mes siguiente.

- Render avisa por correo al acercarse al límite. El consumo se ve en **Billing**.
- **No uses monitores que mantengan la app despierta**: gastarían unas 720 h al mes solo con una app.

Neon no se comparte: cada proyecto tiene su 1 GB y sus 100 CU-h al mes. Más detalle en [ADR-0003](adr/ADR-0003-despliegue.md).

## 5. Respaldos

Neon Free solo permite volver a cualquier punto de las **últimas 6 horas**. Saca un respaldo propio antes de cada sprint y antes de una migración grande. Necesitas Docker, el mismo que usas para la BD local:

```powershell
$env:NEON_URL = '<cadena de Neon>'
docker run --rm -e NEON_URL postgres:17 sh -c 'pg_dump --no-owner --no-acl "$NEON_URL"' > "respaldo-$(Get-Date -Format yyyy-MM-dd).sql"
Remove-Item Env:NEON_URL
```

Guarda el `.sql` fuera del repositorio: contiene datos personales. Para restaurarlo en una BD vacía:

```powershell
$env:NEON_URL = '<cadena de Neon>'
Get-Content respaldo-AAAA-MM-DD.sql | docker run --rm -i -e NEON_URL postgres:17 sh -c 'psql "$NEON_URL"'
Remove-Item Env:NEON_URL
```

## 6. Variables de producción

| Variable | Valor | Dónde |
|---|---|---|
| `NODE_ENV` | `production` (HTTPS obligatorio, HSTS, cookies `Secure`) | `render.yaml` |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `10000` | `render.yaml` |
| `TRUST_PROXY` | `true` (Render termina el HTTPS) | `render.yaml` |
| `DATABASE_URL` | Cadena de Neon, conexión directa | Render (secreto) |
| `CORS_ORIGINS` | La URL pública del servicio | Render |
| `WEB_DIST_DIR` | No hace falta: en producción se usa `apps/web/dist` | — |
