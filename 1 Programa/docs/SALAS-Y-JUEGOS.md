# Salas por código, turnos y próximos juegos

Propuesta de diseño e implementación; **no es una función habilitada**. Revisión: 7 de octubre de 2026.

## La experiencia que propongo

1. El creador abre Windows o la web, elige juego y pulsa «Permitir participantes por Internet».
2. Se crea una sala con código de seis caracteres sin símbolos ambiguos, enlace y QR. El creador comparte el código; nunca su credencial de administrador.
3. Los jugadores abren la web en móvil/PC, escriben código y apodo y entran en la sala de espera. El creador acepta o rechaza entradas y puede bloquear nuevas incorporaciones.
4. Antes de empezar, todos ven participantes, reglas, premio, orden de turnos y si se trata de azar o habilidad. La lista se cierra al comenzar.
5. Todos ven la misma partida. Solo el jugador del turno tiene habilitado el botón de acción; el resto ve «Turno de…» y el reloj.
6. Se valida una acción por turno. El resultado se confirma una vez y se guarda la clasificación completa solo cuando termina la partida.
7. Al cerrar la sala se invalidan los accesos. Si el creador desaparece, pausa, margen de reconexión y después cierre automático; no inventar ganador por desconexión.

Cada amigo puede crear su propia sala simultáneamente. Los códigos identifican salas independientes, no puertos de su computador. La web permanece disponible aunque cierre el creador; lo que termina es **su sala**, no el sitio entero.

## Alojamiento y límites de gratuidad

