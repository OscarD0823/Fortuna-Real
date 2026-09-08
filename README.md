# Fortuna Real

Aplicación de escritorio para sorteos mediante ruleta, cartas,
canicas y Patos 3D, con selección sin repeticiones, ganador directo y
modo eliminación.

Pinball 3D está temporalmente desactivado para jugar mientras se mejora.

El botón **Novedades** muestra la versión del programa y el historial de cada
actualización, con búsqueda y consulta sin conexión. El mismo registro está en
el [historial de cambios de este README](#historial-de-cambios).

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

Las canicas generan tres familias: **Cañón sinuoso**, **Espiral descendente** y
**Trébol de circuitos**. La semilla determina la forma y la orientación; los
recorridos siguen siendo continuos, con curvas amplias y sin cruces planos forzados.
Los niveles independientes superan 30 cm libres; las rampas conectan niveles de
forma continua. El cañón conserva tres, cuatro o cinco terrazas; las otras formas
descienden mediante órbitas. Fácil tiene 5,6 m de desnivel, Media 11,2 m y Difícil
18,5 m. Sus áreas de referencia son 56 × 42 m, 75,6 × 56,7 m y 98 × 73,5 m;
la longitud real aparece en el panel del mapa. Aumentan también obstáculos y eventos.
Hielo, río, tornado y temblor alteran avance, velocidad y desplazamiento de las
pelotas. Se conserva el resultado sellado; los eventos no habilitan manipularlo.
Persecución calcula distancias en metros, anticipa los giros, adapta distancia y
altura en curvas y evita tableros, barandillas y piezas. La sacudida de cámara
está limitada para mantener la lectura sin quitar los efectos sobre las pelotas;
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
   `1 Programa/src-tauri/tauri.conf.json`. Añade primero los cambios reales de esa
   versión a `1 Programa/src/shared/releases/versionHistory.json` y ejecuta
   `npm run historial:actualizar` desde `1 Programa`: sincroniza este README y
   `NOTAS-VERSION-<versión>.md`. La aplicación y el actualizador usan esas mismas notas.
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

<!-- VERSION-HISTORY:START -->
## Historial de cambios

Versión actual del código: **1.0.10**. También disponible desde **Novedades** dentro del programa, sin conexión.

Los cambios se resumen por función; los enlaces llevan al registro original. Las fechas de Releases usan el día de publicación en Colombia. Las versiones sin un Release conservado lo indican expresamente.

### 1.0.9 → 1.0.10 — Nuevos circuitos de canicas e historial de versiones

Fecha: 2026-09-07. Versión actual del código.

Canicas y Patos continúan en beta. Daniela High conserva el modelo y los ajustes aprobados en 1.0.9.

#### Canicas: pistas y espacio

- Tres familias de geometría: Cañón sinuoso, Espiral descendente y Trébol de circuitos; la semilla determina la forma y la orientación.
- Curvas en S visibles, horquillas amplias y órbitas con lóbulos; se conserva una ruta continua hasta la meta, sin cruces planos forzados.
- Área de referencia ampliada a 56 × 42 m en Fácil, 75,6 × 56,7 m en Media y 98 × 73,5 m en Difícil. Desniveles de 5,6 m, 11,2 m y 18,5 m respectivamente.
- El panel del mapa muestra la familia y la longitud del recorrido en metros.
- Pruebas de separación sobre los bordes reales de los tramos; se exigen al menos 3 m entre corredores independientes y se mantiene el control de altura entre niveles.
- La geometría usa una secuencia aleatoria independiente para no alterar resultados comprometidos. Se contrastan 240 carreras de 1.0.9: mismos ganadores, tiempos de llegada y poderes.

#### Cámaras de canicas

- El alcance de la cámara general se calcula con los límites del escenario; corrige el recorte de tramos lejanos en los mapas grandes.
- Al volver de una pausa de renderizado o de segundo plano, la cámara se resincroniza con la canica en lugar de quedarse mirando una posición antigua.
- Persecución adapta la distancia y la altura a la curva, y apunta parcialmente hacia el siguiente tramo para anticipar el giro.
- Transiciones suaves del campo de visión y menor sacudida de cámara con turbo, tornado o temblor. Los efectos sobre las canicas permanecen activos.
- Se conservan los controles de visibilidad, colisiones y paso por debajo de tableros, además de las vistas Desde la canica, Lateral y Aérea.

#### Clasificación y llegada

- Las canicas que ya llegaron se ordenan por su tiempo de llegada, no por su posición en la lista de participantes.
- Un cuadro tardío o una ventana en segundo plano no adelanta la clasificación más allá del instante del resultado. Se comprueba que la tabla coincida con el ganador tanto en Primero como en Último.

#### Novedades y documentación

- Nuevo acceso Novedades con la versión actual, búsqueda y cambios agrupados para cada salto de versión, disponible sin internet.
- README, notas de la versión y avisos del actualizador comparten el mismo registro de cambios.
- La validación impide preparar una nueva versión sin su entrada de historial y detecta un README desactualizado. Las versiones antiguas sin notas independientes se identifican expresamente.

### 1.0.8 → 1.0.9 — Daniela High fiable, resultados e inicio renovado

Fecha: 2026-09-07.

Pinball queda temporalmente desactivado para jugar; sus resultados anteriores se conservan.

#### Voz

- Corrección de las rutas canónicas de Windows que impedían a sherpa/eSpeak abrir los diccionarios de Daniela High.
- Precarga silenciosa en segundo plano, sin bienvenida hablada; validación de los archivos del modelo al solicitar la locución.
- La aplicación de escritorio deja de sustituir silenciosamente a Daniela por una voz de Windows; muestra preparación, reproducción y la causa concreta de los errores.
- Una sola síntesis activa y descarte de narraciones de tutorial que ya no corresponden al paso actual.
- Prueba de síntesis real usando la ruta canónica de Tauri, ejecutada localmente y en GitHub Actions.

#### Inicio y resultados

- Tres indicadores de preparación: participantes, juego y modo; verde al completar y amarillo para el siguiente paso.
- Archivo de partidas con rondas, eliminaciones, ganador y premio; búsqueda y exportación JSON independientes de la lista de participantes.
- Cinta de ganadores con pausa y apariencia alternativa Modo juego / Zona de Juegos, sin ocultar ni borrar resultados.
- Aviso visible cuando el almacenamiento local no permite conservar los resultados.

#### Juegos y entrega

- Canicas reconstruidas en terrazas descendentes, seguimiento por distancias en metros, colisión de cámara y correcciones de rotación, color e iluminación del metal.
- Hielo, río, tornado y temblor afectan avance, velocidad y desplazamiento; turbo mantiene su descontrol y el rescate regresa a la salida.
- Patos con bandadas de hasta cinco objetivos, refugios, plumas y bosque renovados; troncos, hojas y pasto bloquean los disparos y un pato completamente oculto no se puede acertar.
- Edición portátil con resources/tts, modelo, diccionarios y licencias; comprobación SHA-256 de todos los archivos copiados.
- Verificación de archivos mediante .NET para evitar fallos de carga de módulos de PowerShell, y tolerancia a la propagación del manifiesto de GitHub.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.8...v1.0.9).

