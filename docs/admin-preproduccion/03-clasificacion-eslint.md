# Clasificación de ESLint global

Recuento reproducido en lectura, sin --fix: 1.040 errores backend, 3 frontend.
Los responsables siguientes son por ámbito funcional, no una atribución de autoría
Git. Los nombres del responsable de inventario y de los módulos compartidos deben
confirmarse; no se presupone que un archivo sea de Javiera.

| Archivo | Errores | Clasificación | Responsable de revisión |
|---|---:|---|---|
| functions/.eslintrc.js | 32 | CRLF frente a LF | Configuración compartida; coordinador |
| functions/index.js | 486 | Solo CRLF frente a LF | Backend compartido; permiso explícito |
| functions/inventario.js | 163 | Solo CRLF frente a LF | Responsable inventario |
| functions/operacionesInventario.js | 140 | Solo CRLF frente a LF | Responsable inventario/ventas |
| functions/tests/administracion.test.js | 10 | 8 CRLF, 1 JSDoc, 1 línea vacía | David, pruebas administrativas |
| functions/tests/administradoresAuditados.test.js | 60 | 57 indentación, 2 operadores, 1 JSDoc | David |
| functions/tests/crearAdministradorAuditado.test.js | 76 | 20 comas, 36 espacios, 16 indentación, 2 operadores, JSDoc y EOF | David |
| functions/tests/diagnosticar-auditoria.js | 7 | 5 indentación, JSDoc, CRLF | David |
| functions/tests/preparar-admin-emulator.js | 7 | 5 indentación, JSDoc, CRLF | David |
| functions/tests/probar-cambio-password.js | 23 | 19 indentación, 2 JSDoc, comillas y CRLF | David |
| functions/tests/seguridad-admin-emulator.js | 36 | 31 indentación, 4 JSDoc, CRLF | David |
| web/src/pages/emprendedor/EditarTienda.jsx | 1 | react-hooks/set-state-in-effect | Responsable tienda/emprendedor; confirmar |
| web/src/pages/public/TiendaDetalle.jsx | 2 | react-hooks/set-state-in-effect | Responsable tienda/vitrina; confirmar |

Backend: 833 finales de línea y 207 incidencias restantes de estilo/documentación.
No se detectaron otras reglas en esa ejecución; esto no certifica ausencia de
errores funcionales. El predeploy de firebase.json ejecuta lint global: es bloqueo
de publicación aunque el alcance administrativo pase.

## Corrección propuesta por lotes

1. Pruebas y scripts administrativos: formato y JSDoc sin cambiar expectativas ni
   ejecutar scripts que sobrescriban fixtures existentes. Revisar diff y pruebas.
2. Acordar LF para backend y prevenir reaparición; cualquier .gitattributes o cambio
   de configuración compartida requiere coordinación. No convertir todo el repo.
3. Normalizar exclusivamente los cuatro archivos compartidos autorizados, en un
   lote mecánico separado. En index.js, exigir diff sin cambios de lógica.
4. Corregir efectos React con su responsable. En previews de imagen, evaluar estado
   de fallo ligado a la identidad de la imagen/remount por clave. En TiendaDetalle,
   evaluar separar estado por tienda y derivar valores; no eliminar resets sin
   conservar navegación de tienda A a B, favoritos, filtros e imagen de respaldo.

No desactivar globalmente reglas, excluir archivos activos para aparentar éxito,
ni introducir retrasos artificiales para ocultar set-state-in-effect.

## Cierre

Lint global sin errores; diff mecánico revisado; regresiones backend y frontend;
prueba de cambio de imágenes, fallback fallido, navegación entre tiendas y estado
de favoritos/filtros. Los 15 archivos preparados quedan fuera de estos lotes salvo
autorización específica. No se alteró ninguno en esta preparación.
