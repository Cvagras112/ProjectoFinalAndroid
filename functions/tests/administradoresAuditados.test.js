"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  crearAdministradoresAuditados,
} = require("../administradoresAuditados");

/**
 * Prepara dependencias simuladas para las pruebas de administradores.
 * @param {object} opciones Opciones de preparación de la prueba.
 * @return {object} Servicio, documentos y contador de escrituras simuladas.
 */
function preparar(opciones = {}) {
  const usuarios = new Map([
    ["admin1", {
      rol: "administrador",
      activo: true,
      nombre: "Administrador Uno",
    }],
    ["admin2", {
      rol: "administrador",
      activo: true,
      nombre: "Administrador Dos",
    }],
    ["inactivo1", {
      rol: "administrador",
      activo: false,
      nombre: "Administrador Inactivo",
    }],
    ["usuario1", {
      rol: "emprendedor",
      activo: true,
      nombre: "Emprendedor",
    }],
  ]);

  const eventos = new Map();
  let secuencia = 0;
  let escrituras = 0;

  const db = {
    collection(nombre) {
      return {
        doc(id) {
          const identificador = id ||
            `evento-${++secuencia}`;

          return {
            id: identificador,
            coleccion: nombre,
          };
        },
      };
    },

    async runTransaction(callback) {
      const pendientes = [];

      const tx = {
        async get(ref) {
          const datos = ref.coleccion === "usuarios" ?
            usuarios.get(ref.id) :
            eventos.get(ref.id);

          return {
            exists: datos !== undefined,
            data: () => datos,
          };
        },

        update(ref, cambios) {
          pendientes.push({
            tipo: "update",
            ref,
            datos: cambios,
          });
        },

        create(ref, datos) {
          pendientes.push({
            tipo: "create",
            ref,
            datos,
          });
        },
      };

      const resultado = await callback(tx);

      for (const escritura of pendientes) {
        if (escritura.tipo === "update") {
          const anterior = usuarios.get(escritura.ref.id);

          usuarios.set(escritura.ref.id, {
            ...anterior,
            ...escritura.datos,
          });
        }

        if (escritura.tipo === "create") {
          eventos.set(
              escritura.ref.id,
              escritura.datos,
          );
        }
      }

      escrituras += pendientes.length;

      return resultado;
    },
  };

  const servicio = crearAdministradoresAuditados({
    db,
    fechaServidor: () => "FECHA_SIMULADA",
  });

  return {
    servicio,
    usuarios,
    eventos,
    get escrituras() {
      return escrituras;
    },
  };
}

const solicitud = (accion, datos = {}) => ({
  actorUid: "admin1",
  accion,
  datos: {
    uid: "admin2",
    ...datos,
  },
});

test("Admin edita nombre y registra auditoria", async () => {
  const e = preparar();

  const resultado = await e.servicio.ejecutar(
      solicitud("editar", {
        nombre: "  Nuevo Administrador  ",
      }),
  );

  assert.equal(resultado.resultado, "exito");
  assert.equal(
      e.usuarios.get("admin2").nombre,
      "Nuevo Administrador",
  );

  const evento = e.eventos.get(resultado.operacionId);

  assert.equal(evento.accion, "administrador.editar");
  assert.equal(evento.actorUid, "admin1");
  assert.equal(evento.destinatarioUid, "admin2");
  assert.equal(evento.resultado, "exito");
  assert.equal(evento.fase, "resultado");
});

test("Admin desactiva otro administrador", async () => {
  const e = preparar();

  const resultado = await e.servicio.ejecutar(
      solicitud("desactivar"),
  );

  assert.equal(e.usuarios.get("admin2").activo, false);

  const evento = e.eventos.get(resultado.operacionId);

  assert.equal(evento.accion, "administrador.desactivar");
  assert.equal(evento.actorUid, "admin1");
  assert.equal(evento.destinatarioUid, "admin2");
  assert.equal(evento.resultado, "exito");
});

test("Admin activa otro administrador", async () => {
  const e = preparar();

  await e.servicio.ejecutar({
    actorUid: "admin1",
    accion: "activar",
    datos: {uid: "inactivo1"},
  });

  assert.equal(e.usuarios.get("inactivo1").activo, true);
  assert.equal(e.eventos.size, 1);
  assert.equal(
      [...e.eventos.values()][0].accion,
      "administrador.activar",
  );
});

test("Rechaza actor sin sesion", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: null,
        accion: "editar",
        datos: {uid: "admin2", nombre: "Nuevo"},
      }),
      {codigo: "unauthenticated"},
  );

  assert.equal(e.escrituras, 0);
});

test("Rechaza emprendedor como actor", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        ...solicitud("desactivar"),
        actorUid: "usuario1",
      }),
      {codigo: "permission-denied"},
  );

  assert.equal(e.escrituras, 0);
});

test("Rechaza administrador inactivo como actor", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        ...solicitud("desactivar"),
        actorUid: "inactivo1",
      }),
      {codigo: "permission-denied"},
  );

  assert.equal(e.escrituras, 0);
});

test("Impide modificar la propia cuenta", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: "admin1",
        accion: "desactivar",
        datos: {uid: "admin1"},
      }),
      {codigo: "invalid-argument"},
  );

  assert.equal(e.escrituras, 0);
});

test("Rechaza destinatario que no es administrador", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: "admin1",
        accion: "desactivar",
        datos: {uid: "usuario1"},
      }),
      {codigo: "failed-precondition"},
  );

  assert.equal(e.escrituras, 0);
});

test("Rechaza nombre vacio o invalido", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar(
          solicitud("editar", {nombre: "   "}),
      ),
      {codigo: "invalid-argument"},
  );

  assert.equal(e.escrituras, 0);
});

test("Rechaza operaciones sin cambios", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: "admin1",
        accion: "activar",
        datos: {uid: "admin2"},
      }),
      {codigo: "failed-precondition"},
  );

  assert.equal(e.escrituras, 0);
});

test("Rechaza acciones desconocidas", async () => {
  const e = preparar();

  await assert.rejects(
      e.servicio.ejecutar({
        actorUid: "admin1",
        accion: "eliminar",
        datos: {uid: "admin2"},
      }),
      {codigo: "invalid-argument"},
  );

  assert.equal(e.escrituras, 0);
});

test("Cada operacion exitosa genera una auditoria", async () => {
  const e = preparar();

  for (const accion of ["editar", "desactivar"]) {
    await e.servicio.ejecutar(
        solicitud(accion, accion === "editar" ? {
          nombre: "Nombre Actualizado",
        } : {}),
    );
  }

  assert.equal(e.eventos.size, 2);

  for (const evento of e.eventos.values()) {
    assert.equal(evento.actorUid, "admin1");
    assert.equal(evento.destinatarioUid, "admin2");
    assert.equal(evento.fase, "resultado");
    assert.equal(evento.resultado, "exito");
    assert.ok(evento.operacionId);
    assert.ok(evento.fecha);
  }
});
