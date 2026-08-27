# Validación de Fortuna Real 1.0.2

Fechas: 26–27 de agosto de 2026. Plataforma de compilación y prueba: Windows x64.

## Pruebas de uso realizadas

Se utilizaron nombres ficticios en una sesión de navegador de prueba, separada
de los datos de la aplicación instalada. Se revisaron pantallas de 1280 × 720
y la adaptación de las demos a 800 × 600.

| Área | Comprobación | Resultado |
| --- | --- | --- |
| Inicio | Guía automática, ocho pasos, enfoque y navegación por teclado | Correcto |
| Participantes | Agregar con Enter, pegar con comas/saltos de línea, omitir duplicados | Correcto |
| Demos | Cinco juegos, cuatro pasos cada uno, práctica de nombres y cartas aislada del sorteo | Correcto |
| Guías de juegos | Ruleta 3, Cartas 3, Pinball 4, Canicas 5, Patos 4 pasos | Correcto |
| Ruleta | Giro completo, bloqueo de doble inicio, resultado y exclusión del ganador | Correcto |
| Cartas | Barajado, selección, recuperación tras recargar con el mismo sello | Correcto |
| Pinball | Partidas completas automática y manual; lanzamiento simultáneo y flippers | Correcto |
| Canicas | Dos carreras completas; seguimiento por participante y tres estilos de cámara | Correcto |
| Patos | Impacto con teclado/botón, vidas, identidad revelada, poderes y resolución sellada | Correcto |
| Refugios | Captura del bosque sin patos ni letreros flotantes durante el ocultamiento | Correcto |
| Resultados | Historial, premios y comprobantes en los cinco juegos | Correcto |
| Consola | Sin errores ni advertencias JavaScript en las comprobaciones finales de juegos | Correcto |

Correcciones encontradas durante estas pruebas:

- Enter agrega nombres tanto en el formulario real como en la práctica.
- El fondo no se desplaza mientras se usa la guía o la demo.
- Las demos compactas conservan nombres de pestañas y espacio para los controles.
- Los letreros de pista no tapan las cámaras de seguimiento de canicas.
- Una ronda nueva no se identifica incorrectamente como recuperada al comprometerla.
- Los letreros de los patos se ocultan con sus modelos.
- «Siguiente impacto» también está disponible en el modo 3D.
- Los avisos del actualizador esperan a estar en el inicio, sin tutorial ni demo.

## Pruebas automatizadas

`npm run lint` y `npm test` completados correctamente. La batería incluye:

- Persistencia, recuperación de estado corrupto, migraciones y auditoría de cancelaciones.
- Capacidades de 2 a 200 participantes en los cinco juegos.
- 360 semillas de pista y 315.000 muestras de movimiento de canicas.
- 59.700 impactos de patos y sus contratos de refugio/poderes.
- Compromisos de sorteo, distribución de ruleta y recuperación determinista de rondas.
- Audio: interruptores independientes, selección de voz, volumen y narración de guías.
- Accesibilidad, identificación BETA, 20 pasos de demo y 27 anclas de guía.
- Coherencia de versiones y configuración de distribución sin conexión.
- Caché de dependencias: una versión nueva no reinstala paquetes; una dependencia nueva sí.

Los tiempos/FPS observados corresponden a este equipo. No garantizan el mismo
rendimiento en cualquier GPU. Las pruebas de voz verifican comportamiento del
código; no certifican una voz idéntica ni una calidad acústica uniforme en otro PC.

## Instalador y seguridad

El paquete está configurado para Windows 10/11 x64, por usuario, con frontend local
y WebView2 sin conexión incluido. No requiere Node.js, Rust ni Visual Studio en
el equipo del usuario. La conexión solo se utiliza para las actualizaciones.

El creador recupera las dependencias antes de probar la firma y verifica el
instalador final con la clave pública incorporada en la aplicación. La clave
privada y la contraseña protegida con DPAPI permanecen fuera del repositorio.
La firma de actualización no es un certificado Authenticode; Windows puede
mostrar un aviso de editor desconocido.

La publicación en GitHub Releases es independiente de crear el instalador o
hacer un commit. Esta entrega no publica automáticamente el Release.

Comprobaciones finales realizadas:

- `cargo fmt --check`, `cargo test --locked`, Clippy con `-D warnings`, compilación
  TypeScript/Vite y empaquetado NSIS completados. El backend Rust todavía no tiene
  tests unitarios propios; las reglas de los juegos se prueban en TypeScript.
- Firma criptográfica y correspondencia de versión/URL/firma de `latest.json`
  verificadas sobre el archivo final. Un archivo alterado fue rechazado con
  `InvalidSignature` por el mismo verificador.
- NSIS incorpora el instalador completo x64 de WebView2, no un descargador.
- El ejecutable importa únicamente DLL de Windows/UCRT; no depende de las DLL
  de desarrollo de Visual Studio.
- Arranque nativo correcto desde una carpeta aislada que contiene solo el `.exe`,
  con el servidor de desarrollo cerrado y perfil WebView2 independiente.
- La interfaz, el primer tutorial y el alta de nombres con Enter funcionan en
  esa copia compilada. Los datos de la instalación del usuario no se modificaron.
- Renderizado WebGL de la pista y carrera nativa de canicas comprobados en la
  copia aislada del ejecutable, sin servidor de desarrollo.

Artefacto: `instaladores/Fortuna-Real-1.0.2-Instalador.exe`.
Tamaño: 219.132.990 bytes (aproximadamente 209 MiB).
SHA-256: `E2C191A91E73991E4FC4B9D1B5BB1B6FC5297513D0F25B5AB009B931EE53F38D`.

## Límite de la comprobación

No se dispone de un segundo PC físico ni una VM limpia para certificar una
instalación completa en otra máquina. Antes de distribuir masivamente, comprobar
en un Windows 10/11 x64 de destino:

1. Copiar solo el instalador y el instructivo; instalar con una cuenta normal.
2. Abrir sin servidor de desarrollo ni acceso a Internet.
3. Completar la guía, agregar dos nombres y terminar una partida de cada juego.
4. Cerrar/abrir y verificar que se conservan participantes y premios.
5. Confirmar que los tres juegos BETA se renderizan con el controlador gráfico
   del equipo; si no, revisar el modo alternativo y actualizar el controlador.
6. Si se necesita locución sin conexión, disponer de una voz española local.
