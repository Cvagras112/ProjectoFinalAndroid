"use strict";

const {createHash} = require("node:crypto");
const {ErrorAdministrativo} = require("./administracion");
const hash = (valor) => createHash("sha256").update(valor).digest("hex");
const fallo = (codigo, mensaje) => new ErrorAdministrativo(codigo, mensaje);
const idValido = (id) => typeof id === "string" && id.length > 0 &&
  Buffer.byteLength(id, "utf8") <= 1500 && !id.includes("/") &&
  ![".", ".."].includes(id) && !/^__.*__$/.test(id);

/**
 * Operaciones acotadas de etapa 2B, sin tocar altas ni Authentication.
 * @param {object} dependencias Auth, Firestore y timestamp del servidor.
 * @return {object} Cuatro operaciones explícitas.
 */
function crearOperacionesAsignacionesEmprendedoras({auth, db, fechaServidor}) {
  const auditoria = db.collection("auditoria_administrativa");
  const ejecutar = (tipo, campos, mutar) => async ({token, datos}) => {
    let actorUid = null;
    let elementoId = null;
    let operacionId = auditoria.doc().id;
    const elementoTipo = tipo.startsWith("asignacion.") ?
      "asignacion" : "emprendedora";
    let accion = tipo;
    let contenido;
    try {
      if (typeof token !== "string" || !token || token.length > 16384) {
        throw fallo("unauthenticated", "Debes iniciar sesión.");
      }
      try {
        actorUid = (await auth.verifyIdToken(token, true)).uid;
      } catch {
        throw fallo("unauthenticated", "Sesión inválida o revocada.");
      }
      const permitidos = ["solicitudId", "id", ...campos];
      if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
          Object.keys(datos).length !== permitidos.length ||
          Object.keys(datos).some((campo) => !permitidos.includes(campo)) ||
          typeof datos.solicitudId !== "string" ||
          !/^[a-zA-Z0-9_-]{8,128}$/.test(datos.solicitudId) ||
          !idValido(datos.id)) {
        throw fallo("invalid-argument", "Campos o identificadores inválidos.");
      }
      elementoId = datos.id;
      contenido = {id: elementoId};
      if (campos.includes("asociacionId")) {
        if (!idValido(datos.asociacionId)) {
          throw fallo("invalid-argument", "Asociación inválida.");
        }
        contenido.asociacionId = datos.asociacionId;
      }
      if (campos.includes("nombre")) {
        if (typeof datos.nombre !== "string" ||
            datos.nombre.trim().length < 3 ||
            datos.nombre.trim().length > 100 ||
            typeof datos.telefono !== "string" ||
            !/^(|[0-9]{9})$/.test(datos.telefono.trim())) {
          throw fallo("invalid-argument", "Nombre o teléfono inválido.");
        }
        contenido.nombre = datos.nombre.trim();
        contenido.telefono = datos.telefono.trim();
      }
      if (campos.includes("activo")) {
        if (typeof datos.activo !== "boolean") {
          throw fallo("invalid-argument", "Estado inválido.");
        }
        contenido.activo = datos.activo;
        accion = `emprendedora.${datos.activo ? "activar" : "desactivar"}`;
      }
      operacionId = hash(JSON.stringify([actorUid, tipo, datos.solicitudId]));
    } catch (error) {
      await auditoria.doc().create({fecha: fechaServidor(), actorUid, accion,
        elementoTipo, elementoId, resultado: "rechazado", operacionId});
      const seguro = error instanceof ErrorAdministrativo ? error :
        fallo("unavailable", "No se pudo verificar la operación.");
      seguro.operacionId = operacionId;
      throw seguro;
    }

    const huellaSolicitud = hash(JSON.stringify(contenido));
    try {
      return await db.runTransaction(async (tx) => {
        const actor = await tx.get(db.doc(`usuarios/${actorUid}`));
        if (!actor.exists || actor.data().rol !== "administrador" ||
            actor.data().activo !== true) {
          throw fallo("permission-denied",
              "Se requiere un administrador activo.");
        }
        const eventoRef = auditoria.doc(operacionId);
        const previo = await tx.get(eventoRef);
        if (previo.exists) {
          if (previo.data().huellaSolicitud !== huellaSolicitud) {
            throw fallo("already-exists",
                "La clave ya fue utilizada con otros datos.");
          }
          return {resultado: "exito", operacionId, elementoId};
        }
        const accionReal = await mutar(tx, contenido);
        tx.create(eventoRef, {fecha: fechaServidor(), actorUid,
          accion: accionReal || accion, elementoTipo, elementoId,
          resultado: "exito", operacionId, huellaSolicitud});
        return {resultado: "exito", operacionId, elementoId};
      });
    } catch (error) {
      if (error instanceof ErrorAdministrativo) {
        await auditoria.doc().create({fecha: fechaServidor(), actorUid, accion,
          elementoTipo, elementoId, resultado: "rechazado", operacionId});
        error.operacionId = operacionId;
        throw error;
      }
      throw new ErrorAdministrativo("unavailable",
          "Resultado no confirmado. Revisa la bitácora antes de repetir.",
          operacionId);
    }
  };

  const leerPerfil = async (tx, id) => {
    const usuarioRef = db.doc(`usuarios/${id}`);
    const perfilRef = db.doc(`emprendedores/${id}`);
    const usuario = await tx.get(usuarioRef);
    const perfil = await tx.get(perfilRef);
    if (!usuario.exists || usuario.data().rol !== "emprendedor" ||
        !perfil.exists) {
      throw fallo("failed-precondition",
          "La cuenta y el perfil deben corresponder a una emprendedora.");
    }
    return {usuarioRef, perfilRef, usuario, perfil};
  };

  return {
    guardarAsignacionAdministrativa: ejecutar("asignacion.guardar",
        ["asociacionId"], async (tx, datos) => {
          const {usuario, perfil} = await leerPerfil(tx, datos.id);
          const asociacion = await tx.get(
              db.doc(`asociaciones/${datos.asociacionId}`));
          const ref = db.doc(`asignaciones/${datos.id}`);
          const anterior = await tx.get(ref);
          if (usuario.data().activo !== true || perfil.data().activo !== true ||
              !asociacion.exists || asociacion.data().estado !== "Activa") {
            throw fallo("failed-precondition",
                "Selecciona una emprendedora y una asociación activas.");
          }
          if (anterior.exists &&
              anterior.data().asociacionId === datos.asociacionId &&
              anterior.data().emprendedoraId === datos.id) {
            throw fallo("failed-precondition", "La asignación ya existe.");
          }
          tx.set(ref, {emprendedoraId: datos.id,
            asociacionId: datos.asociacionId});
          return anterior.exists ? "asignacion.reemplazar" : "asignacion.crear";
        }),
    quitarAsignacionAdministrativa: ejecutar("asignacion.eliminar", [],
        async (tx, datos) => {
          const ref = db.doc(`asignaciones/${datos.id}`);
          const anterior = await tx.get(ref);
          if (!anterior.exists) {
            throw fallo("not-found", "La asignación ya no existe.");
          }
          // Conservar la posibilidad de desvincular asignaciones huérfanas.
          tx.delete(ref);
        }),
    editarPerfilEmprendedoraAdministrativa: ejecutar("emprendedora.editar",
        ["nombre", "telefono"], async (tx, datos) => {
          const {perfilRef, perfil} = await leerPerfil(tx, datos.id);
          if (perfil.data().nombre === datos.nombre &&
              perfil.data().telefono === datos.telefono) {
            throw fallo("failed-precondition", "No hay cambios que guardar.");
          }
          // Conservar el contrato: nombre y teléfono solo en el perfil.
          tx.update(perfilRef, {nombre: datos.nombre,
            telefono: datos.telefono});
        }),
    cambiarEstadoEmprendedoraAdministrativa: ejecutar("emprendedora.estado",
        ["activo"], async (tx, datos) => {
          const {usuarioRef, perfilRef, usuario, perfil} = await leerPerfil(
              tx, datos.id);
          if (usuario.data().activo === datos.activo &&
              perfil.data().activo === datos.activo) {
            throw fallo("failed-precondition",
                "La cuenta ya tiene ese estado.");
          }
          // No alterar tiendas, roles, nombres, correos ni inventario.
          tx.update(usuarioRef, {activo: datos.activo});
          tx.update(perfilRef, {activo: datos.activo});
        }),
  };
}

module.exports = {crearOperacionesAsignacionesEmprendedoras};
