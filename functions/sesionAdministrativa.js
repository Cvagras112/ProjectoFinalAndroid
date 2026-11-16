"use strict";

const {HttpsError} = require("firebase-functions/v2/https");

/**
 * Verificar revocación además de la validación JWT del middleware callable.
 * @param {object} auth Admin Auth.
 * @param {object} request Solicitud callable.
 * @return {Promise<string>} UID del token verificado.
 */
async function verificarSesionAdministrativa(auth, request) {
  const cabecera = request.rawRequest?.headers?.authorization;
  if (!request.auth?.uid || typeof cabecera !== "string" ||
      !cabecera.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  try {
    const identidad = await auth.verifyIdToken(cabecera.slice(7), true);
    if (identidad.uid !== request.auth.uid) throw new Error("UID distinto");
    return identidad.uid;
  } catch {
    throw new HttpsError("unauthenticated", "Sesión inválida o revocada.");
  }
}

module.exports = {verificarSesionAdministrativa};