### 1.0.7 → 1.0.8 — Instalar, actualizar o reinstalar con opciones claras

Fecha: 2026-09-03.

#### Instalación y actualización

- Opciones explícitas en español: actualizar directamente conservando datos, o desinstalar la versión anterior e instalar la nueva.
- La misma versión se puede actualizar o reparar. La eliminación de participantes, historial, premios y configuración es una decisión separada del desinstalador.
- Reintentos para comprobar el manifiesto remoto después de publicar, evitando declarar un error inmediatamente mientras GitHub propaga la versión.
- Pruebas y documentación actualizadas para las opciones del instalador.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.7...v1.0.8).

### 1.0.6 → 1.0.7 — Dificultad de canicas, eventos y actualización en el mismo lugar

Fecha: 2026-09-03.

Pinball era jugable en esta versión; se desactiva después en 1.0.9.

#### Canicas

- Mapas más grandes y elevados según la dificultad, separación entre niveles y mejoras en los encuadres de persecución y paso bajo pistas.
- Regla de victoria configurable: primera o última canica en llegar, con persistencia de la selección.
- Eventos de hielo, río, tornado y temblor, además de mayor dificultad y descontrol con turbo.

#### Patos, Pinball e inicio

- Eventos de bosque, cambios visuales de ambiente y ajustes en la presentación de Patos.
- Mejoras de control manual, seguimiento y funcionamiento automático de Pinball.
- Ajustes de la configuración inicial, ayudas de controles y pruebas de persistencia y accesibilidad.

#### Entrega

- Iniciador INSTALAR O ACTUALIZAR para detectar una instalación existente y usar el modo de actualización.
- Actualización de la descarga alternativa desde GitHub para obtener los recursos de voz mediante Git LFS.
- GitHub Actions descarga el modelo de voz y se refuerzan las comprobaciones de manifiestos de publicación.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.6...v1.0.7).

### 1.0.5 → 1.0.6 — Primera integración de Daniela High sin conexión

Fecha: 2026-09-02.

Esta integración todavía podía recurrir a una voz de Windows si fallaba. La corrección que fija Daniela y normaliza las rutas llega en 1.0.9.

#### Audio

- Modelo es_AR-daniela-high integrado mediante sherpa-onnx en Rust, con diccionarios, licencias y recursos distribuidos con el programa.
- Generación de WAV local, procesamiento del timbre de anuncio y eliminación del mensaje hablado al iniciar.
- Compilación nativa estática del motor para no exigir Python ni DLL de voz instaladas por el usuario.

#### Actualizaciones