La interfaz puede seguir en GitHub Pages: el alojamiento estático de repositorios públicos está incluido en GitHub Free. Pages no ejecuta un servidor de turnos. [Documentación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Para un primer piloto recomiendo un coordinador pequeño en Cloudflare Workers con **Durable Objects SQLite** y WebSockets con hibernación. El plan gratuito documenta 100.000 solicitudes diarias y 13.000 GB-s/día de cómputo; también tiene cuotas de almacenamiento y operaciones. Los mensajes WebSocket entrantes cuentan con una relación 20:1 en ese cómputo de solicitudes. No es capacidad ilimitada: habría que medir consumo y limitar salas. [Precios oficiales](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Esto **sí depende de un servicio externo**, aunque no de Firebase. No hay una solución universal de Internet en la que un PC doméstico, sin servidor/señalización, dominio, configuración de red o relay, sea alcanzable desde todos los móviles. WebRTC también necesita señalización y a veces relay. La alternativa de autoalojamiento requiere un servidor HTTPS accesible y mantenimiento del propietario. No abriría puertos automáticamente.

El piloto propuesto empezaría en plan gratuito, sin activar facturación, con tope configurable de 30 jugadores y 10 espectadores por sala, sala máxima de dos horas y un límite global de salas concurrentes calculado tras medir. Son límites de producto propuestos, no una promesa de capacidad del proveedor. Si la cuota o el servicio falla, mostrar el problema y no confirmar acciones ni resultados ficticios. No se ha creado una cuenta ni desplegado este servidor.

## Reglas técnicas para implementarlo

- El coordinador mantiene `roomId`, `matchId`, fase, `revision`, `turnId`, fecha límite del turno y resultados confirmados. El cliente nunca manda «yo gané» como verdad.
- Separar credencial privada de anfitrión, token de jugador y token de espectador. El código público solo permite solicitar entrada; no concede administración. Generar códigos/tokens con aleatoriedad criptográfica y comprobar colisiones de códigos.
- Cada mensaje de acción lleva `actionId`, `turnId` y revisión. Validar identidad, fase, plazo y lista de acciones permitidas; responder igual a un reintento ya procesado. Dos pestañas no deben consumir dos turnos.
- Roles: anfitrión configura/pausa; jugador actúa solo en su turno; espectador solo recibe. Validar todo en el servidor, no solo desactivar botones.
- Limitar intentos de código, frecuencia y tamaño de mensajes; apodos de 2–24 caracteres tratados como texto, sin HTML. Sin chat ni subida de archivos en el piloto.
- TLS, orígenes permitidos explícitos, tokens en memoria/sesión y no en URLs públicas, sin secretos administrativos en el frontend. No usar el apodo como identidad ni dar ventajas ocultas a nombres concretos.
- Publicar reglas y compromiso antes de la acción, revelar prueba al terminar. No enviar la semilla privada a jugadores mientras puedan inferir resultados pendientes. Documentar el modelo de confianza del coordinador: un hash por sí solo no demuestra que el organizador no buscó una semilla favorable.
- Difundir cambios de estado y eventos, no video ni 60 posiciones por segundo. Para Ruleta/Cartas basta confirmar evento, inicio y resultado; cada dispositivo anima localmente. El reloj oficial es del servidor, no del teléfono.
- Reconectar con token y última revisión; entregar instantánea y eventos faltantes. Propuesta: 20 segundos por turno, aviso a los 5 restantes, 30 segundos de gracia para reconectar; omitir/pausar solo según la regla pública elegida antes de empezar.
- El anfitrión conserva la tabla final local con identificador de partida y acciones confirmadas. Un aborto solo queda en auditoría, nunca en la cinta ni como victoria.
- Pruebas obligatorias: dos salas simultáneas, dos dispositivos reales por Internet, doble clic, repetición de mensajes, turnos fuera de orden, suplantación de rol, desconexión, cierre, cuotas agotadas, reloj alterado y reinicio del anfitrión.

## Ruleta y Cartas: dos tipos de interacción distintos

**Ruleta actual, participación remota:** en cada turno el jugador pulsa «Girar» una sola vez. Dispara el sorteo uniforme existente; no decide su fuerza ni quién gana. Todos ven el mismo resultado y el comprobante. Debe decir «Tu botón inicia un sorteo», sin aparentar habilidad.

**Nueva Ruleta de puntuación:** cada jugador dispone de un giro en su turno. Obtiene puntos de sectores fijos de igual probabilidad; gana la puntuación mayor (o menor, si se eligió antes). Empates: ronda extra solo entre empatados. Mostrar tabla de puntuaciones, turno y giro usado. Esta variante necesita un motor distinto del sorteo de nombres.

**Cartas actuales, revelación remota:** el jugador del turno toca un reverso; se revela el resultado ya comprometido, igual que ahora. Explicarlo expresamente: elegir la posición no modifica al ganador.

**Nuevas Cartas mayor/menor:** baraja sin reemplazo sellada antes de comenzar, una elección por turno. La posición elegida sí corresponde a una carta fija y no se reasigna al tocarla. Definir A=14, J=11, Q=12, K=13; los palos no desempatan, empate implica otra ronda entre empatados. Limitar a 52 participantes por baraja o declarar de antemano otro sistema para grupos mayores. No reutilizar el motor actual, que revela el mismo resultado en cualquier reverso.

## Prioridad de juegos nuevos

| Juego | Interacción y regla | Motivo / dificultad estimada |
| --- | --- | --- |
| Número mayor o menor | Un botón por turno obtiene 1–1.000. Empates repiten entre empatados. | Primer piloto: reglas claras, pocos mensajes; baja dificultad relativa. |
| Cartas mayor/menor | Cada participante revela una posición distinta; tabla visible. | Reutiliza presentación, requiere baraja autoritativa nueva; media. |
| Ruleta de puntos | Un giro por persona y desempate publicado. | Muy fácil de usar desde móvil; media. |
| Cofres de sorpresa | Cada turno abre un cofre único de un tablero previamente sellado. | Azar visual, sin pagos; media. |
| Memoria por turnos | Destapar dos fichas, puntuar parejas; mismo tiempo para todos. | Habilidad real, sin confundirlo con sorteo; media. |
| Carrera con decisiones | Elegir izquierda/derecha o usar un poder en ventanas de turno. | Requiere simulación determinista compartida y reglas nuevas; alta. |

Evitar como primer juego pruebas de «el más rápido gana»: el retraso de Internet perjudica a algunos jugadores. Mantener azar y habilidad como categorías explícitas y guardar reglas/versión junto a cada clasificación.

## Canicas: mejoras recomendadas antes del modo conectado

Estas son próximas tareas, no cambios hechos en esta versión:

1. Fijar escala de escena documentada: propuesta 1 unidad = 1 metro, canica de 0,18 m de diámetro, carril útil mínimo 1,2 m, pared de 0,25 m. Los 30 cm entre niveles no bastan para una cámara de persecución: asegurar al menos 1,8 m libres en cruces transitables y corredor de cámara de 0,35 m adicional. Validar con la geometría actual antes de convertir dimensiones.
2. Separar módulos: recta 8 m, curva de 90° radio interior 3 m, horquilla de radio 3,5 m, bifurcación con reunión posterior, rampa máxima orientativa de 12°, puente sin soportes dentro del corredor. Aceptar un mapa solo si anchura, uniones, pendientes y gálibo pasan un validador automático.
3. Tres escalas iniciales para medir: fácil 80–120 m / 2 niveles, media 160–220 m / 3 niveles, difícil 280–360 m / 4–5 niveles. La dificultad debe aumentar decisiones y obstáculos legibles, no ocultar la pelota ni apiñar geometría.
4. Cámara de persecución: referencia inicial 2,8–4 m detrás y 1,2–1,8 m sobre la canica, FOV 55–65°, anticipación por velocidad, amortiguación independiente de FPS y radio de colisión 0,2 m. Barrer el volumen desde la canica al objetivo de cámara y desde la posición anterior; recortar distancia antes de penetrar un puente. Evitar cámaras que atraviesen el suelo por intentar bajar demasiado.
5. Preferir ruta continua bajo el puente y abrir al salir. Ocultar/atenuar temporalmente un techo solo como modo de accesibilidad anunciado, no como sustituto de colisiones. Vista general accesible siempre, etiqueta del participante y marcador del siguiente tramo.
6. Anunciar hielo/río/tornado/temblor unos 2 s antes; duración 5–9 s, zona delimitada y descanso de 12–20 s como punto de partida. Física a paso fijo, fuerzas limitadas y recuperación verificable si sale de pista. Probar miles de semillas y medir 30/60/120 FPS.
7. No cambiar silenciosamente la equidad del sorteo actual. Si el resultado está sellado, las fuerzas solo lo representan. Un futuro modo donde poderes y decisiones cambien realmente la clasificación debe tener motor y reglas separados, explicarlo a todos y conservar una repetición determinista.
8. Objetivos de aceptación: ningún cruce de cámara/techo en semillas de prueba, canica seguida visible al menos el 95% de cuadros útiles, ninguna canica bloqueada indefinidamente y modos de menor detalle para móvil. Medir en hardware real; no prometer 60 FPS sin medición.

## Patos: legibilidad y participación

1. Mantener arte original retro, sin copiar sprites, música, logos o personajes de Nintendo. Cámara fija, siluetas grandes, alas y cuerpo distinguibles; HUD fuera del área de vuelo.
2. Separar fondo, vuelo y primer plano. Usar la misma máscara de árboles/pasto para pintar cobertura y rechazar impactos: un pato totalmente tapado no puede verse ni recibir un disparo.
3. Salidas de todos los supervivientes sincronizadas, refugios repartidos y tiempos ocultos variables acotados (propuesta 0,8–2,5 s). Evitar reaparecer justo bajo la mira; avisar del regreso con movimiento de follaje sin revelar un blanco disparable antes de tiempo.
4. Para grupos grandes, vuelo repartido por zonas, escala adaptable, contornos y lista de nombres sin tapar blancos. No reducirlos a píxeles imposibles de tocar: probar teléfonos con 8, 30 y 100 jugadores y limitar el modo interactivo si no es legible.
5. Efectos de viento, niebla y paleta identificados por icono y texto; opción de reducir movimiento y desactivar inversión/temblor, sin flashes rápidos. La accesibilidad no debe alterar probabilidades.
6. Primer modo conectado: turnos de tres disparos del jugador activo. En el sorteo actual, el acierto revela el siguiente impacto sellado, no elimina a quien el usuario decide. Un modo competitivo de puntería requeriría blancos reales autoritativos y puntuación separada; nunca presentar una animación predecidida como habilidad.
7. Validar impactos en una línea temporal del servidor con tolerancia limitada y publicada; no aceptar del cliente «acerté» sin comprobación. Para evitar penalizar por latencia, es preferible que cada turno sea un pequeño reto independiente de puntuación y no una carrera simultánea de clics.

## Orden de implementación recomendado

Sala/lobby y permisos → Número mayor/menor → reconexión e historial → Ruleta y Cartas por turnos → cámaras/legibilidad móvil → retos de habilidad. No habilitar premios de valor ni anunciar juego online hasta pasar las pruebas y actualizar privacidad/condiciones.
