# Fortuna Real

Aplicación de escritorio para sorteos con una ruleta animada, selección sin
repeticiones, modo de ganador directo y modo eliminación.

## Para los usuarios

Los usuarios reciben solamente este archivo:

```text
Fortuna-Real-0.2.0-Instalador.exe
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
pide permiso de administrador y lo instala automáticamente. Después cierra cualquier
proceso que esté escuchando en los puertos 1420 o 1421 y ejecuta la aplicación.

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
npm run tauri build
```

La configuración y los participantes se guardan localmente en el equipo.

## Actualizaciones automáticas

La versión 0.2.0 es la primera que incluye el actualizador. Los usuarios de una
versión anterior deben instalar 0.2.0 una sola vez. A partir de ahí, Fortuna Real
comprueba al iniciar si existe una versión más reciente, muestra sus notas,
descarga el paquete firmado, lo instala y reinicia la aplicación.

Las actualizaciones se publican en GitHub Releases del repositorio
`OscarD0823/Fortuna-Real`. La clave privada de firma está fuera del proyecto:

```text
C:\Users\odcon\.tauri\fortuna-real.key
C:\Users\odcon\.tauri\fortuna-real.key.password
```

Esa clave no se comparte ni se sube a GitHub. Debe conservarse una copia de
seguridad segura; sin ella no se pueden entregar actualizaciones a quienes ya
tengan el programa instalado.

Para publicar desde GitHub Actions, crea una vez el secreto del repositorio
`TAURI_SIGNING_PRIVATE_KEY` con el contenido de esa clave privada y el secreto
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` con el contenido del archivo `.password`.
Después:

1. Aumenta la versión en `package.json`, `src-tauri/Cargo.toml` y
   `src-tauri/tauri.conf.json`.
2. Crea y sube una etiqueta con el mismo número, por ejemplo `v0.3.0`.
3. El flujo `Publicar Fortuna Real` genera el instalador firmado y `latest.json`.

Como alternativa local, `Crear instalador Fortuna Real.cmd` produce dentro de
`instaladores` el instalador, su archivo `.sig` y `latest.json`, listos para
subir a una versión de GitHub con la etiqueta indicada.
