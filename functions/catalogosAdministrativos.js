"use strict";

const {createHash} = require("node:crypto");
const {ErrorAdministrativo} = require("./administracion");

const TIPOS = Object.freeze({
  Categoria: ["categorias", "categoria"],
  TipoProducto: ["tipos_productos", "tipo_producto"],
  TipoEmprendimiento: ["tipos_emprendimiento", "tipo_emprendimiento"],
  Asociacion: ["asociaciones", "asociacion"],
});
const CAMPOS_ASOCIACION = [
  "nombre", "descripcion", "sector", "contacto", "logo",
];
const hash = (valor) => createHash("sha256").update(valor).digest("hex");
const normalizar = (valor) => valor.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
const fallo = (codigo, mensaje) => new ErrorAdministrativo(codigo, mensaje);
const idValido = (id) => typeof id === "string" &&
  /^[a-zA-Z0-9_-]{8,128}$/.test(id);

/**
 * Construye exclusivamente las doce operaciones autorizadas.
 * @param {object} dependencias Auth, Firestore y timestamp del servidor.
 * @return {object} Operaciones permitidas.
 */
function crearOperacionesCatalogos({auth, db, fechaServidor}) {
  const auditoria = db.collection("auditoria_administrativa");

  const construir = (tipo, modo) => async ({token, datos}) => {
    const [coleccion, elementoTipo] = TIPOS[tipo];
    let actorUid = null;
    let elementoId = null;
    let operacionId = auditoria.doc().id;
    let accion = `${elementoTipo}.${modo}`;
    let contenido;
    let huellaSolicitud;
    let referencia;

    try {
      if (typeof token !== "string" || !token || token.length > 16384) {
        throw fallo("unauthenticated", "Debes iniciar sesión.");
      }
      try {
        actorUid = (await auth.verifyIdToken(token, true)).uid;
      } catch {
        throw fallo("unauthenticated", "Sesión inválida o revocada.");
      }
      const campos = modo === "cambiar_estado" ? ["estado"] :
        tipo === "Asociacion" ? CAMPOS_ASOCIACION : ["nombre"];
      const permitidos = ["solicitudId", ...campos,
        ...(modo === "crear" ? [] : ["id"])];
      if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
          Object.keys(datos).length !== permitidos.length ||
          Object.keys(datos).some((campo) => !permitidos.includes(campo)) ||
          !idValido(datos.solicitudId)) {
        throw fallo("invalid-argument", "Campos de solicitud inválidos.");
      }
      if (modo !== "crear") {
        if (typeof datos.id !== "string" || !datos.id ||
            datos.id.length > 1500 || datos.id.includes("/") ||
            [".", ".."].includes(datos.id)) {
          throw fallo("invalid-argument", "Identificador inválido.");
        }
        elementoId = datos.id;
      }
      contenido = {};
      if (modo === "cambiar_estado") {
        if (!["Activa", "Inactiva"].includes(datos.estado)) {
          throw fallo("invalid-argument", "Estado inválido.");
        }
        contenido.estado = datos.estado;
        accion = `${elementoTipo}.${datos.estado === "Activa" ?
          "activar" : "desactivar"}`;
      } else {
        for (const campo of campos) {
          const maximo = {nombre: 100, descripcion: 500, sector: 150,
            contacto: 200, logo: 2000}[campo];
          if (typeof datos[campo] !== "string" ||
              datos[campo].trim().length > maximo ||
              (campo === "nombre" && datos[campo].trim().length < 3)) {
            throw fallo("invalid-argument",
                "Datos inválidos o demasiado largos.");
          }
          contenido[campo] = datos[campo].trim();
        }
        if (contenido.logo) {
          try {
            const url = new URL(contenido.logo);
            if (!["http:", "https:"].includes(url.protocol)) throw Error();
          } catch {
            throw fallo("invalid-argument",
                "El logo debe ser una URL HTTP o HTTPS.");
          }
        }
        if (modo === "crear") contenido.estado = "Activa";
      }
      // Identidad de operación calculada en servidor. La clave del cliente es
      // solo de deduplicación: nunca determina permisos, colección ni actor.
      operacionId = hash(JSON.stringify(
          [actorUid, tipo, modo, datos.solicitudId]));
      huellaSolicitud = hash(JSON.stringify([elementoId, contenido]));
      referencia = modo === "crear" ? db.collection(coleccion).doc() :
        db.collection(coleccion).doc(elementoId);
      elementoId = referencia.id;
    } catch (error) {
      await auditoria.doc().create({fecha: fechaServidor(), actorUid,
        accion, elementoTipo, elementoId, resultado: "rechazado", operacionId});
      const seguro = error instanceof ErrorAdministrativo ? error :
        fallo("unavailable", "No se pudo verificar la operación.");
      seguro.operacionId = operacionId;
      throw seguro;
    }

    try {
      return await db.runTransaction(async (tx) => {
        const actor = await tx.get(db.collection("usuarios").doc(actorUid));
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
                "La clave de operación ya se utilizó con otros datos.");
          }
          return {resultado: "exito", operacionId,
            elementoId: previo.data().elementoId,
            ...(modo === "crear" ? {registro: contenido} : {})};
        }
        const destino = await tx.get(referencia);
        if (modo !== "crear" && !destino.exists) {
          throw fallo("not-found", "El registro ya no existe.");
        }
        if (modo !== "cambiar_estado") {
          // Consulta transaccional: evita nombres duplicados concurrentes.
          const todos = await tx.get(db.collection(coleccion));
          if (todos.docs.some((documento) => documento.id !== elementoId &&
              typeof documento.data().nombre === "string" &&
              normalizar(documento.data().nombre) ===
              normalizar(contenido.nombre))) {
            throw fallo("already-exists",
                "Ya existe un registro con ese nombre.");
          }
        }
        if (modo !== "crear" && Object.keys(contenido).every((campo) =>
          destino.data()[campo] === contenido[campo])) {
          throw fallo("failed-precondition",
              "El registro ya contiene esos valores.");
        }
        if (modo === "crear") tx.create(referencia, contenido);
        else tx.update(referencia, contenido);
        tx.create(eventoRef, {fecha: fechaServidor(), actorUid, accion,
          elementoTipo, elementoId, resultado: "exito", operacionId,
          // Huella irreversible para detectar reutilización de una clave con
          // otros datos; no guardar payloads ni contactos en el evento.
          huellaSolicitud});
        return {resultado: "exito", operacionId, elementoId,
          ...(modo === "crear" ? {registro: contenido} : {})};
      });
    } catch (error) {
      if (error instanceof ErrorAdministrativo) {
        await auditoria.doc().create({fecha: fechaServidor(), actorUid, accion,
          elementoTipo, elementoId, resultado: "rechazado", operacionId});
        error.operacionId = operacionId;
        throw error;
      }
      // Un fallo de transporte al confirmar puede tener resultado incierto.
      // No registrar un rechazo ficticio ni reintentar la solicitud desde aquí.
      throw new ErrorAdministrativo("unavailable",
          "Resultado no confirmado. Conserva la clave y revisa la bitácora.",
          operacionId);
    }
  };

  const operaciones = {};
  for (const tipo of Object.keys(TIPOS)) {
    operaciones[`crear${tipo}`] = construir(tipo, "crear");
    operaciones[`editar${tipo}`] = construir(tipo, "editar");
    operaciones[`cambiarEstado${tipo}`] = construir(tipo, "cambiar_estado");
  }
  return operaciones;
}

module.exports = {crearOperacionesCatalogos};
