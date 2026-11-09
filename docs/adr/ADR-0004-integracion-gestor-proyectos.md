# ADR-0004: Integración con Gestor de Proyectos

- **Estado:** Aceptado (2026-11-08, PR 20)
- **Decide:** Product Owner, a propuesta del equipo técnico
- **Contexto:** INT-01. El acta pide que Gestor de Proyectos reciba de esta app el **avance, las fechas y el estado** (objetivo 4). Cada app es dueña de sus datos y no comparten base de datos (ADR-0002 §7 de Gestor de Proyectos; ADR-0001). Las dos corren en Render Free, que las duerme tras 15 min sin tráfico y les da 750 h al mes **compartidas** (ADR-0003). Gestor de Proyectos está en su periodo de uso real: sin funciones nuevas hasta planear su v2.

## Decisiones del PO (2026-11-08)

1. **Una sola dirección: Aprendizaje → Proyectos.** Aprendizaje es la fuente. Lo que cambia en Proyectos no regresa.
2. **Se refleja la estructura completa.** Un elemento se envía como un proyecto con sus fases y tareas. El avance no se envía: Proyectos lo calcula con sus tareas, con la misma regla (Hechas ÷ no canceladas; ADR-0002 §4).
3. **Envío automático.** Cada cambio llega solo a Proyectos, con reintentos si está dormida o caída.
4. **Aprendizaje primero.** En el Sprint 4 se construye el lado de Aprendizaje, probado contra un receptor de prueba. Lo que necesita Proyectos entra como primeros elementos de su v2. El objetivo 4 del acta cambia de fecha.

## Diseño

### 1. Qué se crea en Proyectos

Mismos estados en las dos apps: no hace falta traducirlos.

| Aprendizaje | Proyectos | Campos que se envían |
|---|---|---|
| Elemento | Proyecto | Nombre, estado, fechas estimadas y reales |
| Capítulo o curso | Fase (un capítulo dentro de otro, o un curso dentro de un capítulo, es una subfase) | Nombre y orden |
| Actividad | Tarea, en la fase de su padre (o sin fase si está en la raíz) | Nombre → título, estado, duración en minutos → minutos estimados, fechas estimadas y reales |

- Se activa por elemento: el botón **Enviar a Gestor de Proyectos** en la ficha. Desde ese momento, el elemento queda **sincronizado**: cada cambio se envía. **Dejar de sincronizar** corta el vínculo y no borra nada en Proyectos.
- Quitar un nodo, o el elemento, lo manda a la papelera de Proyectos. Si después se restaura en Aprendizaje (la papelera de Aprendizaje es HU-07), se vuelve a crear en Proyectos.
- Lo que no tiene equivalente en Proyectos (plataforma, patrocinador, categoría, nivel, notas, horas por día) no se envía. Puede agregarse después sin cambiar el diseño.

### 2. Cómo viaja: llamadas a la API de Proyectos, con bandeja de salida

```
APRENDIZAJE                                                   PROYECTOS
cambio en un elemento ──┐
                        │ misma transacción
                        ▼
                 sync_outbox (pendiente) ── proceso de envío ──► API /api/v1 (token Bearer)
                        ▲          lee el estado ACTUAL,          como usuario de servicio
                        │          espera 30 s a que termines,     │
                        └── reintenta con espera creciente ◄───────┘ 2xx: se marca enviado
```

- **Bandeja de salida (outbox):** cada cambio de un elemento sincronizado deja una marca en `sync_outbox` **en la misma transacción** que el cambio. Si el servidor se reinicia o Render lo duerme, la marca sigue ahí y se envía al despertar. No se pierde ningún cambio.
- **Se envía el estado, no el evento:** el proceso lee cómo está el elemento **ahora** y lo deja igual en Proyectos. Así, diez cambios seguidos se envían como uno solo, el orden no importa y repetir un envío no daña nada (idempotente).
- **Espera de 30 s** desde el último cambio antes de enviar, para juntar varias ediciones en un solo envío.
- **Reintentos:** si Proyectos no responde (dormida tarda ~1 min en despertar; el envío espera hasta 90 s) o falla, se reintenta a 1 min, 5 min, 15 min y después cada hora. Tras 24 h sin éxito se marca **fallido** y la ficha lo muestra, con un botón para reintentar.
- **Ritmo:** máximo 30 llamadas por minuto, debajo del límite de 100 por minuto de la API de Proyectos. Enviar un elemento grande por primera vez puede tardar unos minutos.
- El proceso corre **dentro de la misma app**, mientras está despierta: el plan gratuito no tiene procesos en segundo plano. Al arrancar, revisa lo pendiente.

**Por qué llamadas a la API y no un webhook entrante en Proyectos:** con una sola dirección, Aprendizaje no necesita escuchar avisos; solo ordena cambios. Usar la API que Proyectos ya tiene reutiliza sus validaciones, permisos, trazabilidad (`updatedBy` = el usuario de servicio) y papelera, en lugar de escribir en Proyectos otra lógica que traduzca avisos en cambios. El resultado para el PO es el mismo: automático y con reintentos.

### 3. Vínculos

