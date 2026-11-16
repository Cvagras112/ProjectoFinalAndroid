"use strict";
/* eslint max-len: ["error", {"code": 100}] */
const {test, before, after, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {randomUUID} = require("node:crypto");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {createMockUserToken} = require("../../web/node_modules/@firebase/util");
const {initializeTestEnvironment, assertFails, assertSucceeds} =
  require("../../web/node_modules/@firebase/rules-unit-testing");
const web = require("../../web/node_modules/firebase/firestore");
const {crearOperacionesAsignacionesEmprendedoras} = require("../asignacionesEmprendedoras");
const projectId = "demo-bora-emprendedoras-2b";
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8087") {
  throw new Error("Se requieren Auth y Firestore Emulator locales.");
}
let app; let db; let env; let auth; let operaciones;
const token = (uid = "admin") => createMockUserToken({sub: uid,
  iat: Math.floor(Date.now() / 1000), auth_time: Math.floor(Date.now() / 1000)}, projectId);
const llamar = (nombre, datos, uid = "admin") => operaciones[nombre]({token: token(uid),
  datos: {solicitudId: randomUUID(), ...datos}});
const usuario = {ID: "emp", nombre: "Original", email: "emp@example.test",
  rol: "emprendedor", activo: true};
const perfil = {nombre: "Original", telefono: "912345678", activo: true,
  ID_Tienda: "tienda", descripcion: "Original", direccion: "Original"};
const tienda = {ID_Dueno: "emp", activo: true, nombre: "Tienda"};
const leer = async (path) => (await db.doc(path).get()).data();
const exitos = async () => (await db.collection("auditoria_administrativa").get())
    .docs.map((d) => d.data()).filter((d) => d.resultado === "exito");

before(async () => {
  web.setLogLevel("silent");
  app = admin.initializeApp({projectId}, "asignaciones-2b-tests");
  db = app.firestore(); auth = app.auth();
  env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1",
    port: 8087, rules: readFileSync(join(__dirname, "../../firestore.rules"), "utf8")}});
  for (const uid of ["admin", "inactivo", "emp", "comprador", "sin-perfil"]) {
    try {
      await auth.createUser({uid});
    } catch (error) {
      if (error.code !== "auth/uid-already-exists") throw error;
    }
  }
  operaciones = crearOperacionesAsignacionesEmprendedoras({auth, db,
    fechaServidor: () => FieldValue.serverTimestamp()});
});
beforeEach(async () => {
  await env.clearFirestore();
  const batch = db.batch();
  batch.set(db.doc("usuarios/admin"), {rol: "administrador", activo: true});
  batch.set(db.doc("usuarios/admin2"), {rol: "administrador", activo: true});
  batch.set(db.doc("usuarios/inactivo"), {rol: "administrador", activo: false});
  batch.set(db.doc("usuarios/comprador"), {rol: "comprador", activo: true});
  batch.set(db.doc("usuarios/emp"), usuario);
  batch.set(db.doc("emprendedores/emp"), perfil);
  batch.set(db.doc("tiendas/tienda"), tienda);
  for (const id of ["asoc1", "asoc2"]) {
    batch.set(db.doc(`asociaciones/${id}`), {nombre: id, estado: "Activa"});
  }
  await batch.commit();
});
after(async () => {
  await env?.cleanup();
  await app?.delete();
});

test("asignacion: crear, reemplazar y eliminar generan eventos reales", async () => {
  const crear = await llamar("guardarAsignacionAdministrativa", {id: "emp", asociacionId: "asoc1"});
  const cambiar = await llamar("guardarAsignacionAdministrativa",
      {id: "emp", asociacionId: "asoc2"});
  assert.deepEqual(await leer("asignaciones/emp"), {emprendedoraId: "emp", asociacionId: "asoc2"});
  const quitar = await llamar("quitarAsignacionAdministrativa", {id: "emp"});
  assert.equal(await leer("asignaciones/emp"), undefined);
  for (const [r, accion] of [[crear, "crear"], [cambiar, "reemplazar"], [quitar, "eliminar"]]) {
    const evento = await leer(`auditoria_administrativa/${r.operacionId}`);
    assert.equal(evento.accion, `asignacion.${accion}`);
    assert.equal(evento.actorUid, "admin"); assert.equal(evento.elementoId, "emp");
    assert.equal(evento.elementoTipo, "asignacion"); assert.equal(evento.resultado, "exito");
    assert.ok(evento.fecha.toDate() instanceof Date);
  }
});

