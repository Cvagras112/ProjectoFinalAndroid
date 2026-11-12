const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {prepararProducto, prepararVenta} = require("./inventario");
const db = admin.firestore();
const id = (valor) => {
  if (typeof valor !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(valor)) {
    throw new HttpsError("invalid-argument", "Identificador inválido.");
  }
  return valor;
};
const propietario = async (tx, uid, tiendaId) => {
  const [usuario, perfil, tienda] = await Promise.all([
    tx.get(db.doc("usuarios/" + uid)),
    tx.get(db.doc("emprendedores/" + uid)),
    tx.get(db.doc("tiendas/" + tiendaId)),
  ]);
  if (
    !usuario.exists ||
    usuario.data().rol !== "emprendedor" ||
    usuario.data().activo !== true ||
    !perfil.exists ||
    perfil.data().activo !== true ||
    perfil.data().ID_Tienda !== tiendaId ||
    !tienda.exists ||
    tienda.data().activo !== true ||
    tienda.data().ID_Dueno !== uid
  ) {
    throw new HttpsError(
        "permission-denied",
        "Tu cuenta no puede administrar esta tienda.",
    );
  }
};
const operacion = (fn) => {
  return onCall({region: "us-central1"}, async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Inicia sesión.");
    }
    try {
      return await fn(request.auth.uid, request.data || {});
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      if (e.code) {
        throw new HttpsError(
            "unavailable",
            "Operación sin confirmar. Reintenta con el mismo identificador.",
        );
      }
      throw new HttpsError("failed-precondition", e.message);
    }
  });
};
exports.guardarProducto = operacion(async (uid, s) => {
  const tiendaId = id(s.tiendaId);
  const productoId = id(s.productoId);
  return db.runTransaction(async (tx) => {
    await propietario(tx, uid, tiendaId);
    const ref = db.doc("productos/" + productoId);
    const snap = await tx.get(ref);
    if (snap.exists && snap.data().ID_Tienda !== tiendaId) {
      throw new HttpsError("permission-denied", "Producto ajeno.");
    }
    if (snap.exists && (snap.data().Revision || 0) !== s.revision) {
      throw new HttpsError(
          "aborted",
          "El inventario cambió. Recarga el producto antes de editar.",
      );
    }
    if (!snap.exists && s.revision !== null) {
      throw new HttpsError("not-found", "El producto ya no existe.");
    }
    const datos = prepararProducto(
        s.datos || {},
      snap.exists ? snap.data() : {},
    );
    tx.set(ref, {
      ...datos,
      ID_Producto: productoId,
      ID_Tienda: tiendaId,
      ActualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {productoId};
  });
});
exports.registrarVenta = operacion(async (uid, s) => {
  const tiendaId = id(s.tiendaId);
  const productoId = id(s.productoId);
  const operacionId = id(s.operacionId);
  return db.runTransaction(async (tx) => {
    await propietario(tx, uid, tiendaId);
    const reciboRef = db.doc(
        "movimientosInventario/" + uid + "_" + operacionId,
    );
    const recibo = await tx.get(reciboRef);
    const firma = JSON.stringify([
      tiendaId,
      productoId,
      s.varianteId || "",
      s.cantidad,
    ]);
    if (recibo.exists) {
      if (recibo.data().firma !== firma) {
        throw new HttpsError(
            "already-exists",
            "Este identificador ya corresponde a otra operación.",
        );
      }
      return {ventaId: recibo.data().ventaId, repetida: true};
    }
    const ref = db.doc("productos/" + productoId);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().ID_Tienda !== tiendaId) {
      throw new HttpsError(
          "permission-denied",
          "No encontramos un producto de tu tienda.",
      );
    }
    const {cambios, venta} = prepararVenta(snap.data(), s);
    const ventaId = uid + "_" + operacionId;
    tx.update(ref, {
      ...cambios,
      ActualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Recibo privado: evita descontar dos veces al reintentar.
    tx.create(reciboRef, {
      firma,
      ventaId,
      usuarioId: uid,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.create(db.doc("ventas/" + ventaId), {
      ...venta,
      productoId,
      tiendaId,
      usuarioId: uid,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {ventaId};
  });
});
