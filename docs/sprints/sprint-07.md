# Sprint 7 — editoriales, lecturas terminadas y minutos

- **Fechas:** 2026-11-14 → 2026-11-27 (cerrado el 2026-11-15)
- **Objetivo:** que una lectura se capture y se cierre como se piensa (editoriales aparte de las plataformas, casilla de terminada) y que la duración se maneje en minutos y se sume desde la estructura.
- **Capacidad:** 14 puntos (propuesta según lo pedido por el PO el 2026-11-13).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-19 | Opciones de la estructura (subcapítulo, curso, actividad) en el renglón del capítulo | 1 | Hecha (PR #39) |
| HU-17 | Casilla "Terminada" en las lecturas | 2 | Hecha (PR #40) |
| HU-16 | Marca Editorial / Plataforma en cada valor del catálogo | 3 | Hecha (PR #41) |
| HU-18 | Duración en minutos y suma hacia el elemento | 8 | Hecha (PR #42) |

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

## Cierre (2026-11-15)

- **Entregado:** 4 de 4 elementos, 14 puntos (PR #39, #40, #41 y #42). Objetivo cumplido: una lectura se captura y se cierra como se piensa (editoriales aparte de las plataformas, casilla "Terminada"), la estructura se arma con menos clics y la duración se maneja en minutos y se suma desde la estructura.
- **Pruebas:** 294 en la API, todas en verde (4 más que en el Sprint 6), más las nuevas de `shared` (suma de minutos, conversión de respaldos, regla de editorial). Los cuatro chequeos de GitHub en verde en cada PR.
- **Migraciones:** dos, escritas a mano: `hu16_editorial_plataforma` (columna nueva) y `hu18_minutos` (ensancha columnas y multiplica × 60 lo ya guardado). Sin dependencias nuevas.

### Lo que aprendimos

- **Una migración de una rama sin fusionar rompe a la siguiente.** La base de pruebas ya traía la migración de HU-16 y la rama de HU-18 salió de `main` sin ella: Prisma pidió un reset ("drift"). Se resolvió fusionando HU-16 y poniendo HU-18 encima con `rebase`. Regla: la historia con migración se fusiona antes de empezar la siguiente que también migra.
- **Cambiar unidades no obliga a cambiar nombres.** Los campos `hoursPerDay`, `manualTotalHours`, `actualHours` y `totalHours` están guardados en los tipos de elemento y en los respaldos. Se conservaron y cambiaron las unidades, las etiquetas y los comentarios; renombrarlos queda como cambio aparte.
- **Los archivos viejos hay que seguir leyéndolos.** El respaldo pasó a la versión 2 (minutos) y los JSON de la versión 1 y los CSV con columnas "Horas…" se convierten al importar, con pruebas.
- **Las reglas por nombre de tipo son frágiles.** La casilla "Terminada" y el filtro de editoriales se reconocen porque el tipo se llama "Lectura". Si se renombra, dejan de verse. Una marca propia en el tipo lo evitaría.

### Pendiente

- **Respaldo del prototipo "Gestor de cursos":** con un archivo real se agrega como tercer formato de `readBackupText` (`shared`), sin tocar la API.
- **INT-04:** espera TEC-08 y HU-18 en la v2 de Gestor de Proyectos. Cuando decida qué duración manda, hay que convertir minutos a horas (÷ 60) si Proyectos la espera en horas.
- **Próximo sprint:** [Sprint 8](sprint-08.md), propuesto: estado de capítulos y libros, y "Leer de nuevo".
