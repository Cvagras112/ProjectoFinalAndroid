
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const db = admin.firestore();

// Función existente: aprobación mediante solicitudes.
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

// Habilitación directa de un comprador por un administrador.
exports.habilitarEmprendedora = onCall(
    {region: "us-central1"},
    async (request) => {
      const administradorId = request.auth?.uid;
      const datos = request.data || {};

      if (!administradorId) {
        throw new HttpsError(
            "unauthenticated",
            "Debes iniciar sesión.",
        );
      }

      const usuarioId = datos.usuarioId;
      const nombreTienda = datos.nombreTienda;
      const categoria = datos.categoria;
      const descripcion = datos.descripcion ?? "";
      const telefono = datos.telefono ?? "";

      if (
        typeof usuarioId !== "string" ||
        !usuarioId.trim() ||
        usuarioId !== usuarioId.trim() ||
        usuarioId.includes("/")
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Identificador de comprador inválido.",
        );
      }

      if (
        typeof nombreTienda !== "string" ||
        !nombreTienda.trim() ||
        nombreTienda.trim().length > 150
      ) {
        throw new HttpsError(
            "invalid-argument",
            "El nombre de la tienda debe tener entre 1 y 150 caracteres.",
        );
      }

      if (
        typeof categoria !== "string" ||
        !categoria.trim() ||
        categoria.trim().length > 100
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Debes ingresar una categoría válida.",
        );
      }

      if (
        typeof descripcion !== "string" ||
        descripcion.length > 2000
      ) {
        throw new HttpsError(
            "invalid-argument",
            "La descripción no puede superar los 2000 caracteres.",
        );
      }

      if (
        typeof telefono !== "string" ||
        telefono.length > 25
      ) {
        throw new HttpsError(
            "invalid-argument",
            "El teléfono no puede superar los 25 caracteres.",
        );
      }

      const administradorRef = db.collection("usuarios").doc(administradorId);
      const usuarioRef = db.collection("usuarios").doc(usuarioId);
      const emprendedorRef = db.collection("emprendedores").doc(usuarioId);
      const tiendaRef = db.collection("tiendas").doc();

      return db.runTransaction(async (transaction) => {
        const administradorDoc = await transaction.get(administradorRef);
        const usuarioDoc = await transaction.get(usuarioRef);
        const emprendedorDoc = await transaction.get(emprendedorRef);

        const tiendasExistentes = await transaction.get(
            db.collection("tiendas")
                .where("ID_Dueno", "==", usuarioId)
                .limit(1),
        );

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

        if (!usuarioDoc.exists) {
          throw new HttpsError(
              "not-found",
              "El comprador no existe.",
          );
        }

        const usuario = usuarioDoc.data();

        if (
          usuario.rol !== "comprador" ||
          usuario.activo !== true
        ) {
          throw new HttpsError(
              "failed-precondition",
              "El usuario no es un comprador activo.",
          );
        }

        if (emprendedorDoc.exists) {
          throw new HttpsError(
              "already-exists",
              "Este usuario ya tiene un perfil de emprendedor.",
          );
        }

        if (!tiendasExistentes.empty) {
          throw new HttpsError(
              "already-exists",
              "Este usuario ya tiene una tienda registrada.",
          );
        }

        const nombre = String(usuario.nombre || "").trim();

        if (!nombre) {
          throw new HttpsError(
              "failed-precondition",
              "El comprador no tiene un nombre registrado.",
          );
        }

        // Todas las escrituras se realizan en una transacción.
        // El documento del emprendedor utiliza el UID del comprador.
        transaction.create(emprendedorRef, {
          ID_Tienda: tiendaRef.id,
          activo: true,
          nombre,
          telefono: telefono.trim(),
          descripcion: "",
          direccion: "",
        });

        transaction.create(tiendaRef, {
          ID_Dueno: usuarioId,
          activo: true,
          nombre: nombreTienda.trim(),
          categoria: categoria.trim(),
          descripcion: descripcion.trim(),
          sector: "",
          telefono: telefono.trim(),
          whatsapp: "",
          emailContacto: "",
          imagen: "",
        });

        transaction.update(usuarioRef, {
          rol: "emprendedor",
        });

        return {
          exito: true,
          mensaje: "Comprador habilitado como emprendedor correctamente.",
          usuarioId,
          tiendaId: tiendaRef.id,
        };
      });
    },
);

