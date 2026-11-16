"use strict";
/* eslint max-len: ["error", {"code": 100}] */

const {test, before, after, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {randomUUID} = require("node:crypto");
const {join} = require("node:path");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {createMockUserToken} = require("../../web/node_modules/@firebase/util");
const {initializeTestEnvironment, assertFails, assertSucceeds} =
  require("../../web/node_modules/@firebase/rules-unit-testing");
const web = require("../../web/node_modules/firebase/firestore");
const {crearOperacionesCatalogos} = require("../catalogosAdministrativos");

const projectId = "demo-bora-catalogos-2a";
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8087") {
  throw new Error("Ejecutar exclusivamente con Auth y Firestore Emulator locales.");
}
let app;
let db;
let auth;
let env;
let operaciones;
const tipos = [
  ["Categoria", "categorias", "categoria"],
  ["TipoProducto", "tipos_productos", "tipo_producto"],
  ["TipoEmprendimiento", "tipos_emprendimiento", "tipo_emprendimiento"],
  ["Asociacion", "asociaciones", "asociacion"],
];
const datosTipo = (tipo, nombre = "Registro inicial") => tipo === "Asociacion" ?
  {nombre, descripcion: "Descripción", sector: "Sector", contacto: "Privado",
    logo: "https://example.test/logo.png"} : {nombre};
const token = (uid = "activo") => createMockUserToken({sub: uid,
  iat: Math.floor(Date.now() / 1000),
  auth_time: Math.floor(Date.now() / 1000)}, projectId);
const ejecutar = (nombre, datos, uid = "activo") => operaciones[nombre]({
  token: token(uid), datos: {solicitudId: randomUUID(), ...datos},
});

before(async () => {
  web.setLogLevel("silent");
  app = admin.initializeApp({projectId}, "catalogos-2a-tests");
  auth = app.auth();
  db = app.firestore();
  env = await initializeTestEnvironment({projectId, firestore: {
    host: "127.0.0.1", port: 8087,
    rules: readFileSync(join(__dirname, "../../firestore.rules"), "utf8"),
  }});
  // Cuentas ficticias únicamente en el proyecto de pruebas separado.
  for (const uid of ["activo", "inactivo", "emprendedor", "sin-perfil"]) {
    try {
      await auth.createUser({uid});
    } catch (error) {
      if (error.code !== "auth/uid-already-exists") throw error;
    }
  }
  operaciones = crearOperacionesCatalogos({auth, db,
    fechaServidor: () => FieldValue.serverTimestamp()});
});
beforeEach(async () => {
  await env.clearFirestore();
  await db.doc("usuarios/activo").set({rol: "administrador", activo: true});
  await db.doc("usuarios/inactivo").set({rol: "administrador", activo: false});
  await db.doc("usuarios/emprendedor").set({rol: "emprendedor", activo: true});
});
after(async () => {
  await env?.cleanup();
  await app?.delete();
});

