"use strict";

/**
 * Crea el servicio de operaciones administrativas auditadas.
 * @param {Object} opciones Dependencias de Firestore y fecha.
 * @return {Object} Servicio con operaciones administrativas.
 */
function crearAdministradoresAuditados({db, fechaServidor}) {
  /**
   * Ejecuta una modificación administrativa con auditoría atómica.
   * @param {Object} solicitud Datos de la operación.
   * @return {Promise<Object>} Resultado y código de operación.
   */
  async function ejecutar({actorUid, accion, datos}) {
    /**
     * Genera un error administrativo controlado.
     * @param {string} codigo Código del error.
     * @param {string} mensaje Descripción del error.
     */
    function rechazar(codigo, mensaje) {
      throw Object.assign(new Error(mensaje), {codigo});
    }

    if (typeof actorUid !== "string" || !actorUid) {
      rechazar("unauthenticated", "Inicia sesión.");
    }

    const accionesPermitidas = ["editar", "activar", "desactivar"];

    if (!accionesPermitidas.includes(accion)) {
      rechazar("invalid-argument", "Acción inválida.");
    }

    const campos = accion === "editar" ?
      ["uid", "nombre"] : ["uid"];
    if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
        (datos.accion !== undefined && datos.accion !== accion) ||
        campos.some((campo) => !Object.hasOwn(datos, campo)) ||
        Object.keys(datos).some((campo) =>
          campo !== "accion" && !campos.includes(campo))) {
      rechazar("invalid-argument", "Campos de solicitud inválidos.");
    }

    const uid = datos?.uid;

    if (
      typeof uid !== "string" ||
      !uid ||
      uid.length > 128 ||
      uid.includes("/") ||
      uid === actorUid
    ) {
      rechazar(
          "invalid-argument",
          "Administrador destinatario inválido.",
      );
    }

    let nombre;

    if (accion === "editar") {
      const nombreRecibido = datos?.nombre;

      if (
        typeof nombreRecibido !== "string" ||
        !nombreRecibido.trim() ||
        nombreRecibido.trim().length > 150
      ) {
        rechazar("invalid-argument", "Nombre inválido.");
      }

      nombre = nombreRecibido.trim();
    }

    const actorRef = db.collection("usuarios").doc(actorUid);
    const destinoRef = db.collection("usuarios").doc(uid);
    const eventoRef = db.collection("auditoria_administrativa").doc();

    const resultado = await db.runTransaction(async (tx) => {
      const actor = await tx.get(actorRef);
      const destino = await tx.get(destinoRef);

      if (
        !actor.exists ||
        actor.data().rol !== "administrador" ||
        actor.data().activo !== true
      ) {
        rechazar(
            "permission-denied",
            "Se requiere un administrador activo.",
        );
      }

      if (
        !destino.exists ||
        destino.data().rol !== "administrador"
      ) {
        rechazar(
            "failed-precondition",
            "Administrador destinatario no encontrado.",
        );
      }

      const actual = destino.data();

      const cambios = accion === "editar" ?
        {nombre} : {activo: accion === "activar"};

      const campo = accion === "editar" ? "nombre" : "activo";

      if (actual[campo] === cambios[campo]) {
        rechazar(
            "failed-precondition",
            "No hay cambios que guardar.",
        );
      }

      tx.update(destinoRef, cambios);

      tx.create(eventoRef, {
        operacionId: eventoRef.id,
        actorUid,
        accion: `administrador.${accion}`,
        destinatarioUid: uid,
        elementoTipo: "administrador",
        elementoId: uid,
        fecha: fechaServidor(),
        fase: "resultado",
        resultado: "exito",
      });

      return {
        resultado: "exito",
        operacionId: eventoRef.id,
      };
    });

    return resultado;
  }

  return {ejecutar};
}

module.exports = {crearAdministradoresAuditados};
