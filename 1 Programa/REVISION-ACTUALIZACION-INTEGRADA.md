# Actualización integrada — revisión local

Registro de las pruebas iniciales. Estos cambios se integran en la entrega
1.0.11; este informe no certifica una actualización nativa en otro computador.

Fecha: 9 de septiembre de 2026. Código de desarrollo sobre 1.0.10; no es una
publicación nueva ni una certificación de instalación en otro computador.

## Cambios

- El actualizador de Tauri usa `quiet` en Windows. NSIS recibe `/S /R /UPDATE`:
  aplica la actualización sin asistente y solicita volver a abrir el programa.
  El instalador abierto a mano conserva su interfaz y sus opciones.
- Un diálogo dentro de Fortuna Real muestra comprobación, descarga,
  verificación de firma, preparación y aplicación/reinicio.
- La descarga muestra datos recibidos, porcentaje si el servidor informa el
  tamaño, velocidad media y tiempo restante aproximado. Tras seis segundos sin
  nuevos datos informa que espera la conexión. El límite de descarga es de
  veinte minutos para permitir conexiones lentas y el paquete de voz offline.
- No hay un porcentaje inventado de instalación. El evento `Finished` de Tauri
  precede a la verificación nativa: la firma solo se marca como verificada cuando
  `download()` termina correctamente. Una descarga truncada no se instala.
- Antes de instalar se guarda un recibo local con versión anterior, esperada y
  fecha. Al reabrir se consulta `getVersion()`; solo se confirma éxito si la
  versión realmente ejecutada es la esperada o una superior. El recibo no
  contiene ejecutables, rutas, órdenes ni permisos para instalar.
- Una apertura con la versión anterior muestra el fallo y ofrece reintentar o
  continuar. No provoca reintentos automáticos en bucle. Recibos corruptos o
  antiguos se ignoran y fallos de almacenamiento no impiden abrir la aplicación.
- Los eventos de reconexión no sustituyen una descarga en marcha. La partida,
  la guía, la demo y los resultados abiertos siguen aplazando la actualización.
- Escape no oculta una operación activa. Tras un error o la confirmación final
  permite continuar. El diálogo captura el foco y lo restaura al cerrarse.
- La X de Windows conserva su funcionamiento normal, sin ampliar permisos
  nativos. Se mantiene el paquete firmado, el origen de GitHub, la CSP y la
  instalación por usuario. No se deshabilitan avisos de seguridad de Windows.

## Verificación realizada

- `npm test`: tipos, persistencia, actualizador, configuración de publicación,
  capacidad, canicas, patos, sorteo, recuperación, audio, pantallas,
  accesibilidad y tutoriales.
- Pruebas del flujo con actualizador simulado: descarga y firma correctas,
  firma pendiente/incorrecta, tamaño desconocido, bytes inválidos, descarga
  incompleta, almacenamiento inaccesible, fallo de instalación y de reinicio.
- Pruebas del recibo: lectura, corrupción, caducidad, fecha futura y comparación
  numérica de la versión realmente abierta.
- `npm run build` y `cargo check --locked`.
- Demostración en navegador: etapas de descarga/verificación/aplicación,
  error/reintento y finalización. Se comprobó Escape y continuar, ausencia de
  porcentaje de instalación y de desbordamiento horizontal en 480×640 y
  800×600. El contenido largo se desplaza dentro del diálogo.
- Se detectó y corrigió el cierre accidental mediante Escape: la cancelación
  del diálogo se controla con manejadores nativos, no solo con el evento
  delegado de React.

## Límites y siguiente comprobación de distribución

No se ejecutó una actualización real sobre una instalación de Windows ni se
generó/publicó un instalador nuevo en este cambio. La demostración en
`marbles-preview.html?game=updater` está limitada a desarrollo, indica expresamente
que es una simulación y no descarga ni instala nada.

El proceso debe cerrarse brevemente para que Windows reemplace el ejecutable.
Durante ese intervalo no puede seguir dibujando su propia ventana. El aviso
anterior y la confirmación al volver están en la interfaz de Fortuna Real.

Hay que empaquetar una versión superior a 1.0.10 y comprobar en un equipo de
prueba: descarga firmada, cierre, sustitución silenciosa, reapertura, versión
correcta y conservación de participantes, resultados y voz Daniela High.
Interrumpir una descarga, rechazar una firma de prueba y repetir la apertura con
la versión antigua deben dejar disponible el programa y ofrecer recuperación.

Un cliente antiguo utiliza su configuración de actualización ya compilada.
Por ello, la transición desde la 1.0.10 publicada puede mostrar todavía su
ventana pasiva. El modo silencioso está disponible cuando el cliente ya contiene
estos cambios; un nuevo manifiesto por sí solo no modifica clientes antiguos.
