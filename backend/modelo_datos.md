# Modelo de datos Android BORA

Este modelo documenta las operaciones de la app Android y el backend Firebase compartido. Los campos visibles al público deben contener solo información que la emprendedora decidió publicar.

## Colecciones Firestore

### `users/{uid}`

Perfil creado por administración. Campos actuales: `role` (`admin` o `emprendedora`), `storeId`, `storeName`. Una cuenta compradora Google no requiere perfil para usar el catálogo.

Subcolecciones privadas:

- `follows/{followId}`: `targetId`, `targetType` (`store` o `association`), `notificationsEnabled`, `createdAt`, `updatedAt`. Solo el comprador dueño puede leer y modificar sus seguimientos.
- `devices/{deviceId}`: token FCM y `updatedAt`. `deviceId` es SHA-256 del token; solo la cuenta dueña puede administrarlo.

### `products/{productId}`

Documento de catálogo e inventario:

- Identidad: `ownerUid`, `storeId`.
- Ficha: `name`, `description`, `category`, `productType`, `price`, `imageUrl`, `imagePath`.
- Disponibilidad: `modality` (`Regular`, `A pedido`, `Pieza única`), `managesStock`, `stock`, `exhaustedBehavior`, `available`, `sold`.
- Variantes: lista de hasta 10 mapas con `id`, `name`, `price`, `stock`, `imageUrl`, `imagePath`.
- Auditoría de cambios: `createdAt`, `updatedAt`.

Precios son pesos chilenos enteros. Fotos viven en Storage bajo `products/{ownerUid}/...`.

### `sales/{saleId}`

Historial privado e inmutable: `ownerUid`, producto y variante, `quantity`, `unitPrice`, `totalPrice`, `placeType`, `placeName`, `soldAt`. La app actualiza el stock y crea el registro dentro de una transacción Firestore cuando el historial está activado.

**Límite conocido:** las reglas comprueban que una venta pertenece a una emprendedora y a uno de sus productos, pero un cliente manipulado podría fabricar un registro de venta propio. La validación del movimiento exacto de inventario requiere una Cloud Function/backend confiable antes de usar este historial como registro contable.

### `fairs/{fairId}`

Datos de la feria: `name`, `description`, `imageUrl`, `address`, `latitude`, `longitude`, `startsAt`, `endsAt`, `organizer`, `published`, `cancelled`, `createdAt`, `updatedAt`.

### `fairs/{fairId}/participants/{entrepreneurUid}`

Invitación o participación: `entrepreneurUid`, `entrepreneurName`, `status` (`invitada`, `confirmada`, `rechazada`, `agregada_admin`), `invitedBy`, `updatedAt`. Administración crea y elimina participantes; la emprendedora solo puede cambiar su estado de `invitada` a `confirmada` o `rechazada`.

### `associations/{associationId}`

Ficha administrada: `name`, `logoUrl`, `description`, `sector`, `contact`, `active`, `createdAt`, `updatedAt`. La participación de asociaciones puede representarse en una colección hija de participantes; su esquema y pantalla de gestión quedan pendientes de confirmar con el levantamiento.

### `adminAudit/{entryId}`

Registro inmutable de una acción administrativa: actor, acción, tipo e ID del objeto y fecha. Para que cada cambio y su auditoría sean atómicos, la escritura debe migrarse a una Cloud Function o lote confiable.

## Consultas Android e índices

- Inventario de emprendedora: `products.whereEqualTo("ownerUid", uid)`.
- Catálogo público: escucha de `products`; filtra disponibilidad en Android. Como Firestore aplica reglas antes de entregar resultados, hoy los productos no disponibles todavía son legibles directamente desde Firestore. La solución robusta es separar catálogo público e inventario privado o consultar solo una proyección publicada.
- Ferias públicas: `fairs.whereEqualTo("published", true).whereEqualTo("cancelled", false)`; orden temporal en cliente.
- Invitaciones: `collectionGroup("participants").whereEqualTo("entrepreneurUid", uid)`.
- Seguimientos: `users/{uid}/follows`, filtrados por `targetType`.
- Ventas: `sales.whereEqualTo("ownerUid", uid)`; filtros adicionales en cliente.

La combinación de ferias usa igualdad en dos campos; el orden de fecha se hace localmente para evitar índice compuesto por ahora. Revisar índices al cambiar estas consultas.

## Autoridad y límites

Los roles se leen desde `users/{uid}`; el cliente no puede crear su propio perfil ni asignarse `admin`. Reglas locales en `firestore.rules`, Storage en `storage.rules`; casos automatizados en `tests/firestore.rules.test.mjs`. No desplegar antes de validar el proyecto, la edición de Firestore y la suite contra Emulator Suite.
