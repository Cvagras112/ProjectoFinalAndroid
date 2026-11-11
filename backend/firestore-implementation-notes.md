# Revisión de Firestore para Android BORA

El modelo vigente está documentado en [modelo_datos.md](modelo_datos.md). La configuración de prueba usa el proyecto local ficticio `demo-bora` y reglas locales; no se ejecutó ningún despliegue remoto.

## Operaciones Android documentadas

- Productos e inventario: `products/{productId}`.
- Ventas privadas: `sales/{saleId}`.
- Perfil/seguimientos/tokens de dispositivo: `users/{uid}`, `follows` y `devices`.
- Ferias e invitaciones: `fairs/{fairId}` y `participants/{entrepreneurUid}`.
- Asociaciones y auditoría: `associations`, `adminAudit`.

Las pantallas Android usan repositorios. Seguimientos y ventas quedan asociados al UID autenticado. La app solicita ubicación solo para ordenar ferias; no la persiste.

## Controles implementados en reglas locales

- Fuente del rol administrativo: documento de perfil escrito por un administrador; no se acepta un rol enviado por el cliente.
- Productos: validación estricta compartida para altas/ediciones, propietario inmutable y rutas de imagen bajo el UID.
- Ventas: solo la emprendedora dueña lee su historial; no se permite editar ni borrar.
- Ferias: altas y gestión reservadas a administrador; emprendedora invitada solo cambia `invitada` a `confirmada` o `rechazada`.
- Seguimientos/dispositivos: comprador Google solo administra documentos bajo su UID.
- Storage: lectura pública de fotos y carga JPEG bajo 5 MB, solo en la ruta de la dueña.
- Auditoría admin: los documentos son de solo alta, no modificables desde clientes.

## Suite automatizada

Los casos Firestore/Storage están en `tests/firestore.rules.test.mjs` y se ejecutan con Emulator Suite usando `npm run test:rules`. La suite cubre propiedad de producto, historial, participantes de ferias, seguimiento y subida/lectura de fotos. Se añadieron los casos pero no se pudieron ejecutar desde esta sesión; dependencias y binario de emulador están configurados para instalarse en D:.

## Límites de seguridad pendientes

- La colección `products` sigue siendo legible públicamente; Android oculta productos no disponibles en la interfaz, pero una lectura directa de Firestore todavía puede obtenerlos. Separar el catálogo público del inventario privado antes de cargar datos que deban ocultarse.
- Una emprendedora podría fabricar un documento de venta propio. Las reglas comprueban propiedad y tipos, pero no prueban que una venta y su reducción exacta de stock sean atómicas. Migrar esa operación a un backend confiable si el historial se considera contable.
- La auditoría en Firestore no se escribe atómicamente con cambios administrativos si la administración opera desde SDK cliente. Requiere Cloud Function/backend.
- La función FCM preparada notifica seguidores de tiendas al confirmar una participación. Las asociaciones aún no tienen modelo de participantes ni notificación.
- Firestore CLI no estaba autenticado cuando se revisó el proyecto; la edición y región de la instancia no se confirmaron. No desplegar las reglas, índices ni Functions antes de confirmar el proyecto y validar en Emulator Suite.
