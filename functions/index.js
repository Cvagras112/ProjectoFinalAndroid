
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const db = admin.firestore();

exports.aprobarSolicitudEmprendedor = onCall(
    {region: "us-central1"},
    async (request) => {
      const administradorId = request.auth?.uid;
      const usuarioId = request.data?.usuarioId;

      if (!administradorId) {
        throw new HttpsError(
            "unauthenticated",
            "Debes iniciar sesión.",
        );
      }

      if (typeof usuarioId !== "string" || !usuarioId.trim()) {
        throw new HttpsError(
            "invalid-argument",
            "Identificador de solicitud inválido.",
        );
      }

      const administradorRef = db.collection("usuarios").doc(administradorId);
      const usuarioRef = db.collection("usuarios").doc(usuarioId);
      const solicitudRef = db
          .collection("solicitudes_emprendedores")
          .doc(usuarioId);
      const emprendedorRef = db.collection("emprendedores").doc(usuarioId);
      const tiendaRef = db.collection("tiendas").doc();

      return db.runTransaction(async (transaction) => {
        const administradorDoc = await transaction.get(administradorRef);
        const usuarioDoc = await transaction.get(usuarioRef);
        const solicitudDoc = await transaction.get(solicitudRef);
        const emprendedorDoc = await transaction.get(emprendedorRef);

        if (
          !administradorDoc.exists ||
                administradorDoc.data().rol !== "administrador" ||
                administradorDoc.data().activo !== true
        ) {
          throw new HttpsError(
              "permission-denied",
              "No tienes permisos de administrador.",
          );
        }

        if (!usuarioDoc.exists || !solicitudDoc.exists) {
          throw new HttpsError(
              "not-found",
              "Usuario o solicitud no encontrada.",
          );
        }

        const solicitud = solicitudDoc.data();

        if (solicitud.estado !== "pendiente") {
          throw new HttpsError(
              "failed-precondition",
              "La solicitud ya fue procesada.",
          );
        }

        if (emprendedorDoc.exists) {
          throw new HttpsError(
              "already-exists",
              "El perfil de emprendedor ya existe.",
          );
        }

        if (
          usuarioDoc.data().rol !== "comprador" ||
                usuarioDoc.data().activo !== true ||
                solicitud.usuarioId !== usuarioId ||
                solicitud.email !== usuarioDoc.data().email
        ) {
          throw new HttpsError(
              "failed-precondition",
              "Los datos del usuario no son válidos para aprobar.",
          );
        }

        transaction.create(tiendaRef, {
          ID_Dueno: usuarioId,
          activo: true,
          categoria: solicitud.categoria,
          descripcion: solicitud.descripcion,
          imagen: "",
          nombre: solicitud.emprendimiento,
        });

        transaction.create(emprendedorRef, {
          ID_Tienda: tiendaRef.id,
          activo: true,
          descripcion: solicitud.descripcion,
          direccion: "",
          nombre: solicitud.nombre,
          telefono: solicitud.telefono,
        });

        transaction.update(usuarioRef, {
          rol: "emprendedor",
        });

        transaction.update(solicitudRef, {
          estado: "aprobada",
        });

        return {
          exito: true,
          mensaje: "Solicitud aprobada correctamente.",
          tiendaId: tiendaRef.id,
        };
      });
    },
);
