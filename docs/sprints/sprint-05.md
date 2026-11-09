# Sprint 5 — ficha de Lectura y usuarios en la web

- **Fechas:** 2026-11-09 → 2026-11-22
- **Objetivo:** que la ficha de un libro tenga sus datos, cada elemento tenga prioridad, y que miembros, invitaciones, perfil y cuentas se administren desde la web.
- **Capacidad:** 21 puntos (decisión del PO).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-10 | Prioridad Alta, Media o Baja en cada elemento, con filtro; llega a la prioridad del proyecto en Gestor de Proyectos | 2 | Terminado |
| HU-11 | Autor y Género (catálogos nuevos), Número de páginas y Horas reales (todos los tipos) | 5 | En revisión |
| HU-12 | Cada tipo elige qué campos muestra; Lectura queda como la pidió el PO, también en los espacios que ya existen | 3 | Pendiente |
| HU-13 | Miembros e invitaciones desde la web | 5 | Pendiente |
| HU-14 | Mi perfil: nombre, correo y contraseña | 3 | Pendiente |
| HU-15 | Administrar usuarios: cuentas, cambiar correo, desactivar o reactivar | 3 | Pendiente |

## Notas

- **Orden:** primero la ficha (HU-10, HU-11 y HU-12), después los usuarios (HU-13, HU-14 y HU-15). HU-12 va después de HU-11 porque Lectura debe mostrar los campos nuevos.
- **Ficha de Lectura pedida por el PO:** nombre del libro, autor, editorial, número de páginas, fechas estimadas y reales, horas estimadas y reales, y género.
- **Usuarios:** se toman como referencia HU-25, HU-29 y HU-30 de Gestor de Proyectos, con sus mismas reglas de seguridad: pedir la contraseña actual, cerrar las demás sesiones y no desactivarse a sí mismo.
- **Por decidir al llegar:** si Curso y Otro también ocultan campos (HU-12), y si HU-15 incluye un enlace para restablecer la contraseña desde la web.
- **HU-10:** la prioridad está en la ficha, así que también la tiene un Curso dentro de un elemento (comparten ficha). Por omisión es Media, también para lo que ya existía. La lista la muestra y se filtra por ella (en la URL, como los demás filtros). Su nombre se puede cambiar por tipo, como los demás campos. Viaja a la prioridad del proyecto en Gestor de Proyectos.
- **HU-11:** Autor y Género son dos catálogos nuevos en Catálogos, y empiezan vacíos. Los cuatro campos nuevos están en la ficha de todos los tipos y en los Cursos dentro de un elemento, hasta que HU-12 permita ocultarlos por tipo. No viajan a Gestor de Proyectos, porque allá no tienen equivalente.
