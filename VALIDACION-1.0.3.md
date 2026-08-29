# Validación de Fortuna Real 1.0.3

Fecha: 2026-08-28  
Plataforma comprobada: Windows x64

## Resultado

- `npm test`: aprobado (12 suites).
- `npm run build`: aprobado.
- TypeScript: aprobado sin errores.
- Rust: `fmt`, `test` y `clippy` aprobados por el creador del instalador.
- Patos: 59.700 impactos simulados para 2–200 participantes.
- Tandas de Patos: uno o dos objetivos, tres disparos y duración mínima de 6 s.
- Compromiso de Patos: SHA-256 con orden recuperable AES-CTR/256, sin cambios.
- Instalador: NSIS x64 con WebView2 sin conexión.
- Firma y `latest.json`: verificados con la clave pública incluida en la aplicación.
- ZIP: cuatro entradas esperadas y lectura completa aprobada.
- Ejecutable portátil: proceso nativo iniciado correctamente desde `Entrega/Programa`.
- Iniciador GitHub: sintaxis, dirección fija, modo `-CheckOnly` y controles de copia local aprobados.

## Entrega

`Entrega` contiene solamente `Programa`, `Instaladores` e `Iniciador`. La carpeta
antigua `instaladores` fue eliminada después de verificar los artefactos 1.0.3.

SHA-256 del instalador:

`51CBA4887EB25E430A856EEA04FAADF7B94A215C7864C454E17FAA0EFCA6946B`

SHA-256 del ZIP:

`E61379DD82D5F3F415B2ADEC6CFD22C797614ABBC1982D0FB7E2EFD34F109F60`

## Alcance honesto

La compilación, la firma y el arranque se probaron en este computador. No había
un segundo PC o una máquina virtual limpia disponible para repetir la instalación.
La auditoría de Codex Security solicitada anteriormente continúa pendiente porque
su comprobación previa no pudo identificar el modo de agentes V1/V2; esta versión
no se presenta como una auditoría de seguridad completada.
