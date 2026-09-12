# Verificación de 1.0.11

12 de septiembre de 2026.

## Reglas y compatibilidad

- Sin preferencias por nombre, alias, mayúsculas, enlace o historial de derrotas.
  Todos conservan la misma regla pública de selección.
- Patos rápidos: una vida por participante y velocidad inicial 1,68× respecto
  al inicio del modo antiguo. Mantiene tres disparos por tanda. Un impacto
  oficial elimina al nombre revelado, según el orden criptográficamente sellado.
- Las nuevas semillas llevan el prefijo público `quick1:`. Las semillas antiguas
  siguen reproduciendo el mismo sello, superviviente y tres impactos por pato.
  El cambio reduce impactos necesarios de 3×(N−1) a N−1, no favorece a nadie.
- Los fenómenos de canicas usan una secuencia aleatoria separada para sus
  horarios. La misma semilla reproduce el calendario y una nueva lo cambia.
  Sus efectos alteran la animación de movimiento, no el resultado comprometido.

## Pruebas

- Suite `npm test` completa: tipos, persistencia, publicación, actualizador,
  capacidad, canicas, patos, equidad, recuperación, audio, pantallas y tutoriales.
- 144 calendarios de clima, 57.744 muestras de continuidad temporal y tamaños
  2, 8, 90 y 200. Ventanas sin solapamiento, efectos simultáneos en distintas
  posiciones, desaceleración real del avance y final exacto de la animación.
- Compatibilidad de 240 resultados de canicas de 1.0.9, con mismos tiempos,
  poderes y participantes seleccionados.
- Patos rápidos: todos los tamaños 2–200, 19.900 impactos oficiales, eliminación
  con un impacto, superviviente único y mismo ganador uniforme que el modo antiguo.
- Cámara: compensación de desplazamiento a 30, 60 y 144 FPS; encuadre más cercano
  con canicas pequeñas, conservación de pruebas de colisión y tableros superiores.
- Revisión visual local de persecución y a bordo sobre un circuito difícil.

La demo utiliza participantes ficticios y no registra premios ni modifica el
historial real. Las pruebas de actualización son de flujo simulado y configuración
nativa; no equivalen a instalar y actualizar en un segundo equipo con Windows.

La publicación requiere instalador firmado, manifiesto 1.0.11 y confirmación de
los artefactos en GitHub. No deben redistribuirse archivos bajo la etiqueta 1.0.10.