- En Aprendizaje, la tabla `sync_links` guarda qué nodo corresponde a qué proyecto, fase o tarea de Proyectos (sus IDs, como texto) y cuándo se envió por última vez.
- En Proyectos, cada registro creado por la integración guarda su **referencia externa** (app, tipo e ID en Aprendizaje), única. Si un envío se repite porque se perdió la respuesta, Proyectos devuelve el que ya existe en lugar de duplicarlo. También sirve para mostrar en Proyectos "Viene de Gestor de Aprendizaje" con un enlace.

### 4. Seguridad

- **Usuario de servicio en Proyectos:** el Admin registra a Gestor de Aprendizaje como app externa (`ApiClient`) en **un** espacio de trabajo. Es un usuario `SERVICE` (no inicia sesión con contraseña), miembro de ese espacio con permiso solo para crear y modificar **lo suyo** (matriz ADR-0006 de Proyectos). No ve ni toca lo demás.
- **Token de API:** Proyectos lo muestra **una vez**, guarda solo su hash y lo puede revocar. En Aprendizaje vive **solo en variables de entorno** (Render y `.env`), nunca en la BD, el código ni los registros: `PROYECTOS_API_URL`, `PROYECTOS_API_TOKEN` y `PROYECTOS_WORKSPACE_ID`, validadas con Zod. Sin ellas, la integración queda apagada y el botón no aparece.
- **Solo HTTPS** en producción, y cada respuesta de Proyectos se valida con Zod antes de guardar un vínculo.
- **Una conexión por instalación:** todos los elementos sincronizados van al mismo espacio de Proyectos. Alcanza para uso personal; varios destinos requerirían guardar tokens cifrados en la BD.

### 5. Contrato

- Las rutas son las de `/api/v1` de Proyectos, documentadas en su OpenAPI (`/api/v1/docs`). Aprendizaje copia en `packages/shared` los esquemas Zod que usa (cada repo es independiente) y los prueba contra un **receptor de prueba** que imita esas rutas.
- Si Proyectos cambia una ruta de forma incompatible, debe publicarla como `/api/v2` y mantener la `v1` mientras Aprendizaje la use (riesgo del acta: contratos que se rompen).

### 6. Horas de Render

Cada envío despierta a Proyectos y la deja encendida 15 min. Mientras estudias, las dos apps quedan despiertas; sin cambios, no se gasta nada. Ejemplo: 2 h de estudio diarias son ~2 h 15 min de cada app, ~70 h al mes por app, lejos de las 750 h. No hay sincronización programada ni consultas periódicas.

## Qué necesita cada app

| App | Elemento | Cuándo |
|---|---|---|
| Aprendizaje | **INT-02:** `sync_outbox`, `sync_links`, proceso de envío, botón Enviar / Dejar de sincronizar, estado en la ficha y pruebas contra el receptor de prueba | Sprint 4 |
| Proyectos | **TEC-08:** `ApiClient`, usuario de servicio y token Bearer | Primeros de su v2 |
| Proyectos | **HU-18, ajustada:** referencia externa única en proyectos, fases y tareas (crear sin duplicar) y "Viene de Gestor de Aprendizaje" | Primeros de su v2 |
| Aprendizaje | **INT-04:** conectar con Proyectos real, probar de punta a punta y activar en producción | Después de TEC-08 y HU-18 de Proyectos |

Con este diseño, Proyectos **no** necesita la bandeja de salida ni los webhooks (TEC-09, TEC-10), ni HU-19 o HU-20: siguen en su backlog para cuando una integración lo pida (por ejemplo, Lexika o la otra dirección).

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Base de datos compartida | Acopla las dos apps: un cambio de tabla rompe a la otra (ADR-0002 §7 de Proyectos). |
| Webhook entrante en Proyectos (TEC-10 + HU-19) | Más código en Proyectos para traducir avisos en cambios; sus rutas actuales ya validan, autorizan y auditan. Queda para cuando haga falta escuchar avisos. |
| Proyectos consulta a Aprendizaje cuando la abres | Datos al día solo al mirar, y Proyectos tendría que guardar una copia de algo que no es suyo. |
| Botón "Sincronizar" manual | Más simple y gasta menos horas, pero Proyectos queda atrasada si se olvida (decisión del PO). |
| Enviar solo el % de avance del elemento | Proyectos necesitaría un campo de avance externo que contradice su regla de cálculo. |
| Enviar cada evento en orden | Exige ordenar y no perder ninguno; enviar el estado actual es más simple y tolera repeticiones. |
| Monitor que mantenga despierta a Proyectos | Gastaría ~720 h al mes de las 750 compartidas (ADR-0003). |

## Consecuencias

- (+) Sin capturar dos veces: estudiar en Aprendizaje actualiza el proyecto, sus fechas y su avance.
- (+) Proyectos cambia poco (TEC-08 y HU-18), y con su propio sistema de permisos, trazabilidad y papelera.
- (+) Tolera que cualquiera de las dos esté dormida, caída o desplegándose.
- (−) Un cambio hecho a mano en Proyectos sobre algo sincronizado se pierde en el siguiente envío. Proyectos debe mostrar de dónde viene (HU-18) y, en su v2, avisar al editarlo.
- (−) La sincronización real empieza cuando Proyectos tenga TEC-08 y HU-18; hasta entonces INT-02 se prueba contra un receptor de prueba.
- (−) Un envío fallido más de 24 h requiere que el PO lo reintente desde la ficha.
