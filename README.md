# Fortuna Real

Aplicación de escritorio para sorteos mediante ruleta, cartas,
canicas y Patos 3D, con selección sin repeticiones, ganador directo y
modo eliminación.

Pinball 3D está temporalmente desactivado para jugar mientras se mejora.

La Ruleta compromete uniformemente a una persona antes de animar (PAR/IMPAR es
solo presentación). Patos genera un orden recuperable con CSPRNG AES-CTR/256 y
publica su sello SHA-256 antes de iniciar. Las sesiones y compromisos pendientes
persisten; cancelarlos exige un motivo que queda en el registro local de auditoría.
Cartas, Pinball y Canicas guardan además una semilla CSPRNG por ronda para
reconstruir exactamente su asignación, distribución o pista después de reiniciar.

## Estructura del repositorio

La descarga de GitHub queda organizada así:

```text
Fortuna Real/
├── 1 Programa/       # código, recursos, pruebas y scripts de compilación
├── 2 Instaladores/   # instrucciones y enlace a la versión estable publicada
├── 3 Ejecutar/       # accesos para abrir, compilar o preparar desde GitHub
└── README.md          # esta guía
```

Las carpetas técnicas ocultas `.github`, `.vscode` y el archivo `.gitignore`
permanecen en la raíz porque GitHub y las herramientas de desarrollo los necesitan.
Para abrir el proyecto no hay que mover archivos: entra a `3 Ejecutar` y usa
`Iniciar Fortuna Real.cmd`.

