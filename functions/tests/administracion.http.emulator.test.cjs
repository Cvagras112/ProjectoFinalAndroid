"use strict";
/* eslint max-len: ["error", {"code": 100}] */
const {test, before, after} = require("node:test");
const assert = require("node:assert/strict");
const {randomUUID} = require("node:crypto");
const admin = require("firebase-admin");
const PROYECTO = "demo-bora-admin";
if (process.env.GCLOUD_PROJECT !== PROYECTO ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8087") {
  throw new Error("Solo Emulator local y GCLOUD_PROJECT=demo-bora-admin.");
}
const run = randomUUID().slice(0, 8);
const clave = "QaFinal2026!Inicial";
const nuevaClave = "QaFinal2026!Cambiada";
const fixtures = {};
let app; let db; let auth; let destino;
const login = async (email, password) => {
  const respuesta = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/" +
    "accounts:signInWithPassword?key=fake-api-key", {method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email, password, returnSecureToken: true})});
  const datos = await respuesta.json();
  return {ok: respuesta.ok, token: datos.idToken};
};
const rpc = async (nombre, data, token = fixtures.actor.token) => {
  const respuesta = await fetch(`http://127.0.0.1:5001/${PROYECTO}/us-central1/${nombre}`,
      {method: "POST", headers: {"Content-Type": "application/json",
        ...(token ? {Authorization: `Bearer ${token}`} : {})},
      body: JSON.stringify({data})});
  return {status: respuesta.status, body: await respuesta.json()};
};
const exito = async (respuesta, accion) => {
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.result?.resultado, "exito");
  const id = respuesta.body.result.operacionId;
  assert.equal(typeof id, "string");
  const doc = await db.doc(`auditoria_administrativa/${id}`).get();
  assert.equal(doc.exists, true);
  const evento = doc.data();
  assert.equal(evento.accion, accion);
  assert.equal(evento.actorUid, fixtures.actor.uid);
  assert.equal(evento.resultado, "exito");
  assert.equal(evento.elementoTipo, "administrador");
  assert.equal(evento.elementoId, evento.destinatarioUid);
  assert.ok(evento.fecha.toDate() instanceof Date);
  assert.ok(!JSON.stringify(evento).includes(clave));
  assert.ok(!JSON.stringify(evento).includes(nuevaClave));
  assert.ok(!("password" in respuesta.body.result));
  return respuesta.body.result;
};

before(async () => {
  const hub = await (await fetch("http://127.0.0.1:4400/emulators")).json();
  assert.equal(hub.auth.port, 9099); assert.equal(hub.firestore.port, 8087);
  assert.equal(hub.functions.port, 5001);
  app = admin.initializeApp({projectId: PROYECTO}, `http-final-${run}`);
  auth = app.auth(); db = app.firestore();
  for (const [nombre, rol, activo] of [["actor", "administrador", true],
    ["inactivo", "administrador", false], ["emprendedor", "emprendedor", true],
    ["revocado", "administrador", true]]) {
    const uid = `qa-final-${nombre}-${run}`;
    const email = `${uid}@example.test`;
    await auth.createUser({uid, email, password: clave});
    await db.doc(`usuarios/${uid}`).create({ID: uid, nombre: `QA ${nombre}`,
      email, rol, activo});
    const sesion = await login(email, clave);
    assert.equal(sesion.ok, true);
    fixtures[nombre] = {uid, email, token: sesion.token};
  }
});
after(async () => {
  await app?.delete();
});

test("HTTP real: crea Authentication, perfil y evento; conserva sesion del actor", async () => {
  const email = `qa-final-destino-${run}@example.test`;
  const r = await rpc("crearAdministradorConAuditoria", {nombre: "  QA Destino  ",
    email: email.toUpperCase(), password: clave});
  const result = await exito(r, "administrador.crear");
  destino = {uid: result.uid, email};
  const perfil = (await db.doc(`usuarios/${destino.uid}`).get()).data();
  assert.deepEqual(perfil, {ID: destino.uid, nombre: "QA Destino", email,
    rol: "administrador", activo: true});
  assert.equal((await auth.getUser(destino.uid)).email, email);
  assert.equal((await login(email, clave)).ok, true);
  assert.equal((await auth.verifyIdToken(fixtures.actor.token, true)).uid, fixtures.actor.uid);
});

test("HTTP real: edita nombre maximo preservando rol y correo", async () => {
  const r = await rpc("operarAdministradorAuditado", {accion: "editar",
    uid: destino.uid, nombre: ` ${"a".repeat(150)} `});
  await exito(r, "administrador.editar");
  const perfil = (await db.doc(`usuarios/${destino.uid}`).get()).data();
  assert.equal(perfil.nombre.length, 150);
  assert.equal(perfil.rol, "administrador"); assert.equal(perfil.email, destino.email);
});

test("HTTP real: desactiva y reactiva con eventos confirmados", async () => {
  for (const accion of ["desactivar", "activar"]) {
    await exito(await rpc("operarAdministradorAuditado", {accion, uid: destino.uid}),
        `administrador.${accion}`);
    assert.equal((await db.doc(`usuarios/${destino.uid}`).get()).data().activo,
        accion === "activar");
  }
});

