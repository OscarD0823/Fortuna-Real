# Patos Retro — revisión inicial posterior a 1.0.10

Registro de la revisión inicial. La entrega 1.0.11 incorpora estos cambios y
añade Patos rápidos con una vida; consulta `NOTAS-VERSION-1.0.11.md`.

## Objetivo y referencia

Acercar Patos al juego de puntería clásico que el usuario identificó como Duck
Hunt, con la diferencia de que todos los participantes salen en una misma
bandada. Referencia de jugabilidad consultada: [Nintendo — Duck Hunt](https://www.nintendo.com/es-es/Juegos/NES/Duck-Hunt-946955.html).

Se creó arte pixelado propio mediante código. No se incluyeron sprites, ROMs,
personajes ni muestras de audio de Nintendo. La vista principal de Patos pasa
de 3D a un campo frontal retro; Canicas continúa en 3D sin cambios.

## Implementación

- Un pato por participante; todos los supervivientes participan en cada tanda,
  de 2 a 200. Se quitó de la interfaz el selector de uno, dos o cinco patos.
- Despegue colectivo desde el pasto y el árbol, cuatro cuadros de alas,
  trayectoria diagonal con cambios de dirección, caída caricaturesca al
  acertar y escape hacia arriba al agotar tres intentos o el tiempo.
- En vuelo libre, las celdas se adaptan al total para evitar que los patos
  se apilen o abandonen el campo. Con 200, los objetivos son necesariamente
  menores; se mantiene el botón accesible Siguiente impacto.
- La capa de árboles, arbustos y pasto se dibuja delante de los patos y su
  misma máscara bloquea disparos. Los completamente ocultos ni se dibujan ni
  se pueden alcanzar. Los píxeles transparentes de cada cuadro tampoco cuentan.
- Cielo, nubes, bosque, arroyo y tierra; viento, niebla, luciérnagas y lluvia.
  La tormenta no produce flashes de pantalla completa.
- Paleta e inversión siguen siendo efectos temporales. El temblor mueve el
  fondo sin desplazar objetivos, mira ni cobertura. La preferencia de movimiento
  reducido desactiva sacudidas, cambios de paleta e inversión y fija las alas.
- Marcador fuera del área de disparo, botón de salida arriba del campo y
  tutoriales actualizados. La mira modifica solo su elemento, no repinta la
  tabla de hasta 200 participantes con cada movimiento del ratón.
- Canvas 2D con cuatro sprites y dos capas de escenario en caché. Sin nuevos
  paquetes, modelos, descargas ni necesidad de WebGL para Patos. Se liberan el
  bucle, el listener de visibilidad y las capas al desmontar.
- Se conserva el compromiso criptográfico, las tres vidas y los resultados.
  Un acierto visual revela el siguiente impacto oficial; no permite apuntar a
  un nombre para alterar el ganador. Daniela High permanece sin cambios.

## Verificación

- `npm test`: suite completa correcta, incluyendo audio, persistencia, juegos,
  recuperación, accesibilidad y tutoriales.
- `npm run build`: compilación de producción correcta.
- Pruebas nuevas: 796 combinaciones de tamaño/tanda con salida completa;
  3.312 posiciones de vuelo, ausencia de solapamientos en vuelo libre, cuadros
  de alas, ocultamiento inicial y salida conjunta, máscaras de impacto en
  ambas orientaciones y vegetación que bloquea disparos. Coordenadas inválidas
  no generan aciertos.
- Pruebas existentes: 59.700 impactos, capacidades de 2 a 200 y conservación
  del orden sellado y las vidas.
- Navegador, laboratorio aislado: escenarios con 8 y 200 participantes; 200
  objetivos activos confirmados; ventana habitual y ventana estrecha de 640 px;
  tres fallos provocan escape sin quitar vidas; botón accesible resta una vida;
  resolución automática termina con el superviviente sellado. Sin errores ni
  advertencias de consola en las vistas inspeccionadas.
- Se detectó que el superviviente sin impactos podía seguir como «oculto» en
  la tabla al finalizar. Corregido en ambos caminos de finalización y verificado
  visualmente: el ganador y sus vidas quedan visibles.

## Alcance de la entrega

Cambios en código local: no se reemplazó el instalador ni el ZIP publicado de
1.0.10. No se probó esta variante dentro del ejecutable nativo de Windows ni
en otro PC. La capacidad lógica no es una garantía de FPS en todos los equipos.
La colisión pixelada se validó automáticamente; la prueba de impacto del flujo
completo en navegador se hizo con el control accesible.
