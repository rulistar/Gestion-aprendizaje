# ADR-0003: Despliegue gratuito en Render + Neon, junto a Gestor de Proyectos

- **Estado:** Aceptado (2026-11-07)
- **Decide:** Product Owner, a propuesta del equipo técnico
- **Contexto:** TEC-04 pide publicar la app con HTTPS y presupuesto de $0. Gestor de Proyectos ya usa Render + Neon (su ADR-0007, que comparó las alternativas). Hay que confirmar que los límites gratuitos alcanzan para **dos** apps.

## Límites revisados (condiciones vigentes al 2026-11-07)

| Servicio | Límite gratuito | Alcance | Con dos apps |
|---|---|---|---|
| Render | 750 horas de instancia al mes | **Por workspace, compartidas** | Solo cuentan las horas despierto. Agotarlas exige unas 12 h diarias despiertas, cada app, todo el mes |
| Render | Se duerme tras 15 min sin tráfico; despertar tarda ~1 min | Por servicio | Cada app despierta por separado |
| Render | Ancho de banda y minutos de compilación incluidos; la documentación no da la cantidad (se ve en el panel) | Por workspace | Compartidos. Sin compilación, las apps siguen corriendo con la última versión |
| Neon | 1 GB de almacenamiento y 100 CU-h al mes; 5 GB de transferencia | **Por proyecto** | No se comparten: cada app tiene su proyecto |
| Neon | 100 proyectos y 20 GB en total | Por cuenta | Sobra |
| Neon | Se suspende a los 5 min sin uso; restauración de hasta 6 h | Por proyecto | Igual que en Gestor de Proyectos |

Fuentes: [Render, Deploy for Free](https://render.com/docs/free) y [Neon, Plans](https://neon.com/docs/introduction/plans).

## Decisión

1. **Las mismas plataformas de Gestor de Proyectos**: Render Free (Virginia) para la app y Neon Free (AWS us-east-1) para la BD, con un Blueprint en [`render.yaml`](../../render.yaml).
2. **El mismo workspace de Render** (decisión del PO, 2026-11-07): es lo más simple y el consumo previsto queda lejos del límite. Neon, en un **proyecto propio**: cada app es dueña de sus datos (ADR-0001).
3. **Un solo servicio**: la API también sirve la web compilada con `@fastify/static` 10 (plugin oficial de Fastify, el mismo de Gestor de Proyectos, aprobado por el PO). Con una sola URL, la cookie de sesión sigue siendo del mismo sitio y CORS queda restringido a esa URL.
4. **Despliegue desde `main` solo con CI en verde**, **migraciones en el build** (el plan gratuito no tiene comando previo al despliegue) y **secretos solo en Render** (`sync: false`).
5. **El primer Admin y las contraseñas olvidadas** se resuelven desde la PC del PO contra Neon (`pnpm setup:admin`, `pnpm reset:password`): el plan gratuito de Render no tiene consola.
6. **Respaldos con `pg_dump`** por el PO, porque Neon Free solo guarda 6 h de historia. Detalle en [docs/despliegue.md](../despliegue.md).

## Consecuencias

- **Riesgo compartido:** si el workspace agota las 750 h, Render suspende **todos** sus servicios gratuitos hasta el mes siguiente, incluido Gestor de Proyectos. Render avisa por correo al acercarse al límite. Si pasa, la salida es mover una app a otro workspace, tras confirmar que este tenga sus propias horas gratis (no quedó verificado).
- **Nada de mantener la app despierta:** un monitor que la consulte cada pocos minutos la dejaría encendida 24 h al día (unas 720 h al mes) y agotaría casi todo el límite compartido.
- **La integración debe cuidar las horas (INT-01):** cada sincronización despierta a las dos apps y las deja encendidas al menos 15 min. Una sincronización frecuente programada podría gastar el límite; se debe tener en cuenta al diseñarla.
- **Primera visita lenta** tras 15 min sin uso (~1 min). Aceptable para uso personal.
