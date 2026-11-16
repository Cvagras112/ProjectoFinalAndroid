"use strict";

/**
 * @param {string} codigo Código público.
 * @param {string} mensaje Mensaje público.
 * @return {Error} Error controlado.
 */
function error(codigo, mensaje) {
  return Object.assign(new Error(mensaje), {codigo});
}

/**
 * @param {object} dependencias Firestore, Auth y fecha del servidor.
 * @return {object} Servicio de creación.
 */
function crearServicioCreacionAdministrador({
  db,
  authAdmin,
  fechaServidor,
}) {
  /**
   * @param {object} solicitud Actor verificado y datos permitidos.
   * @return {Promise<object>} Resultado confirmado.
   */
  async function ejecutar({actorUid, datos}) {
    if (!actorUid) {
      throw error("unauthenticated", "Inicia sesion.");
    }

    if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
        Object.keys(datos).length !== 3 ||
        Object.keys(datos).some((campo) =>
          !["nombre", "email", "password"].includes(campo))) {
      throw error("invalid-argument", "Campos invalidos.");
    }
    const nombre = typeof datos.nombre === "string" ?
      datos.nombre.trim() : null;
    const email = typeof datos.email === "string" ?
      datos.email.trim().toLowerCase() : null;
    const password = datos?.password;

    if (
      typeof nombre !== "string" ||
      nombre.length < 1 ||
      nombre.length > 150 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128 ||
      !password.trim()
    ) {
      throw error("invalid-argument", "Datos invalidos.");
    }

    const actorRef = db.collection("usuarios").doc(actorUid);
    const actor = await actorRef.get();

    if (
      !actor.exists ||
      actor.data().rol !== "administrador" ||
      actor.data().activo !== true
    ) {
      throw error(
          "permission-denied",
          "Se requiere un administrador activo.",
      );
    }

    let usuario = null;

    try {
      usuario = await authAdmin.createUser({
        email,
        password,
        displayName: nombre,
        disabled: false,
      });

      const usuarioRef = db.collection("usuarios").doc(usuario.uid);
      const eventoRef = db.collection("auditoria_administrativa").doc();

      await db.runTransaction(async (tx) => {
        const actorActual = await tx.get(actorRef);

        if (
          !actorActual.exists ||
          actorActual.data().rol !== "administrador" ||
          actorActual.data().activo !== true
        ) {
          throw error(
              "permission-denied",
              "El administrador ya no tiene permisos.",
          );
        }

        tx.create(usuarioRef, {
          ID: usuario.uid,
          nombre,
          email,
          rol: "administrador",
          activo: true,
        });

        tx.create(eventoRef, {
          operacionId: eventoRef.id,
          actorUid,
          accion: "administrador.crear",
          destinatarioUid: usuario.uid,
          elementoTipo: "administrador",
          elementoId: usuario.uid,
          fecha: fechaServidor(),
          fase: "resultado",
          resultado: "exito",
        });
      });

      return {
        resultado: "exito",
        uid: usuario.uid,
        operacionId: eventoRef.id,
      };
    } catch (err) {
      if (usuario) {
        let perfilExiste;

        try {
          const perfil = await db
              .collection("usuarios")
              .doc(usuario.uid)
              .get();

          perfilExiste = perfil.exists;
        } catch (_) {
          throw error(
              "internal",
              "Resultado incierto. Revisar Authentication y Firestore " +
              "antes de reintentar.",
          );
        }

        if (perfilExiste) {
          throw error(
              "internal",
              "La cuenta puede haberse creado. Revisar la Bitacora " +
              "antes de reintentar.",
          );
        }

        try {
          await authAdmin.deleteUser(usuario.uid);
        } catch (_) {
          throw error(
              "internal",
              "No se pudo confirmar la limpieza. Revisar antes de reintentar.",
          );
        }
      }

      throw err;
    }
  }

  return {ejecutar};
}

module.exports = {crearServicioCreacionAdministrador};
