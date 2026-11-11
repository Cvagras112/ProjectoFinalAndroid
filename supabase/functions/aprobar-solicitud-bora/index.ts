
import "@supabase/functions-js/edge-runtime.d.ts";
import admin from "firebase-admin";

const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")
  ?.replace(/\\n/g, "\n");

// Configurar los orígenes permitidos en el servidor.
// Ejemplo: http://localhost:5173,https://bora.example.com
const origenesPermitidos = (Deno.env.get("BORA_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);

function obtenerCors(req: Request): Record<string, string> {
  const origen = req.headers.get("Origin");

  if (!origen || !origenesPermitidos.includes(origen)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origen,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
  };
}

function respuesta(
  req: Request,
  mensaje: string,
  status: number,
  datos: Record<string, unknown> = {},
): Response {
  return Response.json(
    { mensaje, ...datos },
    {
      status,
      headers: {
        ...obtenerCors(req),
        "Cache-Control": "no-store",
      },
    },
  );
}

function obtenerFirebase() {
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin no está configurado.");
  }

  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

  return {
    auth: app.auth(),
    db: app.firestore(),
  };
}

export default {
  async fetch(req: Request): Promise<Response> {
    const origen = req.headers.get("Origin");

    if (origen && !origenesPermitidos.includes(origen)) {
      return respuesta(req, "Origen no autorizado.", 403);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: obtenerCors(req),
      });
    }

    if (req.method !== "POST") {
      return respuesta(req, "Método no permitido.", 405);
    }

    try {
      const autorizacion = req.headers.get("Authorization") || "";

      if (!autorizacion.startsWith("Bearer ")) {
        return respuesta(req, "Debes iniciar sesión.", 401);
      }

      const token = autorizacion.slice(7).trim();

      if (!token) {
        return respuesta(req, "Token de autenticación inválido.", 401);
      }

      const { auth, db } = obtenerFirebase();

      let administradorId: string;

      try {
        const identidad = await auth.verifyIdToken(token, true);
        administradorId = identidad.uid;
      } catch {
        return respuesta(req, "Sesión inválida o expirada.", 401);
      }

      let cuerpo: unknown;

      try {
        cuerpo = await req.json();
      } catch {
        return respuesta(req, "El cuerpo de la solicitud no es válido.", 400);
      }

      if (
        !cuerpo ||
        typeof cuerpo !== "object" ||
        !("usuarioId" in cuerpo) ||
        typeof cuerpo.usuarioId !== "string" ||
        !cuerpo.usuarioId.trim()
      ) {
        return respuesta(req, "Identificador de solicitud inválido.", 400);
      }

      const usuarioId = cuerpo.usuarioId.trim();

      if (usuarioId.includes("/")) {
        return respuesta(req, "Identificador de usuario inválido.", 400);
      }

      const administradorRef = db.collection("usuarios").doc(administradorId);
      const usuarioRef = db.collection("usuarios").doc(usuarioId);

      const solicitudRef = db
        .collection("solicitudes_emprendedores")
        .doc(usuarioId);

      const emprendedorRef = db
        .collection("emprendedores")
        .doc(usuarioId);

      const tiendaRef = db.collection("tiendas").doc();

      const resultado = await db.runTransaction(async (transaction) => {
        const administradorDoc = await transaction.get(administradorRef);
        const usuarioDoc = await transaction.get(usuarioRef);
        const solicitudDoc = await transaction.get(solicitudRef);
        const emprendedorDoc = await transaction.get(emprendedorRef);

        const administrador = administradorDoc.data();
        const usuario = usuarioDoc.data();
        const solicitud = solicitudDoc.data();

        if (
          !administradorDoc.exists ||
          administrador?.rol !== "administrador" ||
          administrador?.activo !== true
        ) {
          return {
            status: 403,
            mensaje: "No tienes permisos de administrador.",
          };
        }

        if (!usuarioDoc.exists || !solicitudDoc.exists) {
          return {
            status: 404,
            mensaje: "Usuario o solicitud no encontrada.",
          };
        }

        if (solicitud?.estado !== "pendiente") {
          return {
            status: 409,
            mensaje: "La solicitud ya fue procesada.",
          };
        }

        if (emprendedorDoc.exists) {
          return {
            status: 409,
            mensaje: "El perfil de emprendedor ya existe.",
          };
        }

        if (
          usuario?.rol !== "comprador" ||
          usuario?.activo !== true ||
          solicitud.usuarioId !== usuarioId ||
          solicitud.email !== usuario.email
        ) {
          return {
            status: 409,
            mensaje: "Los datos del usuario no son válidos para aprobar.",
          };
        }

        const campos = [
          solicitud.nombre,
          solicitud.emprendimiento,
          solicitud.categoria,
          solicitud.descripcion,
          solicitud.telefono,
        ];

        if (
          campos.some(
            (valor) =>
              typeof valor !== "string" || valor.trim().length === 0
          )
        ) {
          return {
            status: 409,
            mensaje: "La solicitud contiene datos incompletos.",
          };
        }

        transaction.create(tiendaRef, {
          ID_Dueno: usuarioId,
          activo: true,
          categoria: solicitud.categoria.trim(),
          descripcion: solicitud.descripcion.trim(),
          imagen: "",
          nombre: solicitud.emprendimiento.trim(),
        });

        transaction.create(emprendedorRef, {
          ID_Tienda: tiendaRef.id,
          activo: true,
          descripcion: solicitud.descripcion.trim(),
          direccion: "",
          nombre: solicitud.nombre.trim(),
          telefono: solicitud.telefono.trim(),
        });

        transaction.update(usuarioRef, {
          rol: "emprendedor",
        });

        transaction.update(solicitudRef, {
          estado: "aprobada",
        });

        return {
          status: 200,
          mensaje: "Solicitud aprobada correctamente.",
          exito: true,
          tiendaId: tiendaRef.id,
        };
      });

      const { status, mensaje, ...datos } = resultado;

      return respuesta(req, mensaje, status, datos);
    } catch (error) {
      console.error("Error al aprobar solicitud:", error);

      return respuesta(
        req,
        "No fue posible procesar la solicitud.",
        500,
      );
    }
  },
};
