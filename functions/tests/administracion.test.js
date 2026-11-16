"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {crearAdministracion} = require("../administracion");

/**
 * Prepara dependencias simuladas para las pruebas de contraseñas.
 * @param {object} opciones Condiciones y fallos simulados.
 * @return {object} Servicio y registros de las operaciones simuladas.
 */
function preparar(opciones = {}) {
  const eventos = [];
  const cambios = [];
  const revocaciones = [];

  const usuarios = {
    admin1: {rol: "administrador", activo: true},
    admin2: {rol: "administrador", activo: true},
    usuario1: {rol: "emprendedor", activo: true},
  };

  if (opciones.adminDesactivado) {
    usuarios.admin1.activo = false;
  }

  if (opciones.adminDesactivado) {
    usuarios.admin1.activo = false;
  }

  const db = {
    collection(nombre) {
      if (nombre === "auditoria_administrativa") {
        return {
          doc() {
            return {
              id: `evento-${eventos.length + 1}`,
              async create(datos) {
                if (opciones.falloAuditoriaInicial &&
                    datos.fase === "intento" &&
                    datos.resultado === "iniciado") {
                  throw new Error("Auditoria no disponible");
                }
                eventos.push(datos);
              },
            };
          },
        };
      }
      if (nombre === "usuarios") {
        return {
          doc(uid) {
            return {uid};
          },
        };
      }
      throw new Error("Coleccion inesperada");
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          const datos = usuarios[ref.uid];
          return {
            exists: Boolean(datos),
            data: () => datos,
          };
        },
      });
    },
  };

  const auth = {
    async verifyIdToken() {
      if (opciones.tokenInvalido) {
        throw new Error("Token invalido");
      }
      return {
        uid: opciones.actorUid || "admin1",
        auth_time: opciones.sesionAntigua ? 700 : 1000,
      };
    },
    async getUser(uid) {
      if (!usuarios[uid]) throw new Error("Usuario inexistente");
      return {uid};
    },
    async updateUser(uid, datos) {
      if (opciones.falloUpdateUser) {
        throw new Error("Authentication no disponible");
      }
      cambios.push({uid, datos});
    },
    async revokeRefreshTokens(uid) {
      if (opciones.falloRevocacion) {
        throw new Error("No se pudieron revocar sesiones");
      }
      revocaciones.push(uid);
    },
  };

  return {
    servicio: crearAdministracion({
      auth,
      db,
      fechaServidor: () => "FECHA_SIMULADA",
      ahora: () => 1100000,
    }),
    eventos,
    cambios,
    revocaciones,
  };
}

const solicitud = (uid, password = "PasswordSegura123!") => ({
  token: "token-prueba",
  datos: {uid, password},
});

test("Administrador cambia password de otro administrador", async () => {
  const e = preparar();
  const resultado = await e.servicio.cambiarPasswordAdministrador(
      solicitud("admin2"),
  );
  assert.equal(resultado.resultado, "exito");
  assert.equal(e.cambios.length, 1);
  assert.deepEqual(e.revocaciones, ["admin2"]);
  assert.equal(e.eventos.length, 2);
  assert.equal(e.eventos[1].resultado, "exito");
});

test("No puede cambiar su propia password", async () => {
  const e = preparar();
  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin1")),
      {codigo: "permission-denied"},
  );
  assert.equal(e.cambios.length, 0);
});

test("Emprendedor no puede cambiar passwords", async () => {
  const e = preparar({actorUid: "usuario1"});
  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "permission-denied"},
  );
  assert.equal(e.cambios.length, 0);
});

test("Rechaza password corta", async () => {
  const e = preparar();
  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2", "123")),
      {codigo: "invalid-argument"},
  );
  assert.equal(e.cambios.length, 0);
});

test("Rechaza token invalido", async () => {
  const e = preparar({tokenInvalido: true});
  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "unauthenticated"},
  );
  assert.equal(e.cambios.length, 0);
});

// SEGURIDAD_ADICIONAL_BORA

test("Administrador desactivado no puede cambiar passwords", async () => {
  const e = preparar({adminDesactivado: true});

  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "permission-denied"},
  );

  assert.equal(e.cambios.length, 0);
});
test("Auditoria registra el intento y resultado exitoso", async () => {
  const e = preparar();

  await e.servicio.cambiarPasswordAdministrador(solicitud("admin2"));

  assert.equal(e.eventos.length, 2);
  assert.equal(e.eventos[0].accion, "administrador.cambiar_password");
  assert.equal(e.eventos[0].fase, "intento");
  assert.equal(e.eventos[0].resultado, "iniciado");
  assert.equal(e.eventos[1].fase, "resultado");
  assert.equal(e.eventos[1].resultado, "exito");
  assert.equal(e.eventos[0].operacionId, e.eventos[1].operacionId);
});

test("La auditoria no almacena la password", async () => {
  const e = preparar();
  const password = "PasswordSegura123!";

  await e.servicio.cambiarPasswordAdministrador(
      solicitud("admin2", password),
  );

  const registros = JSON.stringify(e.eventos);

  assert.equal(registros.includes(password), false);
});


// PRUEBAS_SEGURIDAD_BORA_2

test("Una sesion antigua no puede cambiar passwords", async () => {
  const e = preparar({sesionAntigua: true});

  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "failed-precondition"},
  );

  assert.equal(e.cambios.length, 0);
  assert.equal(e.revocaciones.length, 0);
  assert.equal(e.eventos[0].resultado, "rechazado");
});
test("La auditoria registra el administrador responsable", async () => {
  const e = preparar();

  await e.servicio.cambiarPasswordAdministrador(solicitud("admin2"));

  assert.equal(e.eventos[0].actorUid, "admin1");
  assert.equal(e.eventos[1].actorUid, "admin1");
  assert.equal(e.eventos[0].destinatarioUid, "admin2");
  assert.equal(e.eventos[1].destinatarioUid, "admin2");
});

test("La operacion genera un identificador de auditoria", async () => {
  const e = preparar();

  const resultado = await e.servicio.cambiarPasswordAdministrador(
      solicitud("admin2"),
  );

  assert.ok(resultado.operacionId);
  assert.equal(resultado.operacionId, e.eventos[0].operacionId);
  assert.equal(resultado.operacionId, e.eventos[1].operacionId);
});


// PRUEBAS_FALLOS_BORA_3

test("Sin auditoria inicial no se cambia la password", async () => {
  const e = preparar({falloAuditoriaInicial: true});

  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "unavailable"},
  );

  assert.equal(e.cambios.length, 0);
  assert.equal(e.revocaciones.length, 0);
});

test("Fallo de Authentication no informa exito", async () => {
  const e = preparar({falloUpdateUser: true});

  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "unavailable"},
  );

  assert.equal(e.cambios.length, 0);
  assert.equal(e.eventos[1].resultado, "incierto");
});

test("Fallo de revocacion registra resultado parcial", async () => {
  const e = preparar({falloRevocacion: true});

  await assert.rejects(
      e.servicio.cambiarPasswordAdministrador(solicitud("admin2")),
      {codigo: "unavailable"},
  );

  assert.equal(e.cambios.length, 1);
  assert.equal(
      e.eventos[1].resultado,
      "password_cambiada_revocacion_pendiente",
  );
});
