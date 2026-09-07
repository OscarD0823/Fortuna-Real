# Fortuna Real 1.0.9

## Voz Daniela High

- Corregida la incompatibilidad de las rutas canónicas de Windows con sherpa/eSpeak: el modelo ya carga desde la ruta real que resuelve Tauri.
- Precarga silenciosa en segundo plano, sin mensaje hablado al iniciar.
- La voz de escritorio permanece en Daniela: nunca se sustituye silenciosamente por otra voz.
- Estado visible de preparación/reproducción y errores con su causa concreta.
- Una sola síntesis activa; los pasos de tutorial descartados no saturan la cola.
- La edición portátil lleva el modelo, diccionarios y licencias en `resources/tts`, con comprobación SHA-256 de cada archivo.
- El creador de instaladores y GitHub Actions ejecutan la síntesis real con una ruta canónica, además de las pruebas automáticas.
- La verificación SHA-256 de la entrega funciona en Windows PowerShell sin depender de la carga automática de módulos.

## Mejoras acumuladas de juegos e inicio

- Inicio con tres indicadores de progreso y acceso a resultados.
- Archivo de partidas, eliminaciones y premios; búsqueda, exportación y cinta de ganadores.
- Apariencia «Modo juego», sin borrar ni ocultar los resultados.
- Canicas con terrazas más separadas, cámara de seguimiento con colisión, iluminación corregida y efectos naturales sobre el movimiento.
- Patos con bandadas, bosque y vegetación renovados; los obstáculos bloquean los disparos y los patos ocultos no son objetivos visibles.
- Pinball desactivado temporalmente por mantenimiento.

## Instalación

Ejecuta el instalador o `INSTALAR O ACTUALIZAR.cmd`. Para una instalación
existente, elige actualizar y conservar los datos. No es necesario instalar
Node.js ni Rust para usar la aplicación instalada.

En la edición portátil no se debe separar el ejecutable de `resources`.
Daniela es offline; necesita la locución activada, volumen mayor que cero y
una salida de audio funcional en Windows. Canicas y Patos continúan en beta.
