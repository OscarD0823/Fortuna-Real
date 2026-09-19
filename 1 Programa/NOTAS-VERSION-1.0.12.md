# Fortuna Real 1.0.12

## 1.0.11 → 1.0.12 — Autor visible e historial con clasificación completa

Fecha: 2026-09-19. Versión actual del código.

Se conservan la voz Daniela High, los juegos y sus reglas. Los cambios de historial no alteran los resultados comprometidos. Canicas y Patos siguen en beta; Pinball continúa desactivado.

### Creado por OscarD0823

- Tarjeta permanente inspirada en Caja Fantasma: nombre del autor y enlace al repositorio de Fortuna Real, sin un nuevo mensaje emergente al iniciar.
- El enlace abre el navegador predeterminado. El permiso nativo de apertura se limita a la dirección exacta del proyecto.

### Clasificaciones guardadas

- Cada nueva partida terminada guarda una fotografía de todos sus participantes, puestos, resultados y premio; permanece aunque después se borre la lista de nombres.
- En eliminación, la tabla empieza por el ganador y sigue por el orden inverso de salida, incluido el último eliminado. En Patos guarda a todos los integrantes de la bandada.
- Canicas en ganador directo conserva la clasificación completa en el instante que decide la carrera: posiciones, tiempos de quienes llegaron y avance de quienes siguen en pista. Respeta las reglas Primero y Último.
- Ruleta y Cartas en ganador directo distinguen al ganador de todos los no seleccionados: no asignan segundos o terceros puestos que el sorteo no disputó.
- Tabla desplazable con encabezados fijos, búsqueda por cualquier participante y exportación JSON v2 con las clasificaciones. Los registros antiguos sin tabla completa se identifican explícitamente.
- El acceso a Ver resultados permanece visible también en ventanas estrechas; antes una regla de diseño lo ocultaba por debajo de 1050 píxeles.
- Las reglas laterales de Patos muestran una vida en las partidas rápidas y tres solo al recuperar una partida antigua; describen la salida de toda la bandada.

### Sin partidas abortadas en los resultados

- El historial público se confirma únicamente al obtener un ganador. Las rondas parciales de una partida activa no aparecen como partidas terminadas.
- Las partidas canceladas no aparecen en el historial, en el salón de ganadores, en la cinta de inicio ni en la exportación de resultados.
- La auditoría interna se conserva. Los registros parciales anteriores se apartan del historial visible sin destruir su copia local de recuperación.
- Pruebas de persistencia y recuperación con los cinco motores, grupos de 2, 8 y 200 participantes, cancelaciones y las dos reglas de llegada de Canicas.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.11...v1.0.12).
