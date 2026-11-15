# Sprint 7 — editoriales, lecturas terminadas y minutos

- **Fechas:** 2026-11-14 → 2026-11-27
- **Objetivo:** que una lectura se capture y se cierre como se piensa (editoriales aparte de las plataformas, casilla de terminada) y que la duración se maneje en minutos y se sume desde la estructura.
- **Capacidad:** 14 puntos (propuesta según lo pedido por el PO el 2026-11-13).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-19 | Opciones de la estructura (subcapítulo, curso, actividad) en el renglón del capítulo | 1 | Hecha (PR #39) |
| HU-17 | Casilla "Terminada" en las lecturas | 2 | Hecha (PR #40) |
| HU-16 | Marca Editorial / Plataforma en cada valor del catálogo | 3 | Hecha (PR #41) |
| HU-18 | Duración en minutos y suma hacia el elemento | 8 | En revisión (rama `feat/hu-18-minutos`) |

## Notas

- **Orden:** de lo más chico a lo más grande, un PR por elemento: HU-19, HU-17, HU-16 y al final HU-18, que toca la base de datos, la integración con Gestor de Proyectos y el respaldo.
- **HU-16:** nueva columna en `catalog_items` (la marca) para el catálogo de Plataformas. Los valores que ya existen quedan como Plataforma; en un espacio con lecturas ya capturadas, el Admin marca cuáles son editoriales. Lectura muestra solo editoriales; Curso y Otro, solo plataformas (un valor ya usado se conserva aunque no se ofrezca, como con los archivados). Al importar un respaldo no cambia el formato: un valor nuevo de Plataformas se crea como editorial si lo pide un elemento de tipo Lectura, y como plataforma en los demás casos. El filtro de la ficha es de presentación (como los campos ocultos); la API sigue aceptando cualquier valor activo de Plataformas.
- **HU-17:** sin migración. La casilla marca Terminado (con la fecha real automática de HU-03) y desmarcarla reabre el elemento, igual que cambiar el estado a mano. La casilla aparece en los tipos llamados "Lectura" (se reconoce por el nombre, sin importar mayúsculas ni acentos) y queda ligada al campo Estado.
- **HU-18 (PO, 2026-11-15):** todo pasa a minutos: minutos por día, minutos totales y minutos reales, en el elemento y en los cursos. Decisiones:
  - **Suma:** en cada nivel manda lo capturado a mano; si no hay, se suman los minutos de lo que contiene (capítulos, cursos y actividades); si tampoco hay, se calcula con la duración (semanas × días por semana × minutos por día). Las actividades canceladas no cuentan. Cada nivel conserva sus propios minutos aunque el de arriba tenga captura.
  - **Migración:** lo ya guardado se multiplica × 60 (2.5 h pasan a 150 min). Las columnas y los campos **conservan su nombre** (`hoursPerDay`, `manualTotalHours`, `actualHours`, `totalHours`) porque esos nombres están guardados en los tipos (campos ocultos y etiquetas) y en los respaldos; cambian las unidades, las etiquetas visibles y los comentarios. Renombrarlos es un cambio aparte, si se quiere.
  - **Respaldo:** la versión pasa de 1 a 2. Los JSON de la versión 1 y los CSV con columnas "Horas…" se siguen leyendo y se convierten a minutos al importar. El CSV exporta "Minutos por día / capturados / totales / reales"; "Minutos totales" es informativa.
  - **Gestor de Proyectos:** hoy la sincronización no envía horas ([ADR-0004](../adr/ADR-0004-integracion-gestor-proyectos.md): "horas por día" no se envía), así que no cambia nada. Cuando INT-04 decida qué duración mandar, habrá que convertir (÷ 60) si Proyectos la espera en horas.
- **HU-19 (PO, 2026-11-14):** los botones para agregar (Subcapítulo, Curso, Actividad) ya salían juntos, pero debajo de lo que contiene cada nodo. Ahora salen en el mismo renglón que el nombre del capítulo o curso al que se agregan; el formulario de la clase elegida se abre justo debajo. En la raíz del elemento, que no tiene renglón propio, quedan donde estaban. Solo cambia la web.
- **Fuera de este sprint:** el respaldo del prototipo "Gestor de cursos" (falta un archivo real) e INT-04 (espera TEC-08 y HU-18 de la v2 de Gestor de Proyectos; no es esta HU-18).
