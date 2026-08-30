# Especificación verificable del kit 3D de Canicas

## Kit procedural integrado

La versión ejecutable ya usa el kit modular de
`src/games/marbles/marbleTrackPieceKit.ts`. El renderizador coloca una pieza
representativa por cada familia presente en el mapa y conserva un deck continuo
para evitar grietas. Cada objeto registra `moduleId`, dimensiones y sockets
`input/output` en `userData.asset`; el catálogo cubre salida, recta, curva,
serpentina, túnel, embudo, bifurcación, turbo, hielo y meta. Los GLB descritos
más abajo siguen siendo la ruta de sustitución por arte de Blender sin cambiar
el contrato de generación.

Este directorio reserva el contrato de producción para sustituir gradualmente
las primitivas procedurales. No contiene arte simulado: cada GLB deberá provenir
de un archivo fuente versionado y superar los controles siguientes. Las medidas
están alineadas con el tablero procedural actual de 30 × 22,5 unidades; una
unidad del motor equivale a un metro de Blender.

## Entrega requerida

| Familia | GLB requerido | Pivote / sockets | LOD0 máximo |
| --- | --- | --- | ---: |
| Pista | `SM_Track_Straight_A`, `SM_Track_Curve_15_A`, `SM_Track_Curve_30_A`, `SM_Track_Curve_45_A` | Pivote en `SOCKET_IN`; `SOCKET_OUT` y `SOCKET_RAIL_L/R` | 3.500 tris/pieza |
| Desnivel | `SM_Track_Slope_Up_A`, `SM_Track_Slope_Down_A`, `SM_Track_Banked_Left_A`, `SM_Track_Banked_Right_A` | Sockets coplanares con el perfil de pista | 4.500 tris/pieza |
| Unión | `SM_Track_Connector_A`, `SM_Track_EndCap_A`, `SM_Track_Junction_A` | Origen en centro de snap | 1.500 tris/pieza |
| Soporte | `SM_Track_Support_A`, `SM_Track_Support_B`, `SM_Platform_Round_A` | Centro inferior en el suelo | 2.500 tris/pieza |
| Máquina | `SM_Turbine_Base_A`, `SM_Turbine_Rotor_A`, `SM_Cannon_Base_A`, `SM_Cannon_Barrel_A` | Rotor/barril en eje real de giro | 12.000 tris/héroe |
| Tubería | `SM_Pipe_Straight_A`, `SM_Pipe_Elbow_A`, `SM_Pipe_Junction_A` | Sockets axiales exactos | 1.800 tris/pieza |
| Poder | `SM_Portal_Frame_A`, `SM_Portal_Core_A`, `SM_IceCrystal_A/B/C`, `SM_PowerCore_Base_A`, `SM_PowerCore_Orb_A`, `SM_BoostStrip_A` | Pivote funcional por pieza | 8.000 tris/héroe |

Cada fuente se entrega como `source/<mismo_nombre>.blend`; cada export como
`glb/<mismo_nombre>.glb`. Un metro de Blender equivale a una unidad de mundo.
Escala aplicada `(1,1,1)`, sin rotación residual ni escala negativa.

## Dimensiones maestras

| Pieza | Ancho × alto × largo | Detalle obligatorio |
| --- | --- | --- |
| Tablero | 30,00 × 0,76 × 22,50 m | Chaflán 0,12 m; paneles de 4,82 × 4,32 m; remaches cada 1,05 m |
| Calzada fácil | 1,915 × 0,10 × 2,00 m | Deck estructural total 2,495 m; canal útil 1,915 m |
| Calzada media | 2,141 × 0,10 × 2,00 m | Deck estructural total 2,721 m; canal útil 2,141 m |
| Calzada difícil | 2,366 × 0,10 × 2,00 m | Deck estructural total 2,946 m; canal útil 2,366 m |
| Baranda exterior | Ø0,27 m; eje a ancho/2 + 0,24 m | Inserto luminoso Ø0,11 m; altura del eje 0,38 m |
| Baranda interior | Ø0,18 m; eje a ancho/2 + 0,06 m | Inserto luminoso Ø0,068 m; altura del eje 0,16 m |
| Traviesa | ancho de deck × 0,12 × 0,20 m | Separación 0,48–0,56 m; nunca atraviesa el canal visible |
| Recta | longitud modular 2,00 m | `SOCKET_IN=(0,0,0)` y `SOCKET_OUT=(0,0,2)` |
| Curva | radio central 1,80 m | Ángulos 15°, 30° y 45°; arco tangente en ambos sockets |
| Pendiente | longitud 2,00 m; subida 0,55 m | Inclinación 15,38°; variante fuerte hasta 1,15 m solo en Difícil |
| Plataforma de poder | radio 1,84–2,18 m; alto 0,52 m | Aro funcional a 0,03 m sobre la tapa |
| Canica | Ø0,38 m nominal | Variantes Mini Ø0,25 m y Gigante Ø0,55 m; collider esférico independiente |
| Meta | ancho de pista × 1,65 × 0,34 m | Dintel a 1,52 m; postes Ø0,24 m |