test("edicion conserva contrato: solo nombre y telefono del perfil", async () => {
  const r = await llamar("editarPerfilEmprendedoraAdministrativa",
      {id: "emp", nombre: "  Editada  ", telefono: " 987654321 "});
  assert.deepEqual(await leer("emprendedores/emp"),
      {...perfil, nombre: "Editada", telefono: "987654321"});
  assert.deepEqual(await leer("usuarios/emp"), usuario);
  assert.deepEqual(await leer("tiendas/tienda"), tienda);
  const evento = await leer(`auditoria_administrativa/${r.operacionId}`);
  assert.equal(evento.accion, "emprendedora.editar");
  assert.ok(!JSON.stringify(evento).includes("987654321"));
  assert.ok(!JSON.stringify(evento).includes("Editada"));
});

test("activar y desactivar sincroniza dos documentos sin tocar tienda", async () => {
  for (const activo of [false, true]) {
    const r = await llamar("cambiarEstadoEmprendedoraAdministrativa", {id: "emp", activo});
    assert.equal((await leer("usuarios/emp")).activo, activo);
    assert.equal((await leer("emprendedores/emp")).activo, activo);
    assert.deepEqual(await leer("tiendas/tienda"), tienda);
    assert.equal((await leer(`auditoria_administrativa/${r.operacionId}`)).accion,
        `emprendedora.${activo ? "activar" : "desactivar"}`);
  }
  await db.doc("emprendedores/emp").update({activo: false});
  await llamar("cambiarEstadoEmprendedoraAdministrativa", {id: "emp", activo: true});
  assert.equal((await leer("emprendedores/emp")).activo, true);
});

test("todos los endpoints rechazan roles sin permiso y tokens invalidos", async () => {
  const solicitudes = [["guardarAsignacionAdministrativa", {id: "emp", asociacionId: "asoc1"}],
    ["quitarAsignacionAdministrativa", {id: "emp"}],
    ["editarPerfilEmprendedoraAdministrativa", {id: "emp", nombre: "Cambio", telefono: ""}],
    ["cambiarEstadoEmprendedoraAdministrativa", {id: "emp", activo: false}]];
  for (const [op, datos] of solicitudes) {
    for (const uid of ["inactivo", "emp", "comprador", "sin-perfil"]) {
      await assert.rejects(llamar(op, datos, uid), {codigo: "permission-denied"});
    }
    await assert.rejects(operaciones[op]({token: "invalido", datos}), {codigo: "unauthenticated"});
  }
  assert.equal((await exitos()).length, 0);
  assert.deepEqual(await leer("usuarios/emp"), usuario);
});

test("valida campos, rutas, telefono, nombre y estado sin aceptar roles", async () => {
  for (const datos of [{id: "emp", nombre: "ab", telefono: ""},
    {id: "emp", nombre: "x".repeat(101), telefono: ""},
    {id: "emp", nombre: "Cambio", telefono: "123"},
    {id: "emp", nombre: "Cambio", telefono: "+56912345678"},
    {id: "emp", nombre: "Cambio", telefono: "", rol: "emprendedor"},
    {id: "usuarios/admin", nombre: "Cambio", telefono: ""}]) {
    await assert.rejects(llamar("editarPerfilEmprendedoraAdministrativa", datos),
        {codigo: "invalid-argument"});
  }
  await assert.rejects(llamar("guardarAsignacionAdministrativa", {id: "emp", asociacionId: "a/b"}));
  await assert.rejects(llamar("cambiarEstadoEmprendedoraAdministrativa",
      {id: "emp", activo: "false"}));
  assert.deepEqual(await leer("emprendedores/emp"), perfil);
  assert.equal((await exitos()).length, 0);
});

