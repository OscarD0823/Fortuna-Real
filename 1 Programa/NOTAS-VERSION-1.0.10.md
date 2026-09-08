# Fortuna Real 1.0.10

## 1.0.9 → 1.0.10 — Nuevos circuitos de canicas e historial de versiones

Fecha: 2026-09-08. Versión actual del código.

Canicas y Patos continúan en beta. Daniela High conserva el modelo y los ajustes aprobados en 1.0.9.

### Canicas: pistas y espacio

- Tres familias de geometría: Cañón sinuoso, Espiral descendente y Trébol de circuitos; la semilla determina la forma y la orientación.
- Curvas en S visibles, horquillas amplias y órbitas con lóbulos; se conserva una ruta continua hasta la meta, sin cruces planos forzados.
- Área de referencia ampliada a 56 × 42 m en Fácil, 75,6 × 56,7 m en Media y 98 × 73,5 m en Difícil. Desniveles de 5,6 m, 11,2 m y 18,5 m respectivamente.
- El panel del mapa muestra la familia y la longitud del recorrido en metros.
- Pruebas de separación sobre los bordes reales de los tramos; se exigen al menos 3 m entre corredores independientes y se mantiene el control de altura entre niveles.
- La geometría usa una secuencia aleatoria independiente para no alterar resultados comprometidos. Se contrastan 240 carreras de 1.0.9: mismos ganadores, tiempos de llegada y poderes.

### Cámaras de canicas

- El alcance de la cámara general se calcula con los límites del escenario; corrige el recorte de tramos lejanos en los mapas grandes.
- Al volver de una pausa de renderizado o de segundo plano, la cámara se resincroniza con la canica en lugar de quedarse mirando una posición antigua.
- Persecución adapta la distancia y la altura a la curva, y apunta parcialmente hacia el siguiente tramo para anticipar el giro.
- Transiciones suaves del campo de visión y menor sacudida de cámara con turbo, tornado o temblor. Los efectos sobre las canicas permanecen activos.
- Se conservan los controles de visibilidad, colisiones y paso por debajo de tableros, además de las vistas Desde la canica, Lateral y Aérea.

### Clasificación y llegada

- Las canicas que ya llegaron se ordenan por su tiempo de llegada, no por su posición en la lista de participantes.
- Un cuadro tardío o una ventana en segundo plano no adelanta la clasificación más allá del instante del resultado. Se comprueba que la tabla coincida con el ganador tanto en Primero como en Último.

### Novedades y documentación

- Nuevo acceso Novedades con la versión actual, búsqueda y cambios agrupados para cada salto de versión, disponible sin internet.
- README, notas de la versión y avisos del actualizador comparten el mismo registro de cambios.
- La validación impide preparar una nueva versión sin su entrada de historial y detecta un README desactualizado. Las versiones antiguas sin notas independientes se identifican expresamente.
