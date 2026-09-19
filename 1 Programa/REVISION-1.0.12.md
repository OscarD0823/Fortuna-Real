# Verificación de Fortuna Real 1.0.12

19 de septiembre de 2026.

## Alcance

- Autor revisado en la tarea «Crear rastreador de cajas fantasma» y en su componente
  local `author-card`: «Creado por OscarD0823» y acceso al repositorio.
  Fortuna Real utiliza su propia dirección, no la de Caja Fantasma.
- Apertura nativa mediante [Opener de Tauri](https://v2.tauri.app/plugin/opener/),
  con permiso para una única URL HTTPS. No abre rutas, ejecutables ni URL arbitrarias.
- Tabla histórica inmutable: posiciones, nombres y resultado de todos los participantes
  al confirmar un ganador. En Canicas directo es la fotografía del instante decisivo,
  no una predicción de llegadas que todavía no ocurrieron.
- Eliminación se ordena por supervivencia; los sorteos directos sin clasificación
  deportiva muestran «No seleccionado» y ningún puesto inventado.
- Publicación atómica al finalizar. Partidas en curso o canceladas fuera de cinta,
  salón de ganadores, historial y exportación de resultados.
- Estado persistido v6: conserva registros parciales anteriores bajo
  `unpublishedResults` para recuperación interna. No se destruye la auditoría.
- Registros antiguos sin tabla completa conservan sus rondas disponibles y advierten
  expresamente qué información no se había guardado.
- La prueba de interfaz detectó que una regla adaptable ocultaba «Ver resultados»
  en ventanas de hasta 1050 px. El acceso ya conserva su presentación visible.

## Pruebas de regresión

- 15 partidas completas: cinco motores por tres tamaños (2, 8 y 200).
- Cancelación antes del primer resultado y después de rondas parciales; no publica
  ganadores, conserva auditoría y rechaza callbacks de sesiones ya canceladas.
- Recarga del estado y eliminación de participantes posteriores a una partida:
  la clasificación histórica no cambia.
- Canicas directo: 200 participantes en Primero y Último, sin invertir el resultado.
- Sorteos directos sin podio artificial; snapshots incompletos o corruptos rechazados.
- Migración de sesiones canceladas, filtros compartidos para ambas vistas de ganadores,
  exportación v2 y permiso de autor limitado al repositorio.
- Interfaz local aislada: partida de Cartas con tres participantes ficticios, tabla
  con los tres puestos y rondas, persistencia al reabrir y búsqueda por un eliminado.
  Acceso a «Ver resultados» visible a 900 px, enlace del autor correcto y sin errores
  de consola durante esta comprobación. No se modificaron partidas del usuario.

No se ha instalado ni actualizado en un segundo PC. Las verificaciones del instalador
y del manifiesto son comprobaciones de distribución, no sustituyen esa prueba física.
