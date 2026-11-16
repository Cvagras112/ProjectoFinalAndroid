"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {ErrorAdministrativo} = require("./administracion");
const {crearOperacionesAsignacionesEmprendedoras} =
  require("./asignacionesEmprendedoras");

for (const nombre of ["guardarAsignacionAdministrativa",
  "quitarAsignacionAdministrativa", "editarPerfilEmprendedoraAdministrativa",
  "cambiarEstadoEmprendedoraAdministrativa"]) {
  exports[nombre] = onCall({region: "us-central1"}, async (request) => {
    if (!admin.apps.length) admin.initializeApp();
    const operaciones = crearOperacionesAsignacionesEmprendedoras({
      auth: admin.auth(), db: admin.firestore(),
      fechaServidor: () => FieldValue.serverTimestamp(),
    });
    const cabecera = request.rawRequest.headers.authorization || "";
    try {
      return await operaciones[nombre]({
        token: cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "",
        datos: request.data,
      });
    } catch (error) {
      if (error instanceof ErrorAdministrativo) {
        throw new HttpsError(error.codigo, error.message,
            {operacionId: error.operacionId});
      }
      throw new HttpsError("unavailable", "No se pudo confirmar la operación.");
    }
  });
}
