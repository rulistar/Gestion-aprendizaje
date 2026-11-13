# Sprint 5 — ficha de Lectura y usuarios en la web

- **Fechas:** 2026-11-09 → 2026-11-12 (cerrado; se planeó hasta el 2026-11-22)
- **Objetivo:** que la ficha de un libro tenga sus datos, cada elemento tenga prioridad, y que miembros, invitaciones, perfil y cuentas se administren desde la web.
- **Capacidad:** 21 puntos (decisión del PO); 23 al sumar a HU-15 el enlace para restablecer la contraseña (PO, 2026-11-12).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-10 | Prioridad Alta, Media o Baja en cada elemento, con filtro; llega a la prioridad del proyecto en Gestor de Proyectos | 2 | Terminado |
| HU-11 | Autor y Género (catálogos nuevos), Número de páginas y Horas reales (todos los tipos) | 5 | Terminado |
| HU-12 | Cada tipo elige qué campos muestra; Lectura queda como la pidió el PO, también en los espacios que ya existen | 3 | Terminado |
| HU-13 | Miembros e invitaciones desde la web | 5 | Terminado |
| HU-14 | Mi perfil: nombre, correo y contraseña | 3 | Terminado |
| HU-15 | Administrar usuarios: cuentas, cambiar correo, desactivar o reactivar, y enlace para restablecer la contraseña | 5 | Terminado |

## Notas

- **Orden:** primero la ficha (HU-10, HU-11 y HU-12), después los usuarios (HU-13, HU-14 y HU-15). HU-12 va después de HU-11 porque Lectura debe mostrar los campos nuevos.
- **Ficha de Lectura pedida por el PO:** nombre del libro, autor, editorial, número de páginas, fechas estimadas y reales, horas estimadas y reales, y género.
- **Usuarios:** se toman como referencia HU-25, HU-29 y HU-30 de Gestor de Proyectos, con sus mismas reglas de seguridad: pedir la contraseña actual, cerrar las demás sesiones y no desactivarse a sí mismo.
- **Decidido al llegar (PO, 2026-11-12):** HU-15 incluye el enlace para restablecer la contraseña desde la web (+2 puntos), como HU-54 de Gestor de Proyectos.
- **HU-10:** la prioridad está en la ficha, así que también la tiene un Curso dentro de un elemento (comparten ficha). Por omisión es Media, también para lo que ya existía. La lista la muestra y se filtra por ella (en la URL, como los demás filtros). Su nombre se puede cambiar por tipo, como los demás campos. Viaja a la prioridad del proyecto en Gestor de Proyectos.
- **HU-11:** Autor y Género son dos catálogos nuevos en Catálogos, y empiezan vacíos. Los cuatro campos nuevos están en la ficha de todos los tipos y en los Cursos dentro de un elemento, hasta que HU-12 permita ocultarlos por tipo. No viajan a Gestor de Proyectos, porque allá no tienen equivalente.
- **HU-12:** cada tipo tiene un botón "Campos" en Tipos de elemento para marcar los que muestra su ficha. Decisiones del PO (2026-11-12): Lectura oculta Patrocinador, Categoría, Nivel, Semanas, Días por semana y Horas por día, y su nombre se llama "Nombre del libro"; Curso y Otro ocultan Género y Número de páginas; Notas se ve en todos. Ocultar no borra datos: la ficha manda el valor guardado aunque no se vea. Una sección sin campos visibles no se muestra.
- **HU-13:** nueva sección "Miembros" en el menú. Todo miembro ve quién está y con qué rol; el Admin además ve los correos, cambia roles, quita miembros (o sale del espacio), invita y cancela invitaciones pendientes. El enlace de invitación se muestra una sola vez (en la BD solo queda su hash) y la app no lo envía: el Admin lo copia y lo manda. La página pública /invitacion#token cubre los tres casos, como en Gestor de Proyectos: crear la cuenta, iniciar sesión y aceptar, o avisar si la sesión abierta es de otra cuenta. La API ya existía (TEC-02); esta historia es solo web. Al probarla se corrigió que "iniciar sesión y aceptar" aceptaba pero no llevaba al espacio (también pasa en Gestor de Proyectos).
- **HU-14:** "Mi perfil" en el menú del usuario (arriba a la derecha), igual que HU-29 de Gestor de Proyectos: nombre, correo y contraseña. Correo y contraseña piden la contraseña actual, tienen el mismo límite de intentos que el login y cierran las demás sesiones de la persona. Como esta app no tiene avisos emergentes, cada tarjeta confirma lo guardado junto a su botón.
- **HU-15:** "Usuarios del sistema" en el menú del usuario, solo para el Admin del sistema (los demás ven un aviso; la API responde 403). Muestra todas las cuentas con sus espacios y su último acceso; corrige un correo (cierra sus sesiones), desactiva con confirmación (cierra sus sesiones y ya no entra; lo que capturó se conserva) o reactiva, y genera un enlace para restablecer la contraseña. El enlace se muestra una vez, sirve una vez y caduca en 48 horas; usarlo cierra las sesiones de la cuenta e inicia sesión. Uno nuevo invalida el anterior, igual que `pnpm reset:password`. El Admin no puede desactivarse a sí mismo ni generarse un enlace (para eso está Mi perfil). El login explica qué hacer si se olvida la contraseña. Es lo mismo que HU-30 y HU-54 de Gestor de Proyectos, con la tabla nueva `password_resets`.

## Cierre (2026-11-12)

- **Entregado:** 6 de 6 elementos, 23 puntos (PR 27 y 29 a 33). Objetivo cumplido: la ficha de un libro tiene sus datos y solo muestra lo que usa, cada elemento tiene prioridad, y miembros, invitaciones, perfil y cuentas se administran desde la web, sin la API a mano ni la terminal.
- **Alcance:** creció 2 puntos por decisión del PO, al sumar a HU-15 el enlace para restablecer la contraseña.
- **Pruebas:** 375 en total (97 de `shared` y 278 de la API), con una cobertura de la API del 95 %. Sigue en verde el recorrido de Playwright.
- **Migraciones nuevas:** prioridad (HU-10), autor, género, páginas y horas reales (HU-11), campos por tipo con los datos de Lectura, Curso y Otro (HU-12) y `password_resets` (HU-15). Se aplican solas al desplegar.

### Lo que aprendimos

- **Reutilizar lo de Gestor de Proyectos aceleró** HU-13, HU-14 y HU-15: mismas reglas, mismas pantallas y casi las mismas pruebas. **También copia sus fallos.** "Iniciar sesión y aceptar" aceptaba pero no llevaba al espacio, porque la página cambiaba de vista a medio camino. Se encontró al probar aquí y se corrigió en las dos apps (en Proyectos, con su propio PR).
- **Ocultar un campo es solo de presentación.** La ficha manda el valor guardado aunque no se vea; así guardar no borra lo que se capturó antes. Se probó en el navegador.
- **Decidir al llegar funcionó.** Las preguntas abiertas (qué ocultan Curso y Otro, el enlace para restablecer) se respondieron al empezar cada historia, con lo ya construido a la vista.
- **Probar contra el servidor correcto.** Detener la tarea que levanta los servidores no los cierra. Una vez se probó contra código viejo hasta que se cerraron por su número de proceso.

### Pendiente

- **INT-04:** espera TEC-08 y HU-18 en la v2 de Gestor de Proyectos.
- **Próximo sprint:** el PO elige entre lo que queda en el backlog: HU-06 (exportar e importar, incluidos los respaldos del prototipo) y HU-08 (tablero y gráficas). Falta definir la lista inicial de tipos de actividad.
