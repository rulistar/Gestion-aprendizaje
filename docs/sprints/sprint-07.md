# Sprint 7 — editoriales, lecturas terminadas y minutos

- **Fechas:** 2026-11-14 → 2026-11-27
- **Objetivo:** que una lectura se capture y se cierre como se piensa (editoriales aparte de las plataformas, casilla de terminada) y que la duración se maneje en minutos y se sume desde la estructura.
- **Capacidad:** 14 puntos (propuesta según lo pedido por el PO el 2026-11-13).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-19 | Opciones de la estructura (subcapítulo, curso, actividad) en el renglón del capítulo | 1 | En revisión (rama `feat/hu-19-estructura-renglon`) |
| HU-17 | Casilla "Terminada" en las lecturas | 2 | En revisión (rama feat/hu-17-lectura-terminada) |
| HU-16 | Marca Editorial / Plataforma en cada valor del catálogo | 3 | En revisión (rama feat/hu-16-editorial-plataforma) |
| HU-18 | Duración en minutos y suma hacia el elemento | 8 | Pendiente |

## Notas

- **Orden:** de lo más chico a lo más grande, un PR por elemento: HU-19, HU-17, HU-16 y al final HU-18, que toca la base de datos, la integración con Gestor de Proyectos y el respaldo.
- **HU-16:** nueva columna en `catalog_items` (la marca) para el catálogo de Plataformas. Los valores que ya existen quedan como Plataforma; en un espacio con lecturas ya capturadas, el Admin marca cuáles son editoriales. Lectura muestra solo editoriales; Curso y Otro, solo plataformas (un valor ya usado se conserva aunque no se ofrezca, como con los archivados). Al importar un respaldo no cambia el formato: un valor nuevo de Plataformas se crea como editorial si lo pide un elemento de tipo Lectura, y como plataforma en los demás casos. El filtro de la ficha es de presentación (como los campos ocultos); la API sigue aceptando cualquier valor activo de Plataformas.
- **HU-17:** sin migración. La casilla marca Terminado (con la fecha real automática de HU-03) y desmarcarla reabre el elemento, igual que cambiar el estado a mano. La casilla aparece en los tipos llamados "Lectura" (se reconoce por el nombre, sin importar mayúsculas ni acentos) y queda ligada al campo Estado.
- **HU-18, a decidir al llegar:**
  - Cómo se suma: si el elemento tiene minutos capturados, mandan; si no, la suma de las actividades (y los cursos que contiene). Qué pasa con las actividades canceladas.
  - Qué se envía a Gestor de Proyectos: hoy va en horas ([ADR-0004](../adr/ADR-0004-integracion-gestor-proyectos.md)); habrá que convertir (÷ 60) y decidir si el ADR se actualiza.
  - El formato del respaldo cambia (horas a minutos): subir la versión del respaldo y seguir leyendo los archivos anteriores.
  - La migración convierte lo ya guardado (× 60) y renombra las columnas.
- **HU-19 (PO, 2026-11-14):** los botones para agregar (Subcapítulo, Curso, Actividad) ya salían juntos, pero debajo de lo que contiene cada nodo. Ahora salen en el mismo renglón que el nombre del capítulo o curso al que se agregan; el formulario de la clase elegida se abre justo debajo. En la raíz del elemento, que no tiene renglón propio, quedan donde estaban. Solo cambia la web.
- **Fuera de este sprint:** el respaldo del prototipo "Gestor de cursos" (falta un archivo real) e INT-04 (espera TEC-08 y HU-18 de la v2 de Gestor de Proyectos; no es esta HU-18).