for (const [tipo, coleccion, elementoTipo] of tipos) {
  test(`${tipo}: crea, edita, desactiva y reactiva con auditoría atómica`, async () => {
    const creado = await ejecutar(`crear${tipo}`, datosTipo(tipo));
    const editado = await ejecutar(`editar${tipo}`, {
      id: creado.elementoId, ...datosTipo(tipo, "Nombre editado"),
    });
    const desactivado = await ejecutar(`cambiarEstado${tipo}`, {
      id: creado.elementoId, estado: "Inactiva",
    });
    const activado = await ejecutar(`cambiarEstado${tipo}`, {
      id: creado.elementoId, estado: "Activa",
    });
    const registro = (await db.doc(`${coleccion}/${creado.elementoId}`).get()).data();
    assert.deepEqual(registro, {...datosTipo(tipo, "Nombre editado"), estado: "Activa"});
    for (const [respuesta, accion] of [
      [creado, "crear"], [editado, "editar"],
      [desactivado, "desactivar"], [activado, "activar"],
    ]) {
      assert.equal(respuesta.resultado, "exito");
      const eventoRef = db.doc(`auditoria_administrativa/${respuesta.operacionId}`);
      const evento = (await eventoRef.get()).data();
      assert.equal(evento.actorUid, "activo");
      assert.equal(evento.accion, `${elementoTipo}.${accion}`);
      assert.equal(evento.elementoTipo, elementoTipo);
      assert.equal(evento.elementoId, creado.elementoId);
      assert.equal(evento.operacionId, respuesta.operacionId);
      assert.equal(evento.resultado, "exito");
      assert.ok(evento.fecha.toDate() instanceof Date);
      assert.ok(!JSON.stringify(evento).includes("Privado"));
      assert.ok(!("token" in evento));
      assert.ok(!("password" in evento));
    }
    assert.equal((await db.collection(coleccion).get()).size, 1);
    assert.equal((await db.collection("auditoria_administrativa").get()).size, 4);
  });

  test(`${tipo}: reglas bloquean creación, edición y borrado directos`, async () => {
    const cliente = env.authenticatedContext("activo").firestore();
    const ref = web.doc(cliente, coleccion, "directo");
    await assertFails(web.setDoc(ref, {...datosTipo(tipo), estado: "Activa"}));
    const creado = await ejecutar(`crear${tipo}`, datosTipo(tipo));
    const existente = web.doc(cliente, coleccion, creado.elementoId);
    await assertFails(web.updateDoc(existente, {nombre: "Sin auditoría"}));
    await assertFails(web.updateDoc(existente, {estado: "Inactiva"}));
    await assertFails(web.deleteDoc(existente));
    await assertSucceeds(web.getDocs(web.collection(cliente, coleccion)));
    const visitante = env.unauthenticatedContext().firestore();
    if (["categorias", "tipos_productos"].includes(coleccion)) {
      await assertSucceeds(web.getDocs(web.collection(visitante, coleccion)));
    } else {
      await assertFails(web.getDocs(web.collection(visitante, coleccion)));
    }
  });
}

test("rechaza administrador inactivo, emprendedor, sin perfil y token inválido", async () => {
  for (const uid of ["inactivo", "emprendedor", "sin-perfil"]) {
    await assert.rejects(ejecutar("crearCategoria", {nombre: "Intento"}, uid),
        {codigo: "permission-denied"});
  }
  await assert.rejects(operaciones.crearCategoria({token: "inválido", datos: {}}),
      {codigo: "unauthenticated"});
  assert.equal((await db.collection("categorias").get()).size, 0);
  const eventos = await db.collection("auditoria_administrativa").get();
  assert.equal(eventos.size, 4);
  assert.ok(eventos.docs.every((d) => d.data().resultado === "rechazado"));
  assert.equal(eventos.docs.find((d) => d.data().actorUid === null).data().resultado, "rechazado");
});

test("rechaza campos adicionales, rutas, nombres, estados y asociaciones inválidas", async () => {
  for (const datos of [{nombre: "ab"}, {nombre: " ".repeat(5)},
    {nombre: "x".repeat(101)}, {nombre: 7},
    {nombre: "Intento", rol: "administrador"},
    {nombre: "Intento", coleccion: "usuarios"}]) {
    await assert.rejects(ejecutar("crearCategoria", datos), {codigo: "invalid-argument"});
  }
  await assert.rejects(ejecutar("editarCategoria", {id: "usuarios/otro", nombre: "Intento"}));
  await assert.rejects(ejecutar("cambiarEstadoCategoria", {id: "x", estado: "Eliminada"}));
  for (const datos of [
    {...datosTipo("Asociacion"), logo: "javascript:alert(1)"},
    {...datosTipo("Asociacion"), contacto: "x".repeat(201)},
    {...datosTipo("Asociacion"), descripcion: "x".repeat(501)},
  ]) await assert.rejects(ejecutar("crearAsociacion", datos), {codigo: "invalid-argument"});
  assert.equal((await db.collection("categorias").get()).size, 0);
  assert.equal((await db.collection("asociaciones").get()).size, 0);
});

