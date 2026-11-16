# Matriz y diseño de habilitación administrativa

Estado: diseño para revisión; ninguna operación productiva habilitada.

## Matriz del contrato de seguridad

Todas las mutaciones requieren token verificado con revocación, UID obtenido del
token, perfil administrador activo leído en backend, campos permitidos y ausencia
de contraseñas/tokens en respuestas, eventos y diagnósticos.

| Operación | Estado actual | Requisito antes de producción |
|---|---|---|
| Leer Bitácora | Cliente Firestore; reglas para admin activo; escritura cliente prohibida | Índices revisados; lectura denegada a inactivo, emprendedor y visitante |
| 12 callables de catálogos | Sesión verificada, permiso transaccional, auditoría y solicitudId | Mantener atomicidad/deduplicación; verificar no escritura directa equivalente |
| Crear/reemplazar/eliminar asignación | 2B auditado, transaccional, solicitudId | Una sola asignación coherente; no eliminar antes de reemplazar |
| Editar nombre/teléfono de emprendedora | 2B auditado, campos cerrados | Preservar alta, solicitudes y datos de tienda |
| Activar/desactivar emprendedora | Actualiza usuarios y emprendedores junto a auditoría | Validar sincronización, permisos y ausencia de cambios en tienda |
| Crear administrador | Auth + transacción perfil/auditoría; compensación de cuenta Auth; guardia backend solo demo | No hay transacción entre Auth y Firestore: revisar reconciliación, idempotencia y resultado incierto |
| Editar/activar/desactivar administrador | Token con revocación; transacción; no propia cuenta | Agregar contrato de deduplicación/reconsulta de operación; probar respuestas perdidas |
| Cambiar contraseña de otro administrador | auth_time máximo 300 s, tolerancia futura 30 s; intento y resultado; revoca sesiones | No reintentar automáticamente; gestionar resultado parcial y recuperación manual; no prometer atomicidad Auth/Firestore |
| Alta de emprendedoras, solicitudes, compradores y otros módulos | Fuera de esta habilitación | Conservar permisos; no afirmar auditoría general completa |

El frontend de los cuatro servicios administrativos solo admite admin-emulator.
Esto NO protege los endpoints si se exportan/despliegan: cada backend debe cumplir
la matriz por sí mismo. Las entradas de catálogos y 2B no tienen una barrera de
entorno equivalente a la de creación de administradores.

## Diseño propuesto

1. Mantener config.js y las guardias del modo demo sin cambios hasta aprobar diseño.
2. Definir tres entornos explícitos: demo local, preproducción y producción. Para
   remoto, exigir proyecto esperado y bandera de servidor desactivada por defecto.
   Rechazar configuración desconocida o mezcla de emuladores y proyecto real.
3. Centralizar selección del entorno administrativo, conservando contratos de los
   cuatro servicios frontend. Un flag VITE solo controla UX; no autoriza backend.
4. Backend valida proyecto y habilitación propia además de identidad/rol. Evaluar
   deshabilitación por operación; documentar cómo se restaura sin reabrir escrituras
   directas. No retirar guardias demo mediante un reemplazo indiscriminado.
5. App Check web con enforcement en callables, proveedor real aprobado para remoto
   y configuración debug exclusivamente local. Evaluar protección de replay para
   contraseña; no sustituye autorización ni idempotencia de negocio.
6. Revisar cuenta de servicio, permisos mínimos Auth/Firestore, región us-central1,
   máximos de instancias, latencia, coste y monitorización sin payloads sensibles.
   Los callables requieren autenticación Firebase en aplicación; revisar IAM para
   no impedir invocación legítima desde navegador.
7. Mantener transacciones y comprobación de rol dentro de la operación. Documentar
   la ventana entre autorización y cambio Auth, que no comparte transacción con
   Firestore, y el procedimiento ante revocación/desactivación concurrente.
8. Crear manifest de endpoints aprobados. La entrada principal hoy exporta los tres
   grupos de administradores, no catálogos/2B. Integrar exports y empaquetado solo
   con permiso posterior para functions/index.js/configuración; no importar la
   entrada de tests como entrada productiva. Mantener dependencias dentro de la
   fuente desplegable. Revisar exclusión de scripts QA y respaldos del paquete sin
   eliminarlos del workspace.
9. Mantener reglas restrictivas: el rollback no puede consistir en restaurar
   escrituras directas no auditadas. Revisar reglas reales antes del despliegue,
   preservando los flujos compartidos. No se consultaron ni cambiaron reglas remotas.

## Pruebas y puerta de aprobación

- Reejecutar la base de 194 comprobaciones y ampliar HTTP real a todos los endpoints.
- Actor activo/inactivo, usuario no admin, sin perfil, sin sesión, token revocado,
  expirado, suplantación de actor/rol y campos protegidos.
- App Check ausente/inválido, doble envío, reutilización de solicitudId con otro
  contenido, concurrencia, auditoría fallida y respuesta perdida tras confirmación.
- Cambios de contraseña con sesión antigua, fallo Auth, fallo de revocación y fallo
  de auditoría; ningún resultado incierto debe mostrarse como éxito.
- Creación Auth seguida de fallo Firestore, compensación fallida y confirmación
  incierta: no borrar una cuenta cuyo perfil/auditoría ya se confirmó.
- Verificar que el flag de servidor deshabilita operaciones incluso con cliente
  manipulado; no depender de ocultar botones.
- Verificar lecturas y escrituras de registro, tiendas, inventario/ventas y W23.

Después de revisión: pruebas remotas solo en preproducción y con autorización
específica. Blaze es requisito del despliegue de Functions; no se verificó el plan
real. Node 24 local no acredita por sí solo la compatibilidad de la CLI y del
runtime elegido: revisar versiones efectivas antes de publicar.

Archivos candidatos futuros: web/src/firebase/config.js; web/src/services/admin/*;
entradas y núcleos administrativos en functions/; functions/sesionAdministrativa.js;
functions/index.js y firebase.json solo con aprobación; reglas solo si revisión
demuestra necesidad y con alcance aprobado. No cambiar servicios compartidos ahora.

Fuentes oficiales:
- https://firebase.google.com/docs/functions/get-started
- https://firebase.google.com/docs/app-check/cloud-functions
- https://docs.cloud.google.com/functions/docs/runtime-support
