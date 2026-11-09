# Sprint 4 — enviar a Gestor de Proyectos

- **Fechas:** 2026-11-08 → 2026-11-08 (cerrado; se planeó hasta el 2026-11-21)
- **Objetivo:** que un elemento se pueda enviar a Gestor de Proyectos y sus cambios salgan solos (lado de Aprendizaje, ADR-0004), y que lo quitado se pueda recuperar.
- **Capacidad:** 11 puntos (decisión del PO).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-07 | Papelera: borrado lógico restaurable; físico solo desde la papelera (Admin) | 3 | Terminado |
| INT-02 | Enviar un elemento a Gestor de Proyectos y que sus cambios lleguen solos (bandeja de salida, vínculos y envío, probado contra un receptor de prueba) | 8 | Terminado |

## Notas

- **Orden:** primero HU-07. El ADR-0004 dice que quitar un nodo lo manda a la papelera de Proyectos y que restaurarlo lo vuelve a crear; conviene que la papelera exista antes de construir el envío.
- **INT-02** no se conecta todavía con Gestor de Proyectos real: necesita TEC-08 y HU-18 de su v2. Eso es INT-04. Al cierre de este sprint se cumple la primera parte del objetivo 4 del acta.
- **HU-07:** quitar un elemento (solo el Admin, `element.delete`) lo manda a la papelera sin tocar su estructura: deja de verse y vuelve completa. Un capítulo o curso vuelve con lo que se fue con él (misma fecha de baja); lo quitado antes se queda en la papelera y aparece solo cuando su padre vuelve. Cada quien ve y restaura lo que pudo quitar: el Admin todo, el Miembro los nodos, el Lector nada. Borrar para siempre es solo del Admin y se lleva todo lo que contiene. No vacía la papelera sola por antigüedad.
- **INT-02:** la ficha tiene la tarjeta **Gestor de Proyectos** (solo si la instalación tiene las tres variables `PROYECTOS_*`): Enviar, Dejar de sincronizar y, si falló 24 h, Reintentar. Lo ve quien ve el elemento; lo cambia quien lo edita. Probado contra un receptor de prueba que imita las rutas de Proyectos; en producción sigue apagado hasta INT-04. Detalles de lo que se envía en el ADR-0004 §7.
- **Observación (no es de INT-02):** cada vez que la ventana vuelve a tener el foco, la web relee todas las consultas de la página (React Query, `staleTime` 0). Con el límite de 100 peticiones por minuto, cambiar de ventana muchas veces seguidas puede dar "Demasiadas peticiones". Pasó al probar en el panel del navegador; con uso normal no debería. Si aparece en uso real, se ajusta `staleTime`.

## Cierre (2026-11-08)

- **Entregado:** 2 de 2 elementos, 11 puntos (PR 22 y 23). Objetivo cumplido: lo quitado se recupera desde la papelera, y un elemento se envía a Gestor de Proyectos con sus cambios automáticos, probado contra un receptor de prueba. Con esto se cumple la parte de Aprendizaje del objetivo 4 del acta; la conexión real es INT-04.
- **Pruebas:** 341 en total (88 de `shared` y 253 de la API), con una cobertura de la API del 95 %. Sigue en verde el recorrido de Playwright.
- **En producción** la integración sigue apagada: faltan las variables `PROYECTOS_*`, que llegan con INT-04.

### Lo que aprendimos

- **Leer el contrato real antes de construir** cambió cuatro cosas del diseño (ADR-0004 §7). Proyectos no recibe fechas reales, pide motivo al pausar o cancelar, limita los nombres a 120 caracteres y su PUT reemplaza el registro completo. Ninguna se veía solo en el ADR.
- **Enviar el estado, no los eventos,** simplificó todo. Repetir un envío no duplica nada, y una huella de lo último enviado evita llamar a Proyectos cuando nada cambió.
- **Sin llave foránea a propósito:** `sync_links` y `sync_outbox` sobreviven al borrado definitivo para que el envío también lo quite en Proyectos. Una llave en cascada lo habría dejado huérfano allá.
- **Primero la papelera:** INT-02 ya pudo probar quitar, restaurar y borrar para siempre con datos reales de HU-07.
- **El panel del navegador cambia el foco** y la web relee todas las consultas en cada cambio. Probando, se llegó al límite de 100 peticiones por minuto. Con uso normal no debería pasar (ver la observación de arriba).

### Pendiente

- **INT-04:** espera TEC-08 y HU-18 en la v2 de Gestor de Proyectos.
- **Próximo sprint:** el PO elige entre lo que queda en el backlog (HU-06 exportar e importar, HU-08 tablero y gráficas) y las decisiones abiertas: prioridad en el elemento, etiquetas de Lectura, pantallas de miembros e invitaciones, mi perfil y administración de usuarios.
