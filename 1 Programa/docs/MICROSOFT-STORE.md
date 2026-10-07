# Publicación en Microsoft Store

Revisión: 7 de octubre de 2026. **No se ha enviado la aplicación a la tienda.**

## Ruta recomendada sin coste inicial: la PWA

La misma web de GitHub Pages puede empaquetarse como aplicación de la tienda. Primero hay que verificar la web publicada, su instalación y sus juegos. La PWA usa voces del navegador; no incluye Daniela High ni comparte datos con el programa de escritorio.

1. El propietario debe iniciar el alta desde [Store Developer](https://storedeveloper.microsoft.com/), elegir el tipo de cuenta que corresponda y completar la verificación. Microsoft documenta registro sin tarifa en el **nuevo** flujo; otras entradas pueden mostrar el proceso antiguo. No compartas documentos de identidad, contraseñas ni selfies en el repositorio o en el chat. [Requisitos oficiales de registro](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account).
2. En Partner Center, reservar el nombre del producto y crear un producto MSIX/PWA. Guardar los valores de identidad del paquete, editor y nombre visible del editor.
3. Analizar `https://oscard0823.github.io/Fortuna-Real/` en [PWABuilder](https://www.pwabuilder.com/), corregir los requisitos que marque y generar el paquete Windows con la identidad anterior.
4. Preparar capturas reales, descripción en español, iconos, soporte, privacidad, clasificación por edades, disponibilidad y precio gratuito. No anunciar salas, sincronización o Daniela como funciones de la PWA.
5. Subir el paquete, probarlo en Windows y enviar a certificación. Microsoft decide la aprobación; generar el paquete no equivale a tener la aplicación publicada.
6. Para cambios normales de la web, publicar la nueva web; cambios del manifiesto/identidad pueden requerir otro paquete de tienda. [Guía oficial de PWA en Microsoft Store](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/microsoft-store).

## Si queremos el programa nativo con Daniela High

Mi recomendación es preparar un canal **MSIX** independiente más adelante. La distribución MSIX de Store incluye firma y alojamiento de Microsoft. La vía EXE/MSI requiere firma de código de una autoridad de confianza para el instalador y sus ejecutables, enlace HTTPS versionado inmutable, instalación silenciosa y paquete autónomo. La firma `.sig` de Tauri verifica las actualizaciones de Fortuna Real: **no sustituye un certificado Authenticode**. [Requisitos oficiales de paquetes](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements).

Para ese canal hay trabajo adicional específico del proyecto: empaquetar y licenciar la voz y sus DLL, probar rutas de recursos y persistencia bajo MSIX, fijar la identidad de Store y separar su actualización de la actualización NSIS de GitHub. No activar el instalador NSIS desde una edición administrada por Store. El instalador actual puede seguir disponible por GitHub de forma independiente.

## Lista previa al envío

- Probar inicio, teclado, pantalla pequeña, zoom, voz, cierre, recuperación e historial.
- Revisar todos los iconos, fuentes, sonidos y modelos: licencias y atribuciones necesarias.
- Publicar privacidad accesible y un canal de soporte real.
- Explicar las reglas reales de sorteos, cartas y premios. El modo visual «Zona de Juegos» no cambia su clasificación ni elimina obligaciones.
- Completar honestamente la clasificación de edad y las declaraciones de contenido; revisar normas de sorteos/apuestas aplicables si se incorporan pagos o premios monetarios. Esto requiere una revisión específica, no una suposición por el aspecto del juego.

La [página oficial de políticas](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies) muestra la versión 7.20 publicada el 15 de septiembre, con entrada en vigor el 22 de octubre de 2026. Antes del envío, comprobar la versión aplicable a su fecha. No se garantiza la certificación.

## Qué falta del propietario

Cuenta verificada, nombre reservado e identidad de paquete. Con esos datos públicos de identidad se puede preparar el paquete; el propietario debe aceptar acuerdos y presentar información personal directamente en Microsoft.
