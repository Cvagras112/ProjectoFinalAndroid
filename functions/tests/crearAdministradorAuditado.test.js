"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  crearServicioCreacionAdministrador,
} = require("../crearAdministradorAuditado");

/**
 * Prepara dependencias simuladas para las pruebas de creación.
 * @param {object} opciones Fallos simulados de transacción y limpieza.
 * @return {object} Servicio, perfiles, eventos y cuentas simuladas.
 */
function preparar(opciones = {}) {
  const usuarios = new Map([
    ["admin1", {rol: "administrador", activo: true}],
    ["comprador1", {rol: "comprador", activo: true}],
    ["inactivo1", {rol: "administrador", activo: false}],
  ]);

  const eventos = new Map();
  const cuentas = new Map();
  let secuencia = 0;

  const db = {
    collection(nombre) {
      return {
        doc(id) {
          const identificador = id || `evento-${++secuencia}`;
          return {
            id: identificador,
            async get() {
              const datos = nombre === "usuarios" ?
                usuarios.get(identificador) :
                eventos.get(identificador);
              return {
                exists: datos !== undefined,
                data: () => datos,
              };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      const escrituras = [];
      const tx = {
        async get(ref) {
          return ref.get();
        },
        create(ref, datos) {
          escrituras.push({ref, datos});
        },
      };

      await callback(tx);

      if (opciones.falloTransaccion) {
        throw new Error("Fallo simulado de Firestore");
      }

      for (const {ref, datos} of escrituras) {
        if (ref.id.startsWith("evento-")) {
          eventos.set(ref.id, datos);
        } else {
          usuarios.set(ref.id, datos);
        }
      }
    },
  };

  const authAdmin = {
    async createUser(datos) {
      const uid = `nuevo-${++secuencia}`;
      cuentas.set(uid, datos);
      return {uid};
    },
    async deleteUser(uid) {
      if (opciones.falloLimpieza) {
        throw new Error("Fallo simulado de limpieza");
      }
      cuentas.delete(uid);
    },
  };

  const servicio = crearServicioCreacionAdministrador({
    db,
    authAdmin,
    fechaServidor: () => "FECHA_SIMULADA",
  });

  return {servicio, usuarios, eventos, cuentas};
}

const datosValidos = {
  nombre: "Nueva Administradora",
  email: "nueva@example.test",
  password: "PasswordSegura123!",
};

test("administrador activo crea cuenta, perfil y auditoria", async () => {
  const e = preparar();

  const resultado = await e.servicio.ejecutar({
    actorUid: "admin1",
    datos: datosValidos,
  });

  assert.equal(resultado.resultado, "exito");
  assert.equal(e.cuentas.size, 1);
  assert.equal(e.usuarios.get(resultado.uid).rol, "administrador");
  assert.equal(e.usuarios.get(resultado.uid).activo, true);

  const evento = e.eventos.get(resultado.operacionId);
  assert.equal(evento.accion, "administrador.crear");
  assert.equal(evento.actorUid, "admin1");
  assert.equal(evento.destinatarioUid, resultado.uid);
  assert.equal(evento.resultado, "exito");
});

test("rechaza usuario sin sesion", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({actorUid: null, datos: datosValidos}),
      {codigo: "unauthenticated"},
  );

  assert.equal(e.cuentas.size, 0);
});

test("rechaza comprador y administrador inactivo", async () => {
  for (const actorUid of ["comprador1", "inactivo1"]) {
    const e = preparar();

    await assert.rejects(
        e.servicio.ejecutar({actorUid, datos: datosValidos}),
        {codigo: "permission-denied"},
    );

    assert.equal(e.cuentas.size, 0);
  }
});

test("rechaza datos invalidos sin crear cuentas", async () => {
  const casos = [
    {...datosValidos, nombre: ""},
    {...datosValidos, email: "correo-invalido"},
    {...datosValidos, password: "123"},
  ];

  for (const datos of casos) {
    const e = preparar();

    await assert.rejects(
        e.servicio.ejecutar({actorUid: "admin1", datos}),
        {codigo: "invalid-argument"},
    );

    assert.equal(e.cuentas.size, 0);
  }
});

test("si falla Firestore elimina la cuenta de Authentication", async () => {
  const e = preparar({falloTransaccion: true});

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: "admin1",
        datos: datosValidos,
      }),
      /Fallo simulado de Firestore/,
  );

  assert.equal(e.cuentas.size, 0);
  assert.equal(e.eventos.size, 0);
});

test("si falla la limpieza informa resultado incierto", async () => {
  const e = preparar({
    falloTransaccion: true,
    falloLimpieza: true,
  });

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: "admin1",
        datos: datosValidos,
      }),
      {codigo: "internal"},
  );

  assert.equal(e.cuentas.size, 1);
});
