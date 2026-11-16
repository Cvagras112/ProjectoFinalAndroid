# Procedimiento visual y propuesta de fixtures

Estado: procedimiento preparado; NO se crearon ni modificaron datos en esta fase.
La prueba será exclusivamente local, proyecto demo-bora-admin.

## Preflight obligatorio

1. Confirmar rama feature/web-david-final y conservar staging y cambios locales.
2. Consultar el Hub local: Auth 9099, Firestore 8087, Functions 5001, región us-central1.
   Comprobar proyecto demo-bora-admin y entrada functions/tests/admin-emulator/index.js.
3. Verificar carga de firestore.rules actual y manifest de endpoints administrativos.
4. Vite debe servir admin-emulator con VITE_ADMIN_EMULATOR=true; comprobar en navegador
   app.options.projectId y conexiones de Auth principal/secundario, Firestore y Functions.
5. Inspeccionar las solicitudes de red: las operaciones Firebase deben ir solo a los
   hosts locales esperados; detenerse ante cualquier endpoint Firebase remoto.
6. No iniciar otra suite en los mismos puertos. Usar Ctrl+C en la terminal propietaria
   si se autoriza reiniciar, nunca terminar procesos por nombre.

Comandos de arranque, únicamente si los servicios no están ya iniciados:

```powershell
# Terminal 1, raíz del repositorio; ejecutar la CLI Firebase instalada:
firebase.cmd emulators:start --project demo-bora-admin --config firebase.admin.test.json --only auth,firestore,functions
# Terminal 2, desde web:
npm.cmd run dev -- --mode admin-emulator
```

## Fixtures propuestos

Usar un sufijo de ejecución qa-cierre-<id> y dominios example.test. Las contraseñas
ficticias de acceso se entregan localmente al operador, nunca en bitácora/capturas.

| Fixture | Documentos/servicio | Condición |
|---|---|---|
| Admin actor | Auth + usuarios con ID, nombre, email, rol administrador, activo true | Sesión reciente para contraseña |
| Admin destino | Crear desde panel, no insertar un éxito de auditoría manualmente | Diferente del actor |
| Admin inactivo y cuenta no admin | Auth + perfil coherente | Solo pruebas de permisos autorizadas |
| Emprendedora ficticia | usuarios/uid, emprendedores/uid, tiendas/uid | Los tres activos; ID_Tienda=uid; ID_Dueno=uid; sin cuenta Auth |
| Asociaciones A y B | asociaciones con nombre, estado Activa y campos del esquema | Sin asignación inicial |
| Categoría y tipos | Crear desde panel con nombres QA únicos | Operaciones reales auditadas |
| Volumen de Bitácora | Más de 20 eventos generados por operaciones QA | No insertar eventos fingidos de éxito |

Reutilizable: functions/tests/preparar-visual-2b.js. Ya define
qa2b-visual-emprendedora, asociaciones qa2b-visual-asociacion-a/b y cinco documentos.
Exige variables locales, argumento de proyecto, comprobación del Hub y rechaza
conflictos/asignación previa. No usa Auth. Antes de ejecutarlo, inventariar sus
documentos: si ya fueron editados durante una prueba, NO reiniciarlos ni borrar
asignaciones. Pedir un nuevo namespace de fixtures para la siguiente ejecución.
El script no cubre las cuentas Auth actor/inactivo/no admin: requieren preparación
independiente autorizada, idempotente y sin cambiar contraseñas existentes.

Variables requeridas por el script, si luego se autoriza su ejecución:

```powershell
$env:GCLOUD_PROJECT='demo-bora-admin'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8087'
$env:FUNCTIONS_EMULATOR_HOST='127.0.0.1:5001'
$env:FIREBASE_EMULATOR_HUB='127.0.0.1:4400'
# Solo tras revisar fixtures existentes:
node functions/tests/preparar-visual-2b.js --project demo-bora-admin
```

## Secuencia y evidencia

| Caso | Resultado comprobable |
|---|---|
| Entrar y navegar a Emprendedoras | Fixture visible tras recarga y cambio de sección; sin errores de permisos |
| Crear, editar, desactivar/reactivar categoría, tipo producto, tipo emprendimiento y asociación | Acciones <elemento>.crear, .editar, .desactivar, .activar; elemento categoria/tipo_producto/tipo_emprendimiento/asociacion |
| Asignar A, cambiar a B con confirmación, eliminar | asignacion.crear, asignacion.reemplazar, asignacion.eliminar; sin borrado intermedio |
| Editar nombre/teléfono, desactivar y reactivar emprendedora | emprendedora.editar, .desactivar, .activar; dos perfiles sincronizados, tienda intacta |
| Crear/editar/desactivar/reactivar administrador | administrador.crear, .editar, .desactivar, .activar; sesión del actor conservada |
| Contraseña de otro admin | administrador.cambiar_password: intento y resultado con igual operacionId; login nuevo en otro contexto de navegador |
| Cuenta propia | Acciones protegidas deshabilitadas y backend rechaza solicitud manipulada |
| Bitácora | Filtros por acción/resultado/fecha, búsqueda exacta por cada identificador, siguiente/anterior y más de 20 eventos |
| Datos históricos | destinatarioUid visible como elemento; buscar por campo histórico; no modificar documentos |
| Red cortada/doble clic | Sin éxito inventado ni reintento automático; advertencia e ID si está disponible |
| Roles y sesión | Visitante, emprendedor, admin inactivo y sesión expirada sin acceso |
| Accesibilidad | Teclado, etiquetas, foco, mensajes de carga/error/vacío, escritorio y 390 px |

Solicitudes, alta de emprendedoras, inventario y ventas no se ejecutan manualmente
en esta ronda sin coordinación: usar su evidencia automatizada y plan separado.
No abrir flujos de solicitudes conectados a servicios externos.

Ficha por caso: ID, build/revisión local, hora/zona, fixture, pasos, esperado,
obtenido, operacionId, IDs de eventos y captura sanitizada. No exportar HAR sin
eliminar cabeceras Authorization y cuerpos con contraseñas. No contar un error
de índice como error de permisos. Pruebas de fallo/atomicidad destructivas quedan
en suites automatizadas de proyectos demo separados.

Cierre: todos los casos aplicables documentados, sin conexiones reales, sin
regresiones de navegación, sin datos sensibles y sin borrar evidencia de prueba.