## Construcción paso a paso

1. Configurar Blender en métrico, longitud en metros, aplicar rotación y
   escala, y situar `SOCKET_IN` en el origen mirando a `+Y`.
2. Modelar el deck desde un perfil de 0,10 m de alto: calzada central,
   hombro de 0,29 m por lado y chaflán de 0,04 m. Los laterales deben conservar
   el mismo perfil en Recta, Curva y Pendiente para hacer snap sin grietas.
3. Crear las curvas con `Spin` alrededor del radio central de 1,80 m. Mantener
   la longitud de arista de silueta por debajo de 0,16 m y corregir normales
   después de aplicar el modificador.
4. Separar barandas, insertos emisivos, traviesas y tornillos. Instanciar los
   elementos repetidos; no hornearlos como cientos de objetos independientes.
5. Construir soportes cada 2,00 m y debajo de todo cambio vertical. El pie mide
   0,55 × 0,55 m, el poste 0,22 × 0,22 m y la placa superior 0,72 × 0,12 m.
6. Armar máquinas como jerarquías: base estática, pivote en el eje, pieza
   móvil y collider. Ninguna pieza animada puede compartir origen arbitrario.
7. Asignar una paleta de cinco materiales compartidos: hierro antracita,
   acero oscuro, cobre, emisión cian y emisión ámbar. El hielo y el portal son
   los únicos materiales transparentes.
8. Hacer UV a 512 px/m para pista y 768 px/m para piezas héroe; empaquetar
   BaseColor, Normal y ORM. La emisión solo marca flechas, rieles y núcleos.
9. Crear LOD, colliders y sockets con los nombres del contrato; exportar GLB
   con `+Y Forward`, `+Z Up`, transformaciones aplicadas y tangentes incluidas.
10. Validar la composición desde la cámara 16:9: la ruta debe ocupar 70–76 %
    del panel, conservar al menos 6 % de aire exterior y no quedar cubierta por
    clasificación, eventos o controles. El presupuesto de toda la escena es
    120.000 triángulos y 200 draw calls en calidad Alta.

## Malla, UV y materiales

- Cero caras degeneradas, non-manifold accidental o normales invertidas.
- UV0 dentro de 0–1, sin solape accidental y con densidad por familia dentro de
  ±10 %. Los solapes deliberados se anotan en `asset_manifest.json`.
- Tangentes MikkTSpace y triangulación estable antes de validar hashes.
- Texturas 1024 o 2048, dimensiones múltiplo de 4:
  `T_<Familia>_BC`, `T_<Familia>_N`, `T_<Familia>_ORM` y opcional `T_<Familia>_E`.
- BaseColor/Emissive en sRGB. Normal y ORM lineales. ORM usa R=AO,
  G=Roughness y B=Metallic.
- No se permite iluminación ni reflejos horneados en BaseColor.
- Entrega GPU en KTX2/Basis; el PNG/TIF maestro permanece fuera del paquete de
  ejecución.

## LOD y colisión

- `LOD1`: 55–65 % de triángulos de LOD0.
- `LOD2`: 25–35 %.
- `LOD3`: 8–15 %.
- Error de silueta máximo: 2 píxeles en el umbral de cambio acordado.
- Colliders convexos separados con nombre `COL_<Nombre>_<nn>`; una pieza
  dinámica nunca usa la malla render completa como collider.
- El volumen de colisión debe quedar a ≤0,03 m de la superficie jugable.

## Criterios automáticos de aceptación

El importador futuro debe rechazar un activo si:

1. falta alguno de los nombres obligatorios;
2. escala, rotación o pivote no cumplen el contrato;
3. existen texturas fuera de las resoluciones admitidas;
4. el número de triángulos supera el presupuesto;
5. falta UV0, normal, tangente o un LOD obligatorio;
6. un socket emparejado queda a más de 0,001 m o 0,1 grados de su pareja;
7. una ruta del GLB es absoluta o referencia un archivo externo no incluido.

La aprobación visual se realiza además a 4:3, 16:10, 16:9 y 21:9, con los
presets bajo/medio/alto, sin grietas entre módulos ni popping visible.