test("HTTP real: edicion y estado concurrentes conservan ambos resultados", async () => {
  const respuestas = await Promise.all([
    rpc("operarAdministradorAuditado", {accion: "editar", uid: destino.uid, nombre: "Concurrente"}),
    rpc("operarAdministradorAuditado", {accion: "desactivar", uid: destino.uid}),
  ]);
  await exito(respuestas[0], "administrador.editar");
  await exito(respuestas[1], "administrador.desactivar");
  const datos = (await db.doc(`usuarios/${destino.uid}`).get()).data();
  assert.equal(datos.nombre, "Concurrente"); assert.equal(datos.activo, false);
  await exito(await rpc("operarAdministradorAuditado", {accion: "activar", uid: destino.uid}),
      "administrador.activar");
});

test("HTTP real: cambia password y registra dos eventos correlacionados", async () => {
  const r = await rpc("cambiarPasswordAdministrador", {uid: destino.uid, password: nuevaClave});
  assert.equal(r.status, 200); assert.equal(r.body.result.resultado, "exito");
  const registros = await db.collection("auditoria_administrativa")
      .where("operacionId", "==", r.body.result.operacionId).get();
  assert.equal(registros.size, 2);
  assert.deepEqual(registros.docs.map((d) => d.data().fase).sort(), ["intento", "resultado"]);
  for (const doc of registros.docs) {
    assert.equal(doc.data().actorUid, fixtures.actor.uid);
    assert.ok(!JSON.stringify(doc.data()).includes(nuevaClave));
  }
  assert.equal((await login(destino.email, nuevaClave)).ok, true);
  assert.equal((await login(destino.email, clave)).ok, false);
});

test("HTTP real: nombres y correos no textuales se rechazan sin crear cuentas", async () => {
  const email = `qa-final-invalido-${run}@example.test`;
  for (const datos of [{nombre: 7, email, password: clave},
    {nombre: "Valido", email: 7, password: clave},
    {nombre: "Valido", email, password: " ".repeat(8)},
    {nombre: "Valido", email, password: clave, rol: "administrador"}]) {
    const r = await rpc("crearAdministradorConAuditoria", datos);
    assert.equal(r.body.error?.status, "INVALID_ARGUMENT");
  }
  await assert.rejects(auth.getUserByEmail(email), {code: "auth/user-not-found"});
});

test("HTTP real: rechaza campos protegidos, autoedicion y propia password", async () => {
  for (const datos of [{accion: "editar", uid: destino.uid, nombre: "Cambio", rol: "comprador"},
    {accion: "activar", uid: destino.uid, email: "otro@example.test"},
    {accion: "editar", uid: fixtures.actor.uid, nombre: "Propio"}]) {
    const r = await rpc("operarAdministradorAuditado", datos);
    assert.equal(r.body.error?.status, "INVALID_ARGUMENT");
  }
  const propio = await rpc("cambiarPasswordAdministrador",
      {uid: fixtures.actor.uid, password: nuevaClave});
  assert.equal(propio.body.error?.status, "PERMISSION_DENIED");
});

test("HTTP real: niega permisos a inactivo, emprendedor y visitante", async () => {
  for (const actor of ["inactivo", "emprendedor"]) {
    for (const [fn, datos] of [["operarAdministradorAuditado",
      {accion: "editar", uid: destino.uid, nombre: "No permitido"}],
    ["crearAdministradorConAuditoria", {nombre: "No permitido",
      email: `bloqueado-${run}@example.test`, password: clave}],
    ["cambiarPasswordAdministrador", {uid: destino.uid, password: nuevaClave}]]) {
      assert.equal((await rpc(fn, datos, fixtures[actor].token)).body.error?.status,
          "PERMISSION_DENIED");
    }
  }
  for (const fn of ["operarAdministradorAuditado", "crearAdministradorConAuditoria",
    "cambiarPasswordAdministrador"]) {
    assert.equal((await rpc(fn, {}, "")).body.error?.status, "UNAUTHENTICATED");
  }
});

test("REST Firestore real: lectura autorizada y mutaciones directas prohibidas", async () => {
  const base = `http://127.0.0.1:8087/v1/projects/${PROYECTO}/databases/(default)/documents`;
  const headers = {"Authorization": `Bearer ${fixtures.actor.token}`,
    "Content-Type": "application/json"};
  assert.equal((await fetch(`${base}/usuarios`, {headers})).status, 200);
  for (const [ruta, method, body] of [
    [`usuarios/${destino.uid}?updateMask.fieldPaths=nombre`, "PATCH",
      {fields: {nombre: {stringValue: "Sin auditoria"}}}],
    [`usuarios?documentId=qa-final-directo-${run}`, "POST",
      {fields: {rol: {stringValue: "administrador"}}}],
    [`usuarios/${destino.uid}`, "DELETE", null],
    [`auditoria_administrativa?documentId=qa-final-directo-${run}`, "POST",
      {fields: {resultado: {stringValue: "falso"}}}],
  ]) {
    const r = await fetch(`${base}/${ruta}`, {method, headers,
      ...(body ? {body: JSON.stringify(body)} : {})});
    assert.equal(r.status, 403);
  }
});

test("HTTP real: revocacion de token bloquea las tres funciones administrativas", async () => {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await auth.revokeRefreshTokens(fixtures.revocado.uid);
  for (const [nombre, datos] of [["operarAdministradorAuditado",
    {accion: "editar", uid: destino.uid, nombre: "No permitido"}],
  ["crearAdministradorConAuditoria", {nombre: "No permitido",
    email: `revocado-${run}@example.test`, password: clave}],
  ["cambiarPasswordAdministrador", {uid: destino.uid, password: nuevaClave}]]) {
    const r = await rpc(nombre, datos, fixtures.revocado.token);
    assert.equal(r.body.error?.status, "UNAUTHENTICATED");
  }
});