// CREAR CUENTA DE EMPRENDEDORA - W05
exports.crearEmprendedora = onCall(
    {region: "us-central1"},
    async (request) => {
      const administradorId = request.auth?.uid;
      const datos = request.data || {};

      if (!administradorId) {
        throw new HttpsError(
            "unauthenticated",
            "Debes iniciar sesión.",
        );
      }

      const nombre = String(datos.nombre || "").trim();
      const email = String(datos.email || "").trim().toLowerCase();
      const password = datos.password;
      const nombreTienda = String(datos.nombreTienda || "").trim();
      const categoria = String(datos.categoria || "").trim();
      const telefono = String(datos.telefono || "").trim();
      const descripcion = String(datos.descripcion || "").trim();

      if (!nombre || nombre.length > 150) {
        throw new HttpsError(
            "invalid-argument",
            "Ingresa un nombre válido.",
        );
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Ingresa un correo válido.",
        );
      }

      if (
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128
      ) {
        throw new HttpsError(
            "invalid-argument",
            "La contraseña debe tener entre 8 y 128 caracteres.",
        );
      }

      if (!nombreTienda || nombreTienda.length > 150) {
        throw new HttpsError(
            "invalid-argument",
            "Ingresa un nombre de tienda válido.",
        );
      }

      if (!categoria || categoria.length > 100) {
        throw new HttpsError(
            "invalid-argument",
            "Selecciona una categoría válida.",
        );
      }

      if (telefono.length > 25 || descripcion.length > 2000) {
        throw new HttpsError(
            "invalid-argument",
            "Revisa el teléfono o la descripción.",
        );
      }

      const administradorRef = db.collection("usuarios")
          .doc(administradorId);

      const administradorDoc = await administradorRef.get();

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

      let nuevaCuenta = null;

      try {
        // Crear credenciales en Firebase Authentication.
        nuevaCuenta = await admin.auth().createUser({
          email,
          password,
          displayName: nombre,
          emailVerified: false,
          disabled: false,
        });

        const usuarioId = nuevaCuenta.uid;
        const emprendedorRef = db.collection("emprendedores")
            .doc(usuarioId);
        const tiendaRef = db.collection("tiendas").doc();

        // Guardar los tres documentos de forma atómica.
        const lote = db.batch();

        lote.create(
            db.collection("usuarios").doc(usuarioId),
            {
              ID: usuarioId,
              nombre,
              email,
              rol: "emprendedor",
              activo: true,
            },
        );

        lote.create(emprendedorRef, {
          ID_Tienda: tiendaRef.id,
          activo: true,
          nombre,
          telefono,
          descripcion: "",
          direccion: "",
        });

        lote.create(tiendaRef, {
          ID_Dueno: usuarioId,
          activo: true,
          nombre: nombreTienda,
          categoria,
          descripcion,
          sector: "",
          telefono,
          whatsapp: "",
          emailContacto: email,
          imagen: "",
        });

        await lote.commit();

        return {
          exito: true,
          mensaje: "Cuenta de emprendedora creada correctamente.",
          usuarioId,
          tiendaId: tiendaRef.id,
          email,
        };
      } catch (error) {
        console.error("Error creando emprendedora:", error);

        // Evitar cuentas de Authentication sin perfil en Firestore.
        if (nuevaCuenta) {
          try {
            await admin.auth().deleteUser(nuevaCuenta.uid);
          } catch (errorLimpieza) {
            console.error(
                "No se pudo eliminar la cuenta incompleta:",
                errorLimpieza,
            );
          }
        }

        if (error instanceof HttpsError) {
          throw error;
        }

        throw new HttpsError(
            "internal",
            "No fue posible crear la cuenta de emprendedora.",
        );
      }
    },
);