- Comprobación al abrir, descarga automática del instalador firmado, progreso visible, instalación y reinicio.
- El programa puede iniciar sin conexión; las actualizaciones esperan a que no haya una partida, guía o demo activa.
- Pruebas del flujo de descarga e instalación y almacenamiento del modelo grande con Git LFS.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.5...v1.0.6).

### 1.0.4 → 1.0.5 — Interfaz, cámaras y distribución desde GitHub

Fecha: 2026-08-31.

#### Programa

- Mejoras de interfaz y cámaras de los juegos beta, junto con sus comprobaciones de accesibilidad y audio.
- Consolidación del repositorio en 1 Programa, 2 Instaladores y 3 Ejecutar, y actualización de la guía de uso.

#### Herramientas y entrega

- Correcciones de descarga pública y decodificación de manifiestos en Windows PowerShell.
- Corrección de la publicación de un Release nuevo cuando todavía no existe en GitHub.
- Actualización del flujo de GitHub Actions y sus referencias, manteniendo la firma del instalador en el computador local.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.4...v1.0.5).

### 1.0.3 → 1.0.4 — Entrega ordenada y nuevos encuadres 3D

Fecha: 2026-08-29.

#### Juegos

- Cámara lateral de Canicas, junto a las vistas Persecución, A bordo y Aérea.
- Cámaras Persecución y Cenital de Pinball, conservando la salida simultánea de las pelotas.
- Pupilas, patas animadas y retroceso visual al disparar en Patos.

#### Instalación

- Entrega organizada en carpetas de programa, instaladores y ejecución; acceso directo fuera de la carpeta interna de la instalación.
- Iniciador público de respaldo, instalador firmado con WebView2 sin conexión y ZIP del instalador.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/compare/v1.0.3...v1.0.4).

### 1.0.2 → 1.0.3 — Patos por tandas e iniciador público

Fecha: 2026-08-28.

#### Patos

- Cámara frontal fija, tandas de uno o dos patos, tres disparos por tanda, reloj de escape e indicadores de impacto.
- Ocultamiento completo y presentación inspirada en juegos de tiro a patos, con modelos propios.

#### Distribución

- Marca de autor OscarD0823 y referencia al proyecto.
- Instalador firmado con WebView2 sin conexión, entrega separada por funciones y ZIP de respaldo.
- Iniciador para descargar desde el repositorio público, elegir destino y preparar dependencias sin iniciar sesión en GitHub; se debe conservar el CMD junto al PS1.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/releases/tag/v1.0.3).

### 1.0.1 → 1.0.2 — Tutoriales interactivos y creador de instaladores

Fecha: 2026-08-27.

Fecha y cambios recuperados del commit 316aeca; no se conserva un Release separado de esta versión.

#### Uso y juegos

- Guía interactiva del inicio y demos por juego, con controles reales, navegación por teclado y narración de los pasos.
- Prácticas aisladas de los participantes, premios e historial reales.
- Mejoras de cámaras, pista y recuperación de Canicas, escenario de Patos y presentación de Pinball; etiquetas BETA y ayudas de controles.

#### Instaladores y pruebas

- Creación local con contraseña de firma protegida mediante DPAPI y comprobación previa de la clave.
- Caché de dependencias y validaciones para evitar repetir trabajo sin cambios.
- Verificador criptográfico del instalador y manifiesto; WebView2 sin conexión e instrucciones de entrega.
- Pruebas ampliadas de tutoriales, audio, accesibilidad, capacidad y semillas de Canicas.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/commit/316aeca).

### 1.0.0 → 1.0.1 — Versión intermedia sin notas independientes conservadas

Fecha no confirmada.

La documentación menciona compatibilidad del actualizador desde 1.0.1, pero el historial disponible salta de 1.0.0 a 1.0.2. No se inventa una lista de cambios para ese intervalo.

#### Estado del registro

- Sin etiqueta, fecha de publicación ni notas independientes conservadas en este repositorio. Los cambios confirmados están documentados en las versiones adyacentes.

### 1.0.0 — Base inicial de Fortuna Real

Fecha: 2026-08-25.

Resumen acumulado hasta el commit 27aea67, que todavía declara 1.0.0. La fecha corresponde al código, no a una publicación independiente del instalador.

#### Funciones iniciales

- Gestión de participantes, ganador directo, eliminación, premios, historial y rehabilitación de ganadores.
- Ruleta animada y Cartas, con anuncios de resultados y presentación de premios.
- Capacidad de hasta 200 participantes e integración de Canicas, Pinball y Patos 3D.
- Pistas procedurales, zonas temáticas y poderes en Canicas; cámaras, bosque y comportamiento adaptativo de Patos.
- Mejoras de rendimiento, controles de audio, funcionamiento de escritorio con Tauri y base del actualizador.

[Registro original de esta versión](https://github.com/OscarD0823/Fortuna-Real/commit/27aea67).

<!-- VERSION-HISTORY:END -->