test("asignacion exige cuenta, perfil y asociacion activos", async () => {
  for (const [path, cambio] of [["usuarios/emp", {activo: false}],
    ["emprendedores/emp", {activo: false}], ["asociaciones/asoc1", {estado: "Inactiva"}]]) {
    const antes = await leer(path); await db.doc(path).update(cambio);
    await assert.rejects(llamar("guardarAsignacionAdministrativa",
        {id: "emp", asociacionId: "asoc1"}), {codigo: "failed-precondition"});
    await db.doc(path).set(antes);
  }
  await assert.rejects(llamar("guardarAsignacionAdministrativa",
      {id: "emp", asociacionId: "ausente"}));
  await db.doc("emprendedores/emp").delete();
  await assert.rejects(llamar("guardarAsignacionAdministrativa",
      {id: "emp", asociacionId: "asoc1"}));
  assert.equal(await leer("asignaciones/emp"), undefined);
});

test("puede desvincular un registro huerfano sin exigir perfil activo", async () => {
  await db.doc("asignaciones/huerfana").set({emprendedoraId: "huerfana", asociacionId: "ausente"});
  await llamar("quitarAsignacionAdministrativa", {id: "huerfana"});
  assert.equal(await leer("asignaciones/huerfana"), undefined);
  assert.equal((await exitos()).length, 1);
});

test("repeticion concurrente usa una modificacion y un evento", async () => {
  const datos = {id: "emp", asociacionId: "asoc1", solicitudId: randomUUID()};
  const respuestas = await Promise.all(Array.from({length: 3}, () =>
    operaciones.guardarAsignacionAdministrativa({token: token(), datos})));
  assert.equal(new Set(respuestas.map((r) => r.operacionId)).size, 1);
  assert.equal((await exitos()).length, 1);
  await assert.rejects(operaciones.guardarAsignacionAdministrativa({token: token(),
    datos: {...datos, asociacionId: "asoc2"}}), {codigo: "already-exists"});
});

test("asignaciones concurrentes diferentes preservan un vinculo y dos eventos", async () => {
  await Promise.all(["asoc1", "asoc2"].map((asociacionId) =>
    llamar("guardarAsignacionAdministrativa", {id: "emp", asociacionId})));
  const eventos = await exitos();
  assert.equal(eventos.length, 2);
  assert.deepEqual(eventos.map((e) => e.accion).sort(),
      ["asignacion.crear", "asignacion.reemplazar"]);
  assert.equal((await db.collection("asignaciones").get()).size, 1);
});

test("edicion y desactivacion concurrentes no pierden campos", async () => {
  await Promise.all([
    llamar("editarPerfilEmprendedoraAdministrativa", {id: "emp", nombre: "Editada", telefono: ""}),
    llamar("cambiarEstadoEmprendedoraAdministrativa", {id: "emp", activo: false}),
  ]);
  assert.deepEqual(await leer("emprendedores/emp"),
      {...perfil, nombre: "Editada", telefono: "", activo: false});
  assert.equal((await leer("usuarios/emp")).activo, false);
  assert.equal((await exitos()).length, 2);
});

test("fallos de auditoria o segunda escritura revierten toda la operacion", async () => {
  for (const bloqueo of ["auditoria_administrativa", "emprendedores"]) {
    const dbFallida = {doc: (...args) => db.doc(...args),
      collection: (...args) => db.collection(...args),
      runTransaction: (callback) => db.runTransaction((tx) => callback(new Proxy(tx, {
        get(target, propiedad) {
          if (["create", "update"].includes(propiedad)) {
            return (ref, datos) => {
              if (ref.parent.id === bloqueo) throw new Error("Fallo simulado");
              return target[propiedad](ref, datos);
            };
          }
          const valor = target[propiedad];
          return typeof valor === "function" ? valor.bind(target) : valor;
        },
      })))};
    const servicio = crearOperacionesAsignacionesEmprendedoras({auth, db: dbFallida,
      fechaServidor: () => FieldValue.serverTimestamp()});
    await assert.rejects(servicio.cambiarEstadoEmprendedoraAdministrativa({token: token(),
      datos: {id: "emp", activo: false, solicitudId: randomUUID()}}), {codigo: "unavailable"});
    assert.deepEqual(await leer("usuarios/emp"), usuario);
    assert.deepEqual(await leer("emprendedores/emp"), perfil);
    assert.equal((await exitos()).length, 0);
  }
});

