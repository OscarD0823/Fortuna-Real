# Verificación de Fortuna Real 1.0.10

Fecha: 7 de septiembre de 2026. Base publicada: 1.0.9.

## Canicas

Tres familias deterministas: cañón con curvas en S, espiral descendente y órbitas con lóbulos. Conservan una ruta continua hasta la meta; no son bifurcaciones físicas independientes. La semilla de geometría está separada de la secuencia que asigna tiempos y poderes.

| Dificultad | Área de referencia | Desnivel | Menor hueco lateral medido entre corredores independientes |
| --- | --- | ---: | ---: |
| Fácil | 56 × 42 m | 5,6 m | 3,915 m |
| Media | 75,6 × 56,7 m | 11,2 m | 4,080 m |
| Difícil | 98 × 73,5 m | 18,5 m | 4,297 m |

Las cifras de separación corresponden a las 120 semillas probadas por dificultad, descontando el ancho del tablero. No garantizan por sí solas todas las semillas posibles. Se compara cada segmento con los corredores no contiguos; las curvas conectadas no cuentan como dos pisos separados. El mínimo exigido de separación vertical sigue siendo 0,30 m libre de tablero. Las nuevas rutas evitan cruces de pisos.

La persecución ajusta distancia, altura y anticipación de giro. Se mantienen los controles de colisión antes y después del suavizado. La vista general ahora calcula su plano lejano con los límites del escenario: en la revisión visual se detectó que el límite fijo anterior de 90 m cortaba las zonas distantes del cañón difícil. La comparación antes/después confirmó la corrección.

Se corrigió además el retraso de cámara al reanudar un renderizado pausado: antes la carrera avanzaba el tiempo completo, pero la cámara solo aceptaba 50 ms. Tras una pausa de al menos 250 ms la cámara alcanza directamente la pose actual; durante el movimiento normal mantiene suavizado independiente de la frecuencia de cuadros.

La carrera completa en Espiral fácil (`visual-1`, ocho participantes) detectó otra regresión preexistente: varias canicas con progreso 100 % quedaban ordenadas por número, aunque el resultado confirmado correspondiera a otra. La clasificación usa ahora el tiempo de llegada y se limita al instante del resultado, incluso con cuadros tardíos. La regresión verifica Primero y Último con 2, 8, 90 y 200 participantes.

## Compatibilidad y pruebas automáticas

- `npm test`: tipos, persistencia, actualización simulada, entrega, capacidad, semillas, Patos, compromisos, recuperación, audio, pantallas, accesibilidad y tutoriales.
- Listas de 2 a 200 participantes: 398 mapas generados en la prueba de capacidad, además de 360 semillas y 315.000 muestras de movimiento.
- 240 carreras capturadas del commit inmutable de 1.0.9 (`196e3b59d65ca4fe86e14ab39e5998ca4c16632a`): mismos ganadores, números, tiempos de llegada, poderes y objetivos. El archivo de referencia no se genera con el motor nuevo.
- Pruebas de cámara: alcance suficiente para los extremos del escenario, respuesta equivalente a 30/60/144 Hz, recuperación tras pausa y colisión bajo tablero.
- `npm run build`: compilación de producción comprobada.

## Historial de versiones

El registro JSON incluido en el programa genera las notas de versión y el bloque del README. La comprobación de entrega falla si falta la versión actual o si los documentos divergen. El manifiesto de actualización y el Release usan estas mismas notas; las notas remotas se muestran como texto, sin ejecutar HTML.

Revisión de interfaz en laboratorio aislado: apertura del diálogo, foco inicial en búsqueda, búsqueda de 1.0.8, consulta sin coincidencias y cierre con Escape restaurando el foco a Novedades. La consulta no modifica participantes, resultados ni premios.

Las notas de versiones anteriores se reconstruyeron a partir de commits y Releases. Para 1.0.1 no existe un registro independiente conservado y se indica esa limitación expresamente, sin inventar cambios o fecha.

## Límites

Canicas y Patos siguen en beta; Pinball sigue desactivado. La selección del sorteo sigue comprometida antes de la animación, no es una competición de física libre. Daniela High no cambia de modelo ni de ajustes. La prueba del navegador utiliza su voz de desarrollo y no valida el motor nativo.

Se inspeccionaron las vistas generales de Trébol, Cañón difícil y Espiral fácil, además de persecución y vista desde la canica. Las capturas de un navegador oculto no son una medición fiable de FPS; no se promete una frecuencia universal ni se ha probado este instalador en otro computador.
