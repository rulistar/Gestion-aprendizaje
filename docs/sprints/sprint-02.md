# Sprint 2 — captura de elementos

- **Fechas:** 2026-11-06 →
- **Objetivo:** capturar un elemento de aprendizaje con su ficha y su estructura de hasta 3 niveles, y ver la lista con su avance.
- **Capacidad:** 21 puntos.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-02 | Tipos de elemento con el nombre de cada campo | 5 | En revisión |
| HU-03 | Capturar y editar la ficha de un elemento, con la duración calculada | 5 | Pendiente |
| HU-04 | Estructura de un elemento en hasta 3 niveles | 8 | Pendiente |
| HU-05 | Lista de elementos con su avance | 3 | Pendiente |

## Notas

- **HU-02:** cada tipo guarda solo los nombres propios (columna `labels`, JSONB); un campo sin nombre propio usa el de omisión. Los cambia quien tiene `catalog.manage`, como los catálogos, y todo miembro los ve porque la ficha los necesita. Dos campos de un tipo no pueden llamarse igual y debe quedar al menos un tipo activo. Los espacios que ya existían reciben los tipos iniciales en la migración. El formulario para renombrar se extrajo a `rename-form.tsx`, y lo usan también los catálogos.
- **Propuesta para el PO, sin decidir:** Lectura trae "Editorial" en vez de "Plataforma". No trae "páginas" en vez de "semanas": la etiqueta solo cambia el nombre, y las horas totales seguirían multiplicando semanas. Medir por páginas sería otra regla de cálculo y necesitaría su propia historia.
- **ADR-0002:** sigue como Propuesto hasta que el PO lo acepte.
