# Validación de Fortuna Real 1.0.4

Fecha: 2026-08-29  
Plataforma comprobada: Windows x64

## Resultado

- `npm test`: aprobado (12 suites).
- `npm run build`: aprobado.
- TypeScript: aprobado sin errores.
- Rust: formato, pruebas y Clippy aprobados por el creador del instalador.
- Capacidad: Ruleta, Cartas, Pinball, Canicas y Patos comprobados con 2–200 participantes.
- Justicia: compromisos, recuperación de rondas y selección de resultados sin cambios.
- Canicas: cuatro cámaras (`Persecución`, `A bordo`, `Lateral`, `Aérea`).
- Pinball: seguimiento de pelota en `Persecución` y `Cenital`; salida simultánea conservada.
- Patos: pupilas, patas animadas y retroceso visual al disparar; refugios y poderes conservados.
- Instalador: NSIS x64 con WebView2 sin conexión y acceso directo exterior.
- Firma y `latest.json`: verificados con la clave pública incluida en la aplicación.
- Ejecutable portátil: inició correctamente desde `Entrega/1 Programa`.

## Distribución

`Entrega` contiene únicamente:

1. `1 Programa`: ejecutable portátil y guía.
2. `2 Instaladores`: instalador normal, ZIP, firma, manifiesto e iniciador de GitHub.
3. `3 Ejecutar`: accesos para abrir la versión portátil o el instalador.

El iniciador de GitHub prepara esa misma estructura dentro de la ubicación que
elija el usuario y no requiere credenciales para descargar el repositorio público.

## Integridad

SHA-256 del instalador:

`CCFE9D0CC0C78665EA8F39DDB79EB7F705E3376EE83A9CBFB81A2F9A3B4865C1`

SHA-256 del ZIP del instalador:

`5162BAE41229642C0CE3D0C88A7063D35A088E0C1B87A15C291746ABC18CC974`

SHA-256 del ZIP del iniciador:

`7C3D364C064C0055D8E81AED1E992F49BB873D613270646B2A089C699D347455`

## Alcance

La compilación, firma, lectura completa de los ZIP y arranque portátil se
probaron en este computador. La inspección visual automatizada mediante el
navegador integrado no estuvo disponible en esta sesión; los contratos de UI,
accesibilidad, cámaras y tutoriales sí fueron validados por las pruebas locales.
