# Fortuna Real 1.0.11

## 1.0.10 → 1.0.11 — Actualización integrada, clima en carrera y Patos rápidos

Fecha: 2026-09-12. Versión actual del código.

Canicas y Patos siguen en beta; Pinball continúa desactivado. La voz Daniela High no cambia. Las reglas de selección siguen siendo iguales para todos.

### Actualización dentro del programa

- Cinco etapas visibles: comprobar versión, descargar, verificar firma, preparar y aplicar/reabrir. Descarga con bytes, velocidad media y tiempo restante aproximado.
- Configuración silenciosa de NSIS, sin asistente durante las próximas actualizaciones. Se avisa del breve cierre necesario para reemplazar el ejecutable; no se ocultan avisos de seguridad de Windows.
- La firma solo se confirma al terminar la verificación nativa. Al reabrir se comprueba la versión realmente ejecutada antes de anunciar éxito.
- Recuperación ante descarga incompleta o reinicio interrumpido, reintento explícito y posibilidad de continuar. Escape no oculta la actualización activa.
- Los clientes anteriores pueden mostrar todavía su ventana pasiva durante la transición a esta versión, pues usan su configuración ya compilada.

### Canicas: fenómenos naturales y cámara

- Hielo, río, tornado y temblor aparecen por tiempo de carrera, con orden, inicio y duración aleatorios derivados de la semilla; dejan de ser decoraciones permanentemente activas.
- Aviso previo y estado de clima activo. Los fenómenos alteran velocidad, deriva y elevación de las canicas en distintas posiciones, y desaparecen al terminar su intervalo.
- La animación usa tiempo absoluto y transiciones suaves, sin depender de los FPS. Se conservan los tiempos de llegada y resultados comprometidos del sorteo.
- La cámara compensa el desplazamiento de la canica antes del suavizado para evitar retraso en tramos rápidos. Acerca el encuadre para canicas pequeñas y corrige objetivos que quedan fuera de pantalla.
- Se mantienen la colisión con piezas, el paso bajo tableros y los modos de persecución, a bordo, lateral y aéreo.

### Patos Retro y modo rápido

- Escenario pixelado original con cielo, bosque y pasto; alas, caída y escape animados. Todos los supervivientes salen juntos, hasta 200 participantes.
- Patos rápidos: nuevas partidas con una sola vida por participante y velocidad inicial mayor. Un impacto oficial elimina al participante revelado; se conserva el límite de tres disparos por tanda.
- La regla de una vida se muestra en la interfaz y se incluye en el compromiso recuperable. Las partidas antiguas guardadas conservan sus tres vidas y su sello original.
- Los árboles y el pasto ocultan por completo a los patos y bloquean disparos. El marcador queda fuera del campo y los poderes visuales no cambian quién gana.
- Pruebas para 2–200 participantes, calendario de fenómenos, continuidad del movimiento, selección uniforme y compatibilidad con resultados anteriores.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.10...v1.0.11).
