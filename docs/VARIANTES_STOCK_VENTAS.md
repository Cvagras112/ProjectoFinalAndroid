# BORA: variantes, stock y ventas en Spark

## Estado: NO LISTO PARA DESPLEGAR

La revisión local mantiene Spark y utiliza el SDK Firestore, transacciones y reglas.
No se han desplegado reglas ni funciones, no se han modificado datos reales,
no se ha tocado Android y no se han creado commits ni hecho push.

La autorización de esta revisión se limita a reglas de inventario, sus pruebas y
este informe. No se ha cambiado el modelo ni los servicios para esquivar el límite.

## Resultado de las pruebas

Comando ejecutado desde la raíz:

    npm.cmd --prefix web run test:inventario:firebase

Proyecto ficticio: demo-bora-inventario. Firestore Emulator: puerto 8087.
La suite impide su ejecución sin FIRESTORE_EMULATOR_HOST. Los perfiles ficticios
se preparan con reglas desactivadas SOLO en los fixtures del emulador; todas las
operaciones de negocio y ataques se ejecutan con clientes sujetos a las reglas.

Resultado definitivo: **28 pruebas, 26 aprobadas, 2 fallidas**. El comando termina
con código 1; no se considera una suite aprobada.

Las dos fallidas corresponden al alta de un producto con diez variantes:

1. Mediante la transacción que utiliza la aplicación.
2. Mediante una escritura directa, para aislar la validación de las reglas.

Ambas exceden el límite de 1000 expresiones de Firestore. No son pruebas que se
hayan omitido ni convertido en éxitos esperados. El límite de diez variantes de
la interfaz no se ha reducido silenciosamente. El funcionamiento de todo el rango
admitido por la interfaz no está acreditado.

Las 26 aprobadas cubren:

- Crear y vender productos sin variantes y con dos variantes.
- Descontar solo la variante elegida; rechazar cambios en las demás.
- Dos ventas concurrentes por la última unidad: solo una confirma.
- Reintentos por el mismo ID: una sola venta y un solo descuento.
- Stock insuficiente: sin venta, recibo ni descuento parcial.
- Edición desactualizada: no repone inventario vendido.
- Conservar precio y nombre históricos tras editar o eliminar el producto.
- Cuentas ajenas, sin sesión o desactivadas; rol, perfil y tienda activa.
- Historial y recibos inmutables y privados.
- Ataques directos de precio, total, nombre, cantidad, propietario y tienda.
- Intentos de vender sin descuento o sin recibo, y de cambiar precio junto a la venta.
- Cantidades cero, negativas, fraccionarias o de tipo incorrecto.
- Variantes inactivas, stock negativo, IDs repetidos, IDs eliminados y campos extra.
- Todos los campos obligatorios, incluso con claves sustitutas que mantengan el tamaño del mapa.
- Tipos y límites de texto y números; URLs de exactamente 2000 caracteres.
- Pieza única vendida: no se vuelve a publicar.
- Rechazo de arrays anidados por el SDK, antes de llegar a las reglas (caso separado).

Un reintento concurrente puede recibir un rechazo transitorio si otro intento ya
confirmó la operación; repetir el mismo ID obtiene el recibo y no descuenta otra vez.

Otras comprobaciones ejecutadas:

    npm.cmd --prefix web run test:inventario
    npm.cmd --prefix web run build

Resultado: **9/9 pruebas de negocio aprobadas** y compilación Vite correcta.
Esto no sustituye las dos pruebas de reglas que siguen fallando.

## Qué se reestructuró

- Validación del descuento y del producto en la regla de productos.
- Validación de precio, nombre histórico, cantidad e identidad en la regla de ventas.
- Validación recíproca con getAfter: producto, venta y recibo deben existir juntos.
- Comprobaciones de propietario, cuenta, perfil y tienda activa solo para inventario.
- Comparación completa de las variantes no vendidas; solo stock puede cambiar en la vendida.
- Validadores equivalentes de tipos, campos y límites, con índices acotados.

Las reglas de autenticación, administradores, asociaciones y demás módulos se
compararon con HEAD y permanecen idénticas. SHA-256 del texto fuera de inventario:

    07df48926d970108683ec75d47346520c88f359e2e96400860d946070fe355da

Rama conservada: integracion/bora-web. HEAD conservado: cc28a49.
No se modificaron las funciones auxiliares ni los servicios web en esta revisión.
Los archivos Functions de una propuesta anterior no son utilizados por el flujo
Spark y no deben desplegarse.

## Modelo actual, conservado

- productos/{id}: campos existentes, Variantes como lista de mapas, Revision,
  UltimaVenta, Vendido y ActualizadoEn.
- ventas/{uid_operacionId}: producto, tienda, usuario, variante, cantidad,
  precio/total históricos y fecha.
- movimientosInventario/{uid}/operaciones/{operacionId}: recibo inmutable de reintento.

No se cambiaron identificadores ni se ejecutaron migraciones.

## Compatibilidad con Spark y propuesta para continuar

Las transacciones y las reglas usadas son compatibles con Spark. Sin embargo,
**esta implementación aún no puede declararse completa ni apta para publicar**:
no resolví el caso máximo manteniendo todas las validaciones de la lista embebida.
Me detuve antes de retirar controles o aceptar variantes sin validación.

La alternativa propuesta es guardar cada variante en:

    productos/{productoId}/variantes/{varianteId}

Así cada documento tendría su validación completa, sin validar diez mapas en
una misma escritura. La venta seguiría vinculada al producto, variante y recibo
mediante transacción y reglas recíprocas. Es una propuesta, todavía no implementada
ni validada: no se afirma que sus pruebas hayan pasado.

Para probar esa alternativa haría falta ampliar el permiso más allá de solo reglas:

- Adaptar inventarioTransacciones.js para leer/escribir la variante correspondiente.
- Adaptar productoService.js para cargar variantes desde la subcolección.
- Mantener el formato que recibe la interfaz mediante productoModelo.js.
- Actualizar reglas, fixtures y pruebas de concurrencia y falsificación.
- Mantener productos antiguos sin variantes, los IDs y las ventas históricas.

Esa ampliación requiere aprobación. No se hizo automáticamente.

## Archivos modificados en esta revisión

- firestore.rules
- web/tests/inventario.firebase.test.mjs
- docs/VARIANTES_STOCK_VENTAS.md

No publicar las reglas actuales. No ejecutar los comandos anteriores de despliegue
de Cloud Functions: no corresponden a Spark. No se ha autorizado ningún despliegue.
