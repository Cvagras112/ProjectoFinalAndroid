"use strict";

const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const proyecto = "demo-bora-admin";

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8087";
process.env.GCLOUD_PROJECT = proyecto;

admin.initializeApp({projectId: proyecto});

const auth = admin.auth();
const db = admin.firestore();

const urlAuth =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key";

const urlFuncion =
  `http://127.0.0.1:5001/${proyecto}/us-central1/cambiarPasswordAdministrador`;

/**
 * Prepara una cuenta y su perfil para las pruebas del emulador.
 * @param {string} uid Identificador de la cuenta de prueba.
 * @param {string} email Correo de la cuenta de prueba.
 * @param {string} password Contraseña de la cuenta de prueba.
 * @param {string} rol Rol del perfil de prueba.
 * @param {boolean} activo Estado del perfil de prueba.
 * @return {Promise<void>} Finalización de la preparación.
 */
async function prepararUsuario(uid, email, password, rol, activo) {
  try {
    await auth.createUser({uid, email, password});
  } catch (error) {
    if (error.code !== "auth/uid-already-exists") throw error;
    await auth.updateUser(uid, {password});
  }

  await db.collection("usuarios").doc(uid).set({
    email,
    rol,
    activo,
  });
}

/**
 * Inicia una sesión mediante Authentication Emulator.
 * @param {string} email Correo de la cuenta de prueba.
 * @param {string} password Contraseña de la cuenta de prueba.
 * @return {Promise<string>} Token de la sesión de prueba.
 */
async function iniciarSesion(email, password) {
  const respuesta = await fetch(urlAuth, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(`No se pudo iniciar sesion: ${JSON.stringify(datos)}`);
  }

  return datos.idToken;
}

/**
 * Envía la solicitud existente de cambio de contraseña al emulador.
 * @param {?string} token Token de prueba o ausencia de autenticación.
 * @param {string} uid Identificador de la cuenta destinataria.
 * @param {string} password Contraseña propuesta por el caso de prueba.
 * @return {Promise<object>} Estado y datos de la respuesta.
 */
async function solicitarCambio(token, uid, password) {
  const headers = {"Content-Type": "application/json"};

  if (token) headers.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(urlFuncion, {
    method: "POST",
    headers,
    body: JSON.stringify({data: {uid, password}}),
  });

  return {
    ok: respuesta.ok,
    datos: await respuesta.json(),
  };
}

/**
 * Ejecuta los casos existentes de seguridad en los emuladores.
 * @return {Promise<void>} Finalización de las comprobaciones.
 */
async function ejecutar() {
  const destino = {
    uid: "admin-seguridad-destino",
    email: "admin-seguridad-destino@example.com",
    password: "ClaveOriginal2026!",
  };

  await prepararUsuario(
      destino.uid, destino.email, destino.password,
      "administrador", true,
  );

  await prepararUsuario(
      "emprendedor-seguridad",
      "emprendedor-seguridad@example.com",
      "ClaveEmprendedor2026!",
      "emprendedor", true,
  );

  await prepararUsuario(
      "admin-inactivo-seguridad",
      "admin-inactivo-seguridad@example.com",
      "ClaveInactivo2026!",
      "administrador", false,
  );

  await prepararUsuario(
      "admin-activo-seguridad",
      "admin-activo-seguridad@example.com",
      "ClaveActivo2026!",
      "administrador", true,
  );

  const tokenEmprendedor = await iniciarSesion(
      "emprendedor-seguridad@example.com",
      "ClaveEmprendedor2026!",
  );

  const tokenInactivo = await iniciarSesion(
      "admin-inactivo-seguridad@example.com",
      "ClaveInactivo2026!",
  );

  const tokenActivo = await iniciarSesion(
      "admin-activo-seguridad@example.com",
      "ClaveActivo2026!",
  );

  const casos = [
    {
      nombre: "Emprendedor sin permisos",
      token: tokenEmprendedor,
      uid: destino.uid,
      password: "IntentoEmprendedor2026!",
    },
    {
      nombre: "Administrador desactivado",
      token: tokenInactivo,
      uid: destino.uid,
      password: "IntentoInactivo2026!",
    },
    {
      nombre: "Cambio de contraseña propia",
      token: tokenActivo,
      uid: "admin-activo-seguridad",
      password: "IntentoPropio2026!",
    },
    {
      nombre: "Contraseña demasiado corta",
      token: tokenActivo,
      uid: destino.uid,
      password: "123",
    },
    {
      nombre: "Solicitud sin autenticación",
      token: null,
      uid: destino.uid,
      password: "IntentoSinToken2026!",
    },
  ];

  for (const caso of casos) {
    const resultado = await solicitarCambio(
        caso.token, caso.uid, caso.password,
    );

    assert.equal(
        resultado.ok,
        false,
        `${caso.nombre}: la solicitud debio ser rechazada.`,
    );

    console.log("APROBADO:", caso.nombre);
  }

  await iniciarSesion(destino.email, destino.password);

  await iniciarSesion(
      "admin-activo-seguridad@example.com",
      "ClaveActivo2026!",
  );

  console.log("APROBADO: las contraseñas originales siguen funcionando.");
  console.log("PRUEBAS DE SEGURIDAD APROBADAS.");
}

ejecutar()
    .catch((error) => {
      console.error("PRUEBA FALLIDA:", error.message);
      process.exitCode = 1;
    })
    .finally(() => admin.app().delete());
