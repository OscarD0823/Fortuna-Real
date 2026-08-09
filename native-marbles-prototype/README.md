# Prototipo nativo de Canicas

Esta carpeta contiene una prueba visual independiente de Fortuna Real hecha con
Bevy. No usa HTML, CSS, React ni el WebView de Tauri: abre una ventana 3D nativa
y renderiza un único circuito fijo inspirado en la maqueta de referencia.

El alcance de esta primera prueba es intencionalmente pequeño:

- un solo mapa industrial;
- ocho canicas identificadas por color y número;
- cámara isométrica fija;
- pista elevada, plataformas, portal, hielo, turbinas, cañones y luces;
- cámara isométrica ortográfica, HDR, bloom moderado y oclusión ambiental;
- módulos de pista con perfil biselado, chasis, muros, placas y filetes metálicos;
- textura industrial propia en `assets/textures/gunmetal-panels-v1.png`;
- animación ambiental, sin lógica de carrera todavía.

## Ejecutar

Desde la raíz de Fortuna Real, abre `Iniciar prototipo nativo de Canicas.cmd`.
La primera ejecución tarda porque Rust debe compilar el motor 3D. Las siguientes
aperturas reutilizan esa compilación.

También se puede iniciar desde PowerShell:

```powershell
.\iniciar-canicas-nativo.ps1
```

Para compilar una versión optimizada:

```powershell
.\iniciar-canicas-nativo.ps1 -Release
```

## Siguiente etapa

El prototipo ya supera la fase de cubos planos mediante perfiles extruidos y
materiales PBR, pero la referencia utiliza piezas artísticas con siluetas y detalles
propios. El siguiente salto requiere un kit modelado (pista, juntas, cañones,
engranajes y tuberías) y exportado como glTF. La aplicación cargará ese kit sin
cambiar la lógica del mapa.
