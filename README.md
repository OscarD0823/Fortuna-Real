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

## Entrega para los usuarios

Después de ejecutar `npm run crear-instalador`, `Entrega` contiene exactamente:

```text
Entrega/
├── Programa/       # ejecutable portátil y guía
├── Instaladores/   # instalador normal, ZIP, firma y latest.json
└── Iniciador/      # descarga pública del proyecto y ZIP autocontenido
```

El instalador normal es la opción recomendada. Configura Fortuna Real, crea los accesos de Windows e instala
WebView2 silenciosamente si el equipo no lo tiene, con el paquete sin conexión
incluido. Está preparado para Windows 10/11 x64. El usuario no necesita Internet
para instalar/jugar, Node.js, Rust, Visual Studio ni copiar el código del proyecto.
Internet solo se utiliza para buscar o descargar actualizaciones. La voz disponible
depende de las voces instaladas en Windows; los juegos también funcionan sin voz.

El iniciador de respaldo nunca contiene credenciales ni exige iniciar sesión.
Descarga el repositorio público `OscarD0823/Fortuna-Real`, permite elegir la
carpeta de destino e instala las dependencias declaradas. Para distribuirlo se
usa el ZIP del iniciador, que mantiene juntos el `.cmd`, el `.ps1` y su guía.

## Inicio guiado y demos

La primera entrada muestra una guía breve sobre los controles reales. La barra
numerada permite saltar directamente a participantes, juego, modo o inicio. El
botón **Guía** vuelve a abrir la ayuda en cualquier juego.

Los cinco juegos incluyen demostraciones de cuatro pasos desde **Ver demo paso
a paso**. La de Ruleta permite practicar la carga de nombres; la de Cartas permite
revelar un reverso de ejemplo. Ninguna práctica modifica participantes, premios,
historial ni resultados reales. Pinball, Canicas y Patos conservan su etiqueta BETA
y tienen guías específicas de controles, cámaras, poderes y recuperación.

Puedes avanzar con las flechas, salir con Escape y escuchar cada paso si la
locución está activada y el volumen es mayor que cero. Al cerrar la guía inicial,
el campo de nombres queda listo para escribir. La ayuda se recuerda por juego y
se muestra automáticamente solo la primera vez.

## Crear el instalador

Abre `Crear instalador Fortuna Real.cmd` con doble clic. La primera vez, Windows
pedirá permiso de administrador para instalar automáticamente cualquier
herramienta de desarrollo que falte y solicitará la contraseña de firma. Cuando
la contraseña sea correcta se guarda cifrada con DPAPI, ligada a tu usuario de
Windows. Los siguientes instaladores se crean con un solo doble clic y al terminar
se abre la carpeta `instaladores` con el archivo nuevo seleccionado.

El creador conserva una huella local de las dependencias y de la última validación.
Solo repite `npm ci` cuando cambian los paquetes de `package-lock.json` (no cuando
solo se incrementa la versión del producto), y solo repite toda la batería
de pruebas cuando cambia el código. La compilación firmada siempre se realiza.
Al terminar se verifica criptográficamente el instalador distribuido contra la
clave pública incorporada en la aplicación, además de comprobar `latest.json`.
La firma del actualizador no es un certificado Authenticode: Windows puede mostrar
un aviso de editor desconocido. El instructivo se copia junto al instalador.

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

Las versiones desde 1.0.1 incluyen el actualizador. Los usuarios de una versión sin
actualizador deben instalar la versión actual una sola vez. A partir de ahí, Fortuna Real
comprueba al iniciar si existe una versión más reciente, muestra sus notas,
descarga el paquete firmado, lo instala y reinicia la aplicación. Los avisos
esperan a que regreses al inicio y cierres cualquier guía o demo.

Las actualizaciones se publican en GitHub Releases del repositorio
`OscarD0823/Fortuna-Real`. La clave privada de firma está fuera del proyecto:

```text
C:\Users\odcon\.tauri\fortuna-real.key
C:\Users\odcon\.tauri\fortuna-real.key.password.dpapi
```

Si existe el archivo `.password.dpapi`, la contraseña local se recupera cifrada
con DPAPI y solo desde la cuenta de Windows que la creó. Si no existe, el script
la solicita, la valida antes de compilar y permite tres intentos. Tras el primer
acierto crea automáticamente el archivo DPAPI; nunca conserva texto plano. La clave,
ese archivo local y la contraseña original no se comparten ni se suben a GitHub. Debe conservarse
una copia de seguridad segura; sin ella no se pueden entregar actualizaciones a
quienes ya tengan el programa instalado.

La publicación recomendada mantiene la clave exclusivamente en este computador:

1. Aumenta la versión en `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
   `src-tauri/Cargo.lock` y `src-tauri/tauri.conf.json`.
2. Confirma que GitHub CLI tiene sesión mediante `gh auth status`.
3. Ejecuta `npm run publicar-actualizacion`.
4. Escribe la contraseña únicamente si es el primer uso o cambió la clave.
5. El script valida el proyecto, genera el instalador, `.sig` y `latest.json`,
   crea la etiqueta/Release y comprueba el manifiesto remoto.

El script detiene la publicación si fallan los tipos, las pruebas de dominio y
persistencia, la compilación, `cargo test`, Clippy o la coherencia de versiones.
Después de publicar también comprueba que el endpoint `latest.json` informe la
versión recién creada. La sesión local de `gh` publica los archivos; la clave de
firma nunca sale del computador.

Hasta publicar el Release correspondiente (por ejemplo `v1.0.3`), la versión local
no se ofrecerá como actualización automática. Si no hay ningún Release publicado,
el endpoint devolverá 404 sin bloquear el programa. El instalador local funciona
igualmente sin conexión; publicar y verificar el Release es un paso separado.

`Crear instalador Fortuna Real.cmd` o `npm run crear-instalador` producen dentro
de `instaladores` el instalador, su archivo `.sig` y `latest.json` sin publicarlos.