test("reglas impiden todas las escrituras directas equivalentes", async () => {
  const cliente = env.authenticatedContext("admin").firestore();
  const asig = web.doc(cliente, "asignaciones/emp");
  await assertFails(web.setDoc(asig, {emprendedoraId: "emp", asociacionId: "asoc1"}));
  await db.doc("asignaciones/emp").set({emprendedoraId: "emp", asociacionId: "asoc1"});
  await assertFails(web.updateDoc(asig, {asociacionId: "asoc2"}));
  await assertFails(web.deleteDoc(asig));
  for (const cambio of [{nombre: "Cambio"}, {telefono: "987654321"}, {activo: false}]) {
    await assertFails(web.updateDoc(web.doc(cliente, "emprendedores/emp"), cambio));
  }
  await assertFails(web.updateDoc(web.doc(cliente, "usuarios/emp"), {activo: false}));
  await assertFails(web.deleteDoc(web.doc(cliente, "emprendedores/emp")));
  const lote = web.writeBatch(cliente);
  lote.update(web.doc(cliente, "usuarios/emp"), {activo: false});
  lote.update(web.doc(cliente, "emprendedores/emp"), {activo: false});
  await assertFails(lote.commit());
  await assertSucceeds(web.getDocs(web.collection(cliente, "asignaciones")));
  await assertSucceeds(web.getDocs(web.collection(cliente, "emprendedores")));
});

test("conserva permisos W23 y descripcion/direccion fuera de alcance", async () => {
  const cliente = env.authenticatedContext("admin").firestore();
  await assertFails(web.updateDoc(web.doc(cliente, "usuarios/admin2"), {activo: false}));
  await assertSucceeds(web.updateDoc(web.doc(cliente, "usuarios/comprador"), {activo: false}));
  await assertFails(web.updateDoc(web.doc(cliente, "usuarios/admin"), {activo: false}));
  await assertSucceeds(web.updateDoc(web.doc(cliente, "emprendedores/emp"),
      {descripcion: "Nueva", direccion: "Nueva"}));
  await assertFails(web.updateDoc(web.doc(cliente, "emprendedores/emp"),
      {descripcion: "Nueva", nombre: "Otro"}));
});

test("registro comprador y alta atomica de emprendedora/tienda siguen permitidos", async () => {
  const comprador = env.authenticatedContext("registro",
      {email: "r@example.test", email_verified: true}).firestore();
  await assertSucceeds(web.setDoc(web.doc(comprador, "usuarios/registro"),
      {ID: "registro", nombre: "Comprador", email: "r@example.test",
        rol: "comprador", activo: true}));
  const cliente = env.authenticatedContext("admin").firestore();
  const batch = web.writeBatch(cliente);
  batch.set(web.doc(cliente, "usuarios/nueva"), {...usuario, ID: "nueva"});
  batch.set(web.doc(cliente, "emprendedores/nueva"), {...perfil, ID_Tienda: "nueva"});
  batch.set(web.doc(cliente, "tiendas/nueva"), {ID_Dueno: "nueva", activo: true,
    nombre: "Nueva tienda", categoria: "Artesania", descripcion: "", sector: "",
    telefono: "", whatsapp: "", emailContacto: "emp@example.test", imagen: ""});
  await assertSucceeds(batch.commit());
});

test("estados y ediciones rechazan destinos incompatibles y no generan falsos exitos", async () => {
  await assert.rejects(llamar("cambiarEstadoEmprendedoraAdministrativa",
      {id: "admin2", activo: false}));
  await assert.rejects(llamar("editarPerfilEmprendedoraAdministrativa",
      {id: "ausente", nombre: "Cambio", telefono: ""}));
  await assert.rejects(llamar("cambiarEstadoEmprendedoraAdministrativa",
      {id: "emp", activo: true}));
  await assert.rejects(llamar("editarPerfilEmprendedoraAdministrativa",
      {id: "emp", nombre: perfil.nombre, telefono: perfil.telefono}));
  await assert.rejects(llamar("quitarAsignacionAdministrativa", {id: "ausente"}));
  assert.equal((await exitos()).length, 0);
});
