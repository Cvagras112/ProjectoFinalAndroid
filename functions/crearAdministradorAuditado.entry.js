"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {verificarSesionAdministrativa} = require("./sesionAdministrativa");

const {
  crearServicioCreacionAdministrador,
} = require("./crearAdministradorAuditado");

exports.crearAdministradorConAuditoria = onCall(
    {region: "us-central1"},
    async (request) => {
      if (
        process.env.GCLOUD_PROJECT !== "demo-bora-admin" ||
        !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
        !process.env.FIRESTORE_EMULATOR_HOST
      ) {
        throw new HttpsError(
            "failed-precondition",
            "Disponible solo en el emulador administrativo.",
        );
      }

      if (!request.auth?.uid) {
        throw new HttpsError(
            "unauthenticated",
            "Debes iniciar sesión.",
        );
      }

      if (!admin.apps.length) admin.initializeApp();
      const actorUid = await verificarSesionAdministrativa(
          admin.auth(), request,
      );

      try {
        const servicio = crearServicioCreacionAdministrador({
          db: admin.firestore(),
          authAdmin: admin.auth(),
          fechaServidor: () => FieldValue.serverTimestamp(),
        });

        return await servicio.ejecutar({
          actorUid,
          datos: request.data,
        });
      } catch (err) {
        const permitidos = [
          "unauthenticated",
          "invalid-argument",
          "permission-denied",
          "failed-precondition",
        ];

        const codigo = permitidos.includes(err.codigo) ?
          err.codigo : "internal";

        const mensaje = codigo === "internal" ?
          "No se pudo confirmar la creación. " +
          "Revisa las cuentas antes de reintentar." :
          err.message;

        throw new HttpsError(codigo, mensaje);
      }
    },
);
