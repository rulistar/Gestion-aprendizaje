# Sprint 2 — captura de elementos

- **Fechas:** 2026-11-06 →
- **Objetivo:** capturar un elemento de aprendizaje con su ficha y su estructura de hasta 3 niveles, y ver la lista con su avance.
- **Capacidad:** 21 puntos.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-02 | Tipos de elemento con el nombre de cada campo | 5 | Terminado |
| HU-03 | Capturar y editar la ficha de un elemento, con la duración calculada | 5 | Terminado |
| HU-04 | Estructura de un elemento en hasta 3 niveles | 8 | Terminado |
| HU-05 | Lista de elementos con su avance | 3 | En revisión |

## Notas

- **HU-02:** cada tipo guarda solo los nombres propios (columna `labels`, JSONB); un campo sin nombre propio usa el de omisión. Los cambia quien tiene `catalog.manage`, como los catálogos, y todo miembro los ve porque la ficha los necesita. Dos campos de un tipo no pueden llamarse igual y debe quedar al menos un tipo activo. Los espacios que ya existían reciben los tipos iniciales en la migración. El formulario para renombrar se extrajo a `rename-form.tsx`, y lo usan también los catálogos.
- **Propuesta para el PO, sin decidir:** Lectura trae "Editorial" en vez de "Plataforma". No trae "páginas" en vez de "semanas": la etiqueta solo cambia el nombre, y las horas totales seguirían multiplicando semanas. Medir por páginas sería otra regla de cálculo y necesitaría su propia historia.
- **ADR-0002:** aceptado por el PO el 2026-11-06.
- **HU-03:** las horas totales no se guardan: se calculan al leer, y lo único guardado es lo capturado a mano. Las fechas reales usan el día del usuario (`?today=`), porque el servidor está en UTC. Al reabrir un elemento terminado se quita su fin real, como en Gestor de Proyectos. Incluye una lista mínima para abrir cada ficha; el avance y los filtros llegan con HU-05. No incluye borrar (HU-07, papelera) ni prioridad (pendiente de definir).
- **HU-04:** el árbol vive en una sola tabla y se muestra dentro de la ficha. Un nodo Curso usa el mismo esquema y el mismo formulario que el elemento. Los nodos solo se reordenan entre hermanos: moverlos a otro padre no está en esta historia. El avance por nodo llega con HU-05 (ADR-0002 §4). Los nodos quitados aún no se pueden recuperar desde la web: la papelera es HU-07.
- **HU-05:** el avance no se guarda: la API lo calcula al leer con la regla de `progress.ts`, la misma de Gestor de Proyectos (ADR-0002 §4). La lista filtra por nombre, tipo y estado; los filtros viven en la URL, así que un enlace abre la misma vista. Filtran en el navegador, porque la API ya entrega la lista completa del espacio. Dentro de la ficha se ve el avance del elemento y el de cada capítulo o curso; lo que no tiene actividades no muestra barra.
