# Sprint 5 — ficha de Lectura y usuarios en la web

- **Fechas:** 2026-11-09 → 2026-11-22
- **Objetivo:** que la ficha de un libro tenga sus datos, cada elemento tenga prioridad, y que miembros, invitaciones, perfil y cuentas se administren desde la web.
- **Capacidad:** 21 puntos (decisión del PO).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-10 | Prioridad Alta, Media o Baja en cada elemento, con filtro; llega a la prioridad del proyecto en Gestor de Proyectos | 2 | Terminado |
| HU-11 | Autor y Género (catálogos nuevos), Número de páginas y Horas reales (todos los tipos) | 5 | Terminado |
| HU-12 | Cada tipo elige qué campos muestra; Lectura queda como la pidió el PO, también en los espacios que ya existen | 3 | Terminado |
| HU-13 | Miembros e invitaciones desde la web | 5 | Terminado |
| HU-14 | Mi perfil: nombre, correo y contraseña | 3 | En revisión |
| HU-15 | Administrar usuarios: cuentas, cambiar correo, desactivar o reactivar | 3 | Pendiente |

## Notas

- **Orden:** primero la ficha (HU-10, HU-11 y HU-12), después los usuarios (HU-13, HU-14 y HU-15). HU-12 va después de HU-11 porque Lectura debe mostrar los campos nuevos.
- **Ficha de Lectura pedida por el PO:** nombre del libro, autor, editorial, número de páginas, fechas estimadas y reales, horas estimadas y reales, y género.
- **Usuarios:** se toman como referencia HU-25, HU-29 y HU-30 de Gestor de Proyectos, con sus mismas reglas de seguridad: pedir la contraseña actual, cerrar las demás sesiones y no desactivarse a sí mismo.
- **Por decidir al llegar:** si HU-15 incluye un enlace para restablecer la contraseña desde la web.
- **HU-10:** la prioridad está en la ficha, así que también la tiene un Curso dentro de un elemento (comparten ficha). Por omisión es Media, también para lo que ya existía. La lista la muestra y se filtra por ella (en la URL, como los demás filtros). Su nombre se puede cambiar por tipo, como los demás campos. Viaja a la prioridad del proyecto en Gestor de Proyectos.
- **HU-11:** Autor y Género son dos catálogos nuevos en Catálogos, y empiezan vacíos. Los cuatro campos nuevos están en la ficha de todos los tipos y en los Cursos dentro de un elemento, hasta que HU-12 permita ocultarlos por tipo. No viajan a Gestor de Proyectos, porque allá no tienen equivalente.
- **HU-12:** cada tipo tiene un botón "Campos" en Tipos de elemento para marcar los que muestra su ficha. Decisiones del PO (2026-11-12): Lectura oculta Patrocinador, Categoría, Nivel, Semanas, Días por semana y Horas por día, y su nombre se llama "Nombre del libro"; Curso y Otro ocultan Género y Número de páginas; Notas se ve en todos. Ocultar no borra datos: la ficha manda el valor guardado aunque no se vea. Una sección sin campos visibles no se muestra.
- **HU-13:** nueva sección "Miembros" en el menú. Todo miembro ve quién está y con qué rol; el Admin además ve los correos, cambia roles, quita miembros (o sale del espacio), invita y cancela invitaciones pendientes. El enlace de invitación se muestra una sola vez (en la BD solo queda su hash) y la app no lo envía: el Admin lo copia y lo manda. La página pública /invitacion#token cubre los tres casos, como en Gestor de Proyectos: crear la cuenta, iniciar sesión y aceptar, o avisar si la sesión abierta es de otra cuenta. La API ya existía (TEC-02); esta historia es solo web. Al probarla se corrigió que "iniciar sesión y aceptar" aceptaba pero no llevaba al espacio (también pasa en Gestor de Proyectos).
- **HU-14:** "Mi perfil" en el menú del usuario (arriba a la derecha), igual que HU-29 de Gestor de Proyectos: nombre, correo y contraseña. Correo y contraseña piden la contraseña actual, tienen el mismo límite de intentos que el login y cierran las demás sesiones de la persona. Como esta app no tiene avisos emergentes, cada tarjeta confirma lo guardado junto a su botón.
