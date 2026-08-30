; Mantiene un acceso visible fuera de la carpeta interna de instalacion.
; La funcion pertenece a la plantilla NSIS de Tauri y tambien actualiza el
; acceso existente cuando se instala un parche.
!macro NSIS_HOOK_POSTINSTALL
  Call CreateOrUpdateDesktopShortcut
!macroend
