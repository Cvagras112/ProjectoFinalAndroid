"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {ErrorAdministrativo} = require("../administracion");
const nombres = [
  "crearCategoria", "editarCategoria", "cambiarEstadoCategoria",
  "crearTipoProducto", "editarTipoProducto", "cambiarEstadoTipoProducto",
  "crearTipoEmprendimiento", "editarTipoEmprendimiento",
  "cambiarEstadoTipoEmprendimiento", "crearAsociacion", "editarAsociacion",
  "cambiarEstadoAsociacion",
];
const preparar = (fallo) => {
  const llamadas = [];
  const sdk = {apps: [], initializeApp: () => sdk.apps.push({}),
    auth: () => "auth", firestore: () => "db"};
  /** Error de transporte simulado, sin dependencias de Firebase. */
  class HttpsError extends Error {
    /**
     * @param {string} code Código público.
     * @param {string} message Mensaje público.
     * @param {object} details Metadatos permitidos.
     */
    constructor(code, message, details) {
      super(message);
      Object.assign(this, {code, details});
    }
  }
  const mocks = {
    "firebase-functions/v2/https": {HttpsError, onCall: (opciones, fn) => {
      assert.equal(opciones.region, "us-central1");
      return fn;
    }},
    "firebase-admin": sdk,
    "firebase-admin/firestore": {
      FieldValue: {serverTimestamp: () => "fecha"},
    },
    "./administracion": {ErrorAdministrativo},
    "./catalogosAdministrativos": {crearOperacionesCatalogos: (deps) => {
      assert.equal(deps.auth, "auth");
      assert.equal(deps.db, "db");
      return Object.fromEntries(nombres.map((nombre) => [nombre,
        async (datos) => {
          llamadas.push({nombre, ...datos});
          if (fallo) throw fallo;
          return {resultado: "exito"};
        }]));
    }},
  };
  const exports = {};
  const source = readFileSync(join(__dirname,
      "../catalogosAdministrativos.entry.js"), "utf8");
  new Function("require", "exports", source)(
      (nombre) => mocks[nombre], exports);
  return {exports, llamadas};
};

test("doce callables con token y datos sin roles del cliente", async () => {
  const p = preparar();
  assert.deepEqual(Object.keys(p.exports), nombres);
  for (const nombre of nombres) {
    const data = {nombre: "Prueba"};
    await p.exports[nombre]({rawRequest: {headers: {
      authorization: "Bearer token-ficticio",
    }}, data});
    assert.deepEqual(p.llamadas.at(-1), {nombre,
      token: "token-ficticio", datos: data});
  }
});

test("adaptador conserva código seguro e ID de operación", async () => {
  const p = preparar(new ErrorAdministrativo("permission-denied",
      "Sin permiso", "op-1"));
  await assert.rejects(p.exports.crearCategoria({rawRequest: {headers: {}},
    data: {}}), {code: "permission-denied", details: {operacionId: "op-1"}});
});

test("adaptador no expone mensajes internos del SDK", async () => {
  const p = preparar(new Error("SECRETO"));
  await assert.rejects(p.exports.crearCategoria({rawRequest: {headers: {}},
    data: {}}), (error) => error.code === "unavailable" &&
      !error.message.includes("SECRETO"));
});