Después de ejecutar el creador, la carpeta local `Entrega` contiene la versión
para compartir con la misma división: `1 Programa`, `2 Instaladores` y
`3 Ejecutar`. `Entrega` no se sube al historial de Git porque contiene binarios
grandes; los instaladores oficiales se publican en
[GitHub Releases](https://github.com/OscarD0823/Fortuna-Real/releases/latest).

El instalador normal es la opción recomendada. Configura Fortuna Real, crea los accesos de Windows e instala
WebView2 silenciosamente si el equipo no lo tiene, con el paquete sin conexión
incluido. Está preparado para Windows 10/11 x64. El usuario no necesita Internet
para instalar/jugar, Node.js, Rust, Visual Studio ni copiar el código del proyecto.
Internet solo se utiliza para buscar o descargar actualizaciones. El instalador
incluye **Daniela High**, una voz neuronal en español que funciona sin conexión.
Si falla, muestra un aviso y permite reintentar con **Probar voz**, sin sustituirla
por una voz de Windows. La versión de desarrollo abierta en un navegador sí usa
la voz del navegador y lo indica; Daniela requiere la aplicación de escritorio.

La versión 1.0.9 corrige la carga de Daniela en las rutas canónicas de Windows
y precarga el modelo sin hablar al iniciar. La entrega portátil incluye la
carpeta `resources`: debe permanecer junto al ejecutable. El instalador comprueba
una síntesis real antes de generar la entrega y verifica los archivos de la voz
portátil. Si se produce un error, el aviso muestra su causa y permite reintentar.

En cada apertura, la aplicación compara su versión con `latest.json` en GitHub
Releases. Si existe una versión superior, muestra **Actualizando Fortuna Real**,
descarga el instalador firmado, presenta el porcentaje, verifica la firma, instala
y vuelve a abrir el programa. No descarga ni ejecuta código fuente. Si GitHub o
Internet no están disponibles, Fortuna Real inicia normalmente y conserva todos
los datos locales.

El iniciador de respaldo de `3 Ejecutar/Iniciador GitHub` nunca contiene
credenciales ni exige iniciar sesión.
Descarga el repositorio público `OscarD0823/Fortuna-Real`, permite elegir la
carpeta de destino e instala las dependencias declaradas. La descarga queda
organizada igualmente en `1 Programa`, `2 Instaladores` y `3 Ejecutar`.

## Inicio guiado y demos

La primera entrada muestra una guía breve sobre los controles reales. La barra
numerada tiene tres indicadores: participantes, juego y modo. Los pasos completos
se marcan en verde y el siguiente pendiente en amarillo. El
botón **Guía** vuelve a abrir la ayuda en cualquier juego.

Los juegos disponibles incluyen demostraciones de cuatro pasos desde **Ver demo paso
a paso**. La de Ruleta permite practicar la carga de nombres; la de Cartas permite
revelar un reverso de ejemplo. Ninguna práctica modifica participantes, premios,
historial ni resultados reales. Canicas y Patos conservan su etiqueta BETA
y tienen guías específicas de controles, cámaras, poderes y recuperación.

Puedes avanzar con las flechas, salir con Escape y escuchar cada paso si la
locución está activada y el volumen es mayor que cero. Al cerrar la guía inicial,
el campo de nombres queda listo para escribir. La ayuda se recuerda por juego y
se muestra automáticamente solo la primera vez.

## Resultados y apariencia

**Ver resultados** conserva las rondas, eliminaciones, último eliminado, ganador y
premio de cada partida. Se puede buscar por nombre, juego o premio y exportar una
copia JSON. Cambiar de juego o vaciar participantes no borra este archivo. Las
rondas antiguas que ya habían sido borradas no pueden recuperarse. Si el equipo
no permite guardar, aparece un aviso para exportar antes de cerrar.

La cinta del inicio recorre los ganadores con nombre, juego, modo, premio y fecha.
Se pausa con su botón, al colocar el cursor encima o al enfocarla con el teclado.
**Modo juego** cambia la paleta y el nombre a **Zona de Juegos**, conservando el
logo. Es solo una apariencia alternativa: no oculta ni borra registros.

## Canicas y bosque de Patos (BETA)

Las canicas recorren terrazas descendentes con curvas amplias, sin cruces forzados.
Los niveles independientes superan 30 cm libres; las rampas conectan niveles de
forma continua. Fácil tiene tres terrazas y 4,2 m de desnivel, Media cuatro y
8,4 m, y Difícil cinco y 14,4 m. Aumentan también longitud, obstáculos y eventos.
Hielo, río, tornado y temblor alteran avance, velocidad y desplazamiento de las
pelotas. Se conserva el resultado sellado; los eventos no habilitan manipularlo.
Persecución calcula distancias en metros y evita tableros, barandillas y piezas;
Desde la canica, Lateral y Aérea ofrecen otros encuadres.

Patos permite bandadas de hasta cinco objetivos, además de prácticas de uno o dos.
Algunos vuelan; otros asoman entre árboles y pasto y vuelven a ocultarse. Un pato
completamente oculto no se puede disparar; las hojas y los troncos bloquean los
tiros. Cada acierto provoca la salida colectiva antes de la siguiente tanda.

## Crear el instalador

Abre `3 Ejecutar/Crear instalador Fortuna Real.cmd` con doble clic. La primera vez, Windows
pedirá permiso de administrador para instalar automáticamente cualquier
herramienta de desarrollo que falte y solicitará la contraseña de firma. Cuando
la contraseña sea correcta se guarda cifrada con DPAPI, ligada a tu usuario de
Windows. Los siguientes instaladores se crean con un solo doble clic y al terminar
se abre `Entrega/2 Instaladores` con el archivo nuevo seleccionado.

El creador conserva una huella local de las dependencias y de la última validación.
Solo repite `npm ci` cuando cambian los paquetes de `package-lock.json` (no cuando
solo se incrementa la versión del producto), y solo repite toda la batería
de pruebas cuando cambia el código. La compilación firmada siempre se realiza.
Al terminar se verifica criptográficamente el instalador distribuido contra la
clave pública incorporada en la aplicación, además de comprobar `latest.json`.
La firma del actualizador no es un certificado Authenticode: Windows puede mostrar
un aviso de editor desconocido. El instructivo se copia junto al instalador.

Cuando el instalador detecta una versión anterior muestra dos decisiones explícitas:

- `Actualizar directamente y conservar mis datos (recomendado)` reemplaza los
  archivos del programa en la misma ubicación y mantiene participantes, historial,
  premios y configuración.
- `Desinstalar la versión anterior e instalar la nueva` retira primero los archivos
  de la aplicación. El desinstalador pregunta por separado si también se quieren
  eliminar los datos personales; esa casilla queda sin marcar de forma predeterminada.

Si se vuelve a abrir exactamente la misma versión, la primera alternativa cambia a
`Actualizar o reparar esta instalación`; en ese caso no existe una versión superior
que instalar.

Para que las instalaciones existentes detecten una actualización hay que aumentar
la versión en los archivos del proyecto y ejecutar `npm run publicar-actualizacion`.
Un commit común de GitHub no reemplaza una instalación: la actualización aparece
cuando existe un Release nuevo con `latest.json`, instalador y firma válidos.

## Modo de desarrollo

En Windows puedes abrir `3 Ejecutar/Iniciar Fortuna Real.cmd` con doble clic. Este iniciador
es solamente para trabajar en el código: no debe entregarse a los usuarios. El script
comprueba Node.js, Rust y las herramientas de C++ de Visual Studio. Si falta algo,
pide permiso de administrador y lo instala automáticamente. Después comprueba que
los puertos 1420 y 1421 estén disponibles y ejecuta la aplicación. Por seguridad,
el iniciador nunca finaliza procesos: si un puerto está ocupado muestra el PID y la
ruta para que el desarrollador decida qué cerrar manualmente.

También puedes iniciarla desde PowerShell:

```powershell
cd "1 Programa"
npm install
npm run fortuna
```

El iniciador prepara automáticamente las herramientas de C++ de Visual Studio
(MSVC y Windows SDK). La primera apertura puede tardar varios minutos mientras
Rust compila Tauri; las siguientes aperturas son mucho más rápidas.

```powershell
cd "1 Programa"
npm run tauri dev
```

## Compilación

```powershell
cd "1 Programa"
npm run build
npm test
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
`OscarD0823/Fortuna-Real`. La clave privada de firma y la contraseña protegida
se conservan únicamente en el perfil local de Windows, fuera del proyecto.

La contraseña local se recupera cifrada con DPAPI y solo desde la cuenta de
Windows que la creó. Si todavía no está protegida, el script la solicita, la
valida antes de compilar y permite tres intentos. Tras el primer acierto la
protege automáticamente con DPAPI y nunca conserva texto plano. La clave, el
archivo local protegido y la contraseña original no se comparten ni se suben a
GitHub. Debe conservarse una copia de seguridad segura; sin ella no se pueden
entregar actualizaciones a quienes ya tengan el programa instalado.

La publicación recomendada mantiene la clave exclusivamente en este computador:

1. Aumenta la versión en `1 Programa/package.json`, `1 Programa/package-lock.json`,
   `1 Programa/src-tauri/Cargo.toml`, `1 Programa/src-tauri/Cargo.lock` y
   `1 Programa/src-tauri/tauri.conf.json`.
2. Confirma que GitHub CLI tiene sesión mediante `gh auth status`.
3. Entra a `1 Programa` y ejecuta `npm run publicar-actualizacion`.
4. Escribe la contraseña únicamente si es el primer uso o cambió la clave.
5. El script valida el proyecto, genera el instalador, `.sig` y `latest.json`,
   crea la etiqueta/Release y comprueba el manifiesto remoto.

El script detiene la publicación si fallan los tipos, las pruebas de dominio y
persistencia, la compilación, `cargo test`, Clippy o la coherencia de versiones.
Después de publicar también comprueba que el endpoint `latest.json` informe la
versión recién creada. La sesión local de `gh` publica los archivos; la clave de
firma nunca sale del computador.

Hasta publicar el Release correspondiente (por ejemplo `v1.0.6`), la versión local
no se ofrecerá como actualización automática. Si no hay ningún Release publicado,
el endpoint devolverá 404 sin bloquear el programa. El instalador local funciona
igualmente sin conexión; publicar y verificar el Release es un paso separado.

`3 Ejecutar/Crear instalador Fortuna Real.cmd` o `npm run crear-instalador`
producen dentro de `Entrega/2 Instaladores` el instalador, su archivo `.sig`,
el ZIP y `latest.json` sin publicarlos.

## Validación en GitHub

Cada cambio enviado a `main` ejecuta automáticamente las pruebas de TypeScript,
dominio, persistencia, distribución, Rust, formato y Clippy. Este flujo no firma
ni publica instaladores y no necesita secretos. La firma y la publicación se
hacen solamente desde el computador autorizado para que la clave privada nunca
salga de él.