test("repeticiones concurrentes de la misma solicitud crean un registro y evento", async () => {
  const datos = {solicitudId: randomUUID(), nombre: "Concurrente"};
  const respuestas = await Promise.all(Array.from({length: 3}, () =>
    operaciones.crearCategoria({token: token(), datos})));
  assert.equal(new Set(respuestas.map((r) => r.elementoId)).size, 1);
  assert.equal(new Set(respuestas.map((r) => r.operacionId)).size, 1);
  assert.equal((await db.collection("categorias").get()).size, 1);
  assert.equal((await db.collection("auditoria_administrativa").get()).size, 1);
  await assert.rejects(operaciones.crearCategoria({token: token(),
    datos: {...datos, nombre: "Otro contenido"}}), {codigo: "already-exists"});
});

test("altas concurrentes con nombres equivalentes no duplican documentos", async () => {
  const respuestas = await Promise.allSettled([
    ejecutar("crearCategoria", {nombre: "Categoría"}),
    ejecutar("crearCategoria", {nombre: "categoria"}),
  ]);
  assert.equal(respuestas.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await db.collection("categorias").get()).size, 1);
  const eventos = await db.collection("auditoria_administrativa").get();
  assert.equal(eventos.docs.filter((d) => d.data().resultado === "exito").length, 1);
  assert.equal(eventos.docs.filter((d) => d.data().resultado === "rechazado").length, 1);
});

test("edición y estado concurrentes conservan ambos cambios", async () => {
  const creado = await ejecutar("crearCategoria", {nombre: "Original"});
  await Promise.all([
    ejecutar("editarCategoria", {id: creado.elementoId, nombre: "Editada"}),
    ejecutar("cambiarEstadoCategoria", {id: creado.elementoId, estado: "Inactiva"}),
  ]);
  assert.deepEqual((await db.doc(`categorias/${creado.elementoId}`).get()).data(),
      {nombre: "Editada", estado: "Inactiva"});
  assert.equal((await db.collection("auditoria_administrativa").get()).size, 3);
});

test("fallo de escritura en documento o auditoría revierte toda la transacción", async () => {
  for (const coleccionFallida of ["categorias", "auditoria_administrativa"]) {
    const dbFallida = {collection: (...args) => db.collection(...args),
      runTransaction: (callback) => db.runTransaction((tx) => callback(new Proxy(tx, {
        get(target, propiedad) {
          if (propiedad === "create") {
            return (ref, datos) => {
              if (ref.parent.id === coleccionFallida) {
                throw new Error("Fallo simulado");
              }
              return target.create(ref, datos);
            };
          }
          const valor = target[propiedad];
          return typeof valor === "function" ? valor.bind(target) : valor;
        },
      })))};
    const servicio = crearOperacionesCatalogos({auth, db: dbFallida,
      fechaServidor: () => FieldValue.serverTimestamp()});
    await assert.rejects(servicio.crearCategoria({token: token(),
      datos: {solicitudId: randomUUID(), nombre: "No debe persistir"}}),
    {codigo: "unavailable"});
    assert.equal((await db.collection("categorias").get()).size, 0);
    assert.equal((await db.collection("auditoria_administrativa").get()).size, 0);
  }
});

test("sin cambios o destino inexistente se rechaza sin inventar éxitos", async () => {
  const creado = await ejecutar("crearCategoria", {nombre: "Original"});
  await assert.rejects(ejecutar("editarCategoria", {id: creado.elementoId,
    nombre: "Original"}), {codigo: "failed-precondition"});
  await assert.rejects(ejecutar("cambiarEstadoCategoria", {id: "inexistente",
    estado: "Inactiva"}), {codigo: "not-found"});
  const eventos = await db.collection("auditoria_administrativa").get();
  assert.equal(eventos.docs.filter((d) => d.data().resultado === "exito").length, 1);
  assert.equal(eventos.docs.filter((d) => d.data().resultado === "rechazado").length, 2);
});
