"use strict";

const ACCION = "administrador.cambiar_password";

/** Error público sin payloads sensibles. */
class ErrorAdministrativo extends Error {
  /**
   * @param {string} codigo Código público.
   * @param {string} mensaje Mensaje público.
   * @param {?string} operacionId Identificador de correlación.
   */
  constructor(codigo, mensaje, operacionId = null) {
    super(mensaje);
    this.codigo = codigo;
    this.operacionId = operacionId;
  }
}

// Dependencias inyectadas: sin configuración, credenciales ni transporte HTTP.
/**
 * @param {object} dependencias Auth, Firestore, fecha y reloj.
 * @return {object} Servicio de cambio de contraseña.
 */
function crearAdministracion({auth, db, fechaServidor, ahora = Date.now}) {
  const eventos = db.collection("auditoria_administrativa");
  const error = (codigo, mensaje, id) =>
    new ErrorAdministrativo(codigo, mensaje, id);

  /**
   * @param {object} solicitud Token y datos de la operación.
   * @return {Promise<object>} Resultado confirmado.
   */
  async function cambiarPasswordAdministrador({token, datos}) {
    const operacionId = eventos.doc().id;
    let actorUid = null;
    let destinatarioUid = null;
    const registrar = (fase, resultado) => eventos.doc().create({
      operacionId,
      actorUid,
      accion: ACCION,
      destinatarioUid,
      fecha: fechaServidor(),
      fase,
      resultado,
    });

    try {
      if (typeof token !== "string" || !token || token.length > 16384) {
        throw error("unauthenticated", "Debes iniciar sesión.");
      }
      let identidad;
      try {
        identidad = await auth.verifyIdToken(token, true);
      } catch {
        throw error("unauthenticated", "Sesión inválida o revocada.");
      }
      actorUid = identidad.uid;
      if (!Number.isFinite(identidad.auth_time) ||
          ahora() / 1000 - identidad.auth_time > 300 ||
          identidad.auth_time > ahora() / 1000 + 30) {
        throw error("failed-precondition",
            "Vuelve a autenticarte para continuar.");
      }
      if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
          Object.keys(datos).some((k) => !["uid", "password"].includes(k)) ||
          typeof datos.uid !== "string" || !datos.uid ||
          datos.uid.length > 128 || datos.uid.includes("/")) {
        throw error("invalid-argument", "Solicitud inválida.");
      }
      destinatarioUid = datos.uid;
      if (actorUid === destinatarioUid) {
        throw error("permission-denied",
            "No puedes cambiar tu propia contraseña mediante esta operación.");
      }
      // No recortar la contraseña: los espacios pueden formar parte de ella.
      if (typeof datos.password !== "string" ||
          datos.password.length < 8 || datos.password.length > 128 ||
          !datos.password.trim()) {
        throw error("invalid-argument",
            "La contraseña debe tener entre 8 y 128 caracteres " +
            "y no estar vacía.");
      }
      const actorRef = db.collection("usuarios").doc(actorUid);
      const destinoRef = db.collection("usuarios").doc(destinatarioUid);
      // Releer permisos en servidor; nunca aceptar un rol del cliente.
      await db.runTransaction(async (tx) => {
        const actor = await tx.get(actorRef);
        const destino = await tx.get(destinoRef);
        if (!actor.exists || actor.data().rol !== "administrador" ||
            actor.data().activo !== true) {
          throw error("permission-denied",
              "Se requiere un administrador activo.");
        }
        if (!destino.exists || destino.data().rol !== "administrador") {
          throw error("failed-precondition",
              "El destinatario debe ser administrador.");
        }
      });
      try {
        await auth.getUser(destinatarioUid);
      } catch {
        throw error("failed-precondition",
            "No se pudo comprobar la cuenta destinataria.");
      }
    } catch (fallo) {
      // Intentos rechazados: solo identidad verificada y metadatos permitidos.
      try {
        await registrar("intento", "rechazado");
      } catch {
        throw error("unavailable", "No se pudo registrar el intento.",
            operacionId);
      }
      throw error(fallo.codigo || "unavailable",
          fallo instanceof ErrorAdministrativo ? fallo.message :
            "No se pudo verificar la operación.", operacionId);
    }

    try {
      await registrar("intento", "iniciado");
    } catch (falloAuditoria) {
      if (process.env.FUNCTIONS_EMULATOR === "true") {
        console.error("[DIAGNOSTICO AUDITORIA]", falloAuditoria.code,
            falloAuditoria.message);
      }
      // Sin evento inicial durable, no ejecutar la mutación de Authentication.
      throw error("unavailable",
          "No se pudo registrar el intento; no se ejecutó el cambio.",
          operacionId);
    }

    let resultado = "incierto";
    try {
      await auth.updateUser(destinatarioUid, {password: datos.password});
      resultado = "password_cambiada_revocacion_pendiente";
      await auth.revokeRefreshTokens(destinatarioUid);
      resultado = "exito";
    } catch {
      // Incluso un timeout puede ocurrir después de aplicar el cambio remoto.
      // Nunca reenviar errores del SDK ni reintentar una contraseña a ciegas.
    }
    try {
      await registrar("resultado", resultado);
    } catch {
      throw error("unavailable", "Resultado no confirmado en auditoría. " +
          "No repitas automáticamente la operación.", operacionId);
    }
    if (resultado !== "exito") {
      throw error("unavailable", "Resultado incierto. " +
          "Requiere revisión; no reintentar automáticamente.", operacionId);
    }
    return {operacionId, resultado: "exito"};
  }

  return {cambiarPasswordAdministrador};
}

module.exports = {crearAdministracion, ErrorAdministrativo};
