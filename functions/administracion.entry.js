"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {
  crearAdministracion,
  ErrorAdministrativo,
} = require("./administracion");

exports.cambiarPasswordAdministrador = onCall(
    {region: "us-central1"},
    async (request) => {
      if (!admin.apps.length) admin.initializeApp();

      const servicio = crearAdministracion({
        auth: admin.auth(),
        db: admin.firestore(),
        fechaServidor: () => FieldValue.serverTimestamp(),
      });

      const cabecera =
        request.rawRequest.headers.authorization || "";
      const token = cabecera.startsWith("Bearer ") ?
        cabecera.slice(7) : "";

      try {
        return await servicio.cambiarPasswordAdministrador({
          token,
          datos: request.data,
        });
      } catch (fallo) {
        if (fallo instanceof ErrorAdministrativo) {
          throw new HttpsError(fallo.codigo, fallo.message, {
            operacionId: fallo.operacionId,
          });
        }

        throw new HttpsError(
            "internal",
            "No se pudo procesar la operación.",
        );
      }
    },
);
