# Revisión de juegos, inicio y resultados

Fecha: 6 de septiembre de 2026. Versión 1.0.9, basada en 1.0.8.

## Corrección de voz 1.0.9

El fallo se reprodujo pulsando «Probar voz natural» en Tauri: sherpa/eSpeak
rechazaba la ruta canónica Windows con prefijo `\\?\` al buscar `phontab`.
La prueba antigua usaba una ruta ordinaria y no detectaba el problema.
Ahora se normalizan las rutas antes de pasarlas al motor, incluida la variante
UNC; la prueba de síntesis real usa `canonicalize()` como el resolutor de Tauri.
Se precarga el modelo en su trabajador sin reproducir una bienvenida, se vuelven
a validar los archivos en cada solicitud y se descartan solicitudes de tutorial
que ya no corresponden al paso actual antes de enviarlas a Rust.

En la aplicación real se verificó la transición «Preparando» → «Hablando:
Daniela High» tras la corrección. La salida física depende del volumen, del
dispositivo de audio y del mezclador de Windows; no se fuerza el volumen del SO.

También se corrigió la entrega portátil: antes contenía solamente el EXE,
sin modelo ni diccionarios. Ahora conserva `resources/tts` y las licencias,
con comprobación SHA-256 de cada archivo copiado. La síntesis real deja de ser
omitida por el creador de instaladores y por GitHub Actions.

Durante el empaquetado del 7 de septiembre apareció otro fallo: Windows
PowerShell no encontró `Get-FileHash` al comprobar la copia portátil. Se sustituyó
por cálculo SHA-256 mediante .NET, compartido con la huella de validación.
La regresión ejecuta la función real sin carga automática de módulos y verifica
rutas literales con espacios, corchetes y Unicode, archivos vacíos y ausentes,
y liberación del archivo después de calcular la huella.

## Cambios aplicados

- Canicas: recorrido reconstruido en terrazas descendentes y curvas amplias, sin cruces aleatorios forzados. Seguimiento por distancias en metros, horizonte estable y detección de tableros, barandillas y piezas que bloquean la cámara. Corrección de rotaciones de piezas, colores de las bolas e iluminación del metal mediante reflejos precalculados.
- Hielo, río, tornado y temblor afectan avance, velocidad y desplazamiento lateral; algunos producen elevación. Se mantiene el resultado comprometido. Turbo conserva su descontrol y el rescate devuelve la canica a la salida.
- Patos: bandada de hasta cinco objetivos, más opciones de uno y dos. Patos que vuelan o asoman cerca de sus refugios, alas con silueta de plumas, pico aplanado, vegetación y pasto más variados. Ocultamiento completo y disparos contra la geometría visible; árboles, hojas, terreno y pasto bloquean el tiro.
- Pinball desactivado en la selección y en las demos. Una sesión antigua pendiente muestra mantenimiento y conserva su cancelación auditada, sin volver a habilitar el juego.
- Inicio reducido a tres indicadores: participantes, juego y modo. Verde indica completado y amarillo el siguiente pendiente. Tutorial y demos trasladados a los controles de ayuda.
- Archivo permanente de rondas y premios, agrupado por sesión, con búsqueda y exportación JSON. Se conserva al cambiar de juego o limpiar participantes. Se migran las rondas antiguas que todavía existan; no es posible recuperar las borradas anteriormente.
- Cinta de ganadores con nombre, juego, modo, premio y fecha. Pausa por botón, ratón o foco; respeta movimiento reducido.
- Modo juego: nombre Zona de Juegos, logo conservado y apariencia azul/lavanda. No es una función de privacidad y no elimina ni oculta registros.
- Aplicación instalada fijada a Daniela High. Una falla de síntesis o reproducción muestra un aviso, sin cambiar silenciosamente a una voz del sistema. El navegador de desarrollo identifica que usa su propia voz.

## Dimensiones de las canicas

Una unidad del escenario representa un metro. El área de referencia es el rectángulo del generador, no la longitud total del recorrido.

| Dificultad | Terrazas | Área de referencia | Desnivel | Ancho del canal | Eventos |
| --- | ---: | --- | ---: | ---: | ---: |
| Fácil | 3 | 43,4 × 32,55 m | 4,2 m | 2,06 m | 2 |
| Media | 4 | 58,8 × 44,1 m | 8,4 m | 2,30 m | 4 |
| Difícil | 5 | 77 × 57,75 m | 14,4 m | 2,55 m | 6 |

El mínimo requerido es 0,30 m libres entre terrazas independientes, descontando 0,64 m de espesor de tablero. Las rampas unen los niveles continuamente y no se consideran una separación entre dos pisos.

En 120 semillas por dificultad, la menor separación medida entre centros de terrazas, descontando el tablero, fue de 0,910 m, 1,567 m y 2,288 m respectivamente. Las pruebas también exigen más de 3 m laterales libres entre filas para la cámara. No se trata de un mapa apilado con pisos exactamente a 30 cm.

## Verificación

- `npm test`: aprobado. Tipos, persistencia, actualizador simulado, configuración de entrega, capacidad, semillas, Patos, compromisos, recuperación, audio, integración de pantallas, accesibilidad y tutoriales.
- Capacidad lógica: listas de 2 a 200 participantes; 398 pistas y 360 semillas adicionales. Contratos de movimiento: 315.000 muestras, además de pruebas de recuperación y llegada.
- Regresiones nuevas: colisión de cámara debajo de un tablero; rotaciones ortonormales; disparo bloqueado por un tronco, permitido cuando asoma el objetivo y rechazado al ocultarse; continuidad de refugios; efectos naturales en velocidad y avance; archivo tras vaciar participantes; fallo de almacenamiento visible; Daniela sin respaldo de otra voz.
- `npm run build`: aprobado. Compilación TypeScript y paquete de producción de Vite.
- Revisión visual en navegador a 1280 × 720: inicio y tres indicadores, apariencia alternativa, Pinball desactivado, una ronda de Cartas con participantes ficticios, cinta y archivo de su premio, búsqueda, bosque con bandadas, persecución y vista desde la canica.
- `cargo test --locked -- --include-ignored`: cinco pruebas nativas aprobadas, incluida la regresión de rutas canónicas de Tauri. `generates_real_spanish_sample` cargó el modelo real y generó un WAV de 22.050 Hz. La reproducción en otro PC no forma parte de esta comprobación.

## Límites de esta entrega

Canicas y Patos siguen en BETA. La velocidad de renderizado depende del equipo; las pruebas lógicas no garantizan los mismos FPS en todos los PC. El archivo usa almacenamiento local del WebView: si se agota, aparece una advertencia y debe exportarse antes de cerrar.

La corrección de voz y estas mejoras se preparan como versión 1.0.9. La entrega
se genera con el creador local firmado; los artefactos no se guardan en Git.
El rediseño adicional de formas de la pista solicitado después queda separado
de esta corrección prioritaria de voz.
