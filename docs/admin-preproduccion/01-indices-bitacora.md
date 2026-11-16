# Propuesta de índices de Bitácora

Estado: propuesta sin desplegar ni conectar a firebase.json. Revisión: 15-11-2026.

## Consulta real

Fuente: web/src/repositories/admin/auditoriaRepository.js, consultarAuditoria.
Colección raíz auditoria_administrativa; no collectionGroup.

| Parte | Contrato actual |
|---|---|
| Acción | accion == texto recortado; opcional |
| Resultado | resultado == valor; opcional |
| Identificador | Igualdad exacta por uno de operacionId, actorUid, elementoId, destinatarioUid; opcional |
| Desde | fecha >= medianoche local de la fecha ingresada |
| Hasta | fecha < medianoche local del día siguiente |
| Orden | fecha DESC, documentId() DESC |
| Página | startAfter(DocumentSnapshot), limit(tamano + 1); 20 por defecto, 1–100 |

No hay búsqueda parcial por texto ni combinación de dos campos identificadores.
Hay 20 formas de igualdad: cuatro combinaciones de acción/resultado por cinco
alternativas de identificador (ninguno o uno de los cuatro campos). Cada una puede
llevar cuatro combinaciones de fechas: ninguna, desde, hasta o ambas (80 formas
de filtros). Las fechas no requieren agregar otro campo al índice.

## Propuesta concreta

firestore.indexes.propuesta.json contiene 19 índices compuestos candidatos.
Es una cobertura explícita conservadora, NO una afirmación de mínimo necesario.
No se requiere compuesto nuevo para la consulta sin igualdades, suponiendo que
el índice automático descendente de fecha no esté exento en la base destino.

| Familia | Igualdades ASC | Sufijo | Cantidad |
|---|---|---|---:|
| Sin identificador | accion; resultado; accion + resultado | fecha DESC, __name__ DESC | 3 |
| Con identificador I | I; accion + I; resultado + I; accion + resultado + I | fecha DESC, __name__ DESC | 4 por I = 16 |

El orden de las igualdades está fijado en el JSON para revisión reproducible.
__name__ DESC explicita el desempate del repositorio; coincide con el sentido
predeterminado del último campo de ordenación, fecha DESC.

Firestore puede combinar índices para filtros de igualdad: antes de desplegar
se debe evaluar si bastan los seis compuestos básicos (accion, resultado y cada
identificador, seguidos de fecha DESC). No aprobar los 19 por defecto: generan
almacenamiento y mantenimiento de índices adicionales. No eliminar índices
existentes de otras colecciones al integrar esta propuesta.

## Compatibilidad y limitaciones

- Los eventos antiguos de contraseña se buscan por destinatarioUid. La adaptación
  visual a elementoId ocurre después de consultar: buscar elementoId no encuentra
  eventos antiguos que carecen de ese campo. No modificar históricos.
- orderBy(fecha) excluye documentos sin fecha; un índice no corrige ese problema.
- Probar fechas límite con zona America/Santiago y horario de verano. Hoy la
  interpretación depende de la zona del navegador, no de una zona de negocio fija.
- La paginación es por cursor, no una instantánea congelada. Nuevos eventos pueden
  aparecer al refrescar la primera página; no prometer un total fijo.
- El emulador no exige compuestos: aprobar consultas allí no prueba disponibilidad
  de índices en un proyecto remoto. No se consultó producción.

## Criterio de cierre

1. Revisar las 80 formas de filtros y paginación con fechas iguales.
2. Comprobar equivalencia de resultados, búsquedas históricas y límites de fecha.
3. Revisar índices y exenciones reales en un entorno de preproducción autorizado.
4. Validar mínimo de índices, estado READY y ausencia de failed-precondition.
5. Solo después de aprobación, preparar un archivo de índices definitivo y su
   referencia en firebase.json; su publicación queda fuera de esta preparación.

Fuentes oficiales:
- https://firebase.google.com/docs/firestore/query-data/index-overview
- https://firebase.google.com/docs/emulator-suite/connect_firestore
