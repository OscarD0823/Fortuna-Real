# Fortuna Real

Aplicación de escritorio para sorteos mediante ruleta, cartas, Pinball 3D,
canicas y Patos 3D, con selección sin repeticiones, ganador directo y
modo eliminación.

La Ruleta compromete uniformemente a una persona antes de animar (PAR/IMPAR es
solo presentación). Patos genera un orden recuperable con CSPRNG AES-CTR/256 y
publica su sello SHA-256 antes de iniciar. Las sesiones y compromisos pendientes
persisten; cancelarlos exige un motivo que queda en el registro local de auditoría.
Cartas, Pinball y Canicas guardan además una semilla CSPRNG por ronda para
reconstruir exactamente su asignación, distribución o pista después de reiniciar.

## Para los usuarios

Los usuarios reciben solamente este archivo:

```text
Fortuna-Real-1.0.0-Instalador.exe
```

El instalador configura Fortuna Real, crea los accesos de Windows e instala
WebView2 silenciosamente si el equipo no lo tiene. El usuario no necesita
Node.js, Rust, Visual Studio ni conocimientos de programación.

## Crear el instalador

Abre `Crear instalador Fortuna Real.cmd` con doble clic. La primera vez, Windows
pedirá permiso de administrador para instalar automáticamente cualquier
herramienta de desarrollo que falte. Después generará el archivo distribuible
dentro de la carpeta `instaladores`.

## Modo de desarrollo

En Windows puedes abrir `Iniciar Fortuna Real.cmd` con doble clic. Este iniciador
es solamente para trabajar en el código: no debe entregarse a los usuarios. El script
comprueba Node.js, Rust y las herramientas de C++ de Visual Studio. Si falta algo,
pide permiso de administrador y lo instala automáticamente. Después comprueba que
los puertos 1420 y 1421 estén disponibles y ejecuta la aplicación. Por seguridad,
el iniciador nunca finaliza procesos: si un puerto está ocupado muestra el PID y la
ruta para que el desarrollador decida qué cerrar manualmente.

También puedes iniciarla desde PowerShell:

```powershell
npm install
npm run fortuna
```

El iniciador prepara automáticamente las herramientas de C++ de Visual Studio
(MSVC y Windows SDK). La primera apertura puede tardar varios minutos mientras
Rust compila Tauri; las siguientes aperturas son mucho más rápidas.

```powershell
npm run tauri dev
```

## Compilación

```powershell
npm run build
npm run test:fairness
npm run tauri build
```

La configuración, los participantes, el historial de ganadores y el estado de una
sesión activa se guardan localmente en el equipo. El formato persistido está
versionado y valida los datos al recuperar; una lista admite como máximo 200
participantes. Vaciar la lista no borra el historial de ganadores.

## Actualizaciones automáticas

La versión 1.0.0 incluye el actualizador. Los usuarios de una versión sin
actualizador deben instalar 1.0.0 una sola vez. A partir de ahí, Fortuna Real
comprueba al iniciar si existe una versión más reciente, muestra sus notas,
descarga el paquete firmado, lo instala y reinicia la aplicación.

Las actualizaciones se publican en GitHub Releases del repositorio
`OscarD0823/Fortuna-Real`. La clave privada de firma está fuera del proyecto:

```text
C:\Users\odcon\.tauri\fortuna-real.key
C:\Users\odcon\.tauri\fortuna-real.key.password.dpapi
```

La contraseña local se guarda cifrada con DPAPI y solo la cuenta de Windows que
la creó puede recuperarla. La clave, el archivo `.password.dpapi` y la
contraseña original no se comparten ni se suben a GitHub. Debe conservarse una
copia de seguridad segura; sin ella no se pueden entregar actualizaciones a
quienes ya tengan el programa instalado.

Para publicar desde GitHub Actions, crea una vez el secreto del repositorio
`TAURI_SIGNING_PRIVATE_KEY` con el contenido de esa clave privada y el secreto
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` con la contraseña original (no con el
archivo DPAPI, que no es portable fuera de esa cuenta de Windows).
Después:

1. Aumenta la versión en `package.json`, `src-tauri/Cargo.toml` y
   `src-tauri/tauri.conf.json`.
2. Crea y sube una etiqueta con el mismo número, por ejemplo `v0.3.0`.
3. El flujo `Publicar Fortuna Real` genera el instalador firmado y `latest.json`.

El flujo detiene la publicación si fallan los tipos, las pruebas de dominio y
persistencia, la compilación, `cargo test`, Clippy o la coherencia de versiones.
Después de publicar también comprueba que el endpoint `latest.json`, el instalador
y su archivo `.sig` respondan correctamente. `GITHUB_TOKEN` lo proporciona GitHub;
las dos variables `TAURI_SIGNING_*` son secretos obligatorios y no deben guardarse
en archivos versionados.

Hasta que exista y se publique el tag correspondiente (por ejemplo `v1.0.0`), el
endpoint `/releases/latest/download/latest.json` devolverá 404. No se debe distribuir
un instalador con actualización automática antes de que esa comprobación final pase.

Como alternativa local, `Crear instalador Fortuna Real.cmd` produce dentro de
`instaladores` el instalador, su archivo `.sig` y `latest.json`, listos para
subir a una versión de GitHub con la etiqueta indicada.
