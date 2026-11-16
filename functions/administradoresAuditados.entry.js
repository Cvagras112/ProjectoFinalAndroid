"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {verificarSesionAdministrativa} = require("./sesionAdministrativa");
const {
  crearAdministradoresAuditados,
} = require("./administradoresAuditados");

exports.operarAdministradorAuditado = onCall(
    {region: "us-central1"},
    async (request) => {
      if (!admin.apps.length) admin.initializeApp();
      const actorUid = await verificarSesionAdministrativa(
          admin.auth(), request,
      );

      try {
        const servicio = crearAdministradoresAuditados({
          db: admin.firestore(),
          fechaServidor: () => FieldValue.serverTimestamp(),
        });

        return await servicio.ejecutar({
          actorUid,
          accion: request.data?.accion,
          datos: request.data,
        });
      } catch (err) {
        const validos = [
          "unauthenticated",
          "invalid-argument",
          "permission-denied",
          "failed-precondition",
        ];

        const codigo = validos.includes(err.codigo) ?
          err.codigo : "internal";

        const mensaje = codigo === "internal" ?
          "No se pudo completar la operación." : err.message;

        throw new HttpsError(codigo, mensaje);
      }
    },
);
