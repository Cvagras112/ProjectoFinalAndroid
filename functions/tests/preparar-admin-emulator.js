"use strict";

const admin = require("firebase-admin");

const PROYECTO = "demo-bora-admin";
const AUTH_HOST = "127.0.0.1:9099";
const FIRESTORE_HOST = "127.0.0.1:8087";

process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.GCLOUD_PROJECT = PROYECTO;

admin.initializeApp({projectId: PROYECTO});

const auth = admin.auth();
const db = admin.firestore();

const usuarios = [
  {
    uid: "admin-prueba-1",
    email: "admin1@example.com",
    password: "PruebaAdmin2026A!",
  },
  {
    uid: "admin-prueba-2",
    email: "admin2@example.com",
    password: "PruebaAdmin2026B!",
  },
];

/**
 * Prepara las cuentas y los perfiles administrativos del emulador.
 * @return {Promise<void>} Finalización de la preparación.
 */
async function ejecutar() {
  for (const usuario of usuarios) {
    try {
      await auth.createUser(usuario);
    } catch (error) {
      if (error.code !== "auth/uid-already-exists") {
        throw error;
      }
    }

    await db.collection("usuarios").doc(usuario.uid).set({
      rol: "administrador",
      activo: true,
      email: usuario.email,
    });

    console.log("Administrador preparado:", usuario.uid);
  }

  console.log("Usuarios de prueba preparados correctamente.");
}

ejecutar()
    .catch((error) => {
      console.error("ERROR:", error.message);
      process.exitCode = 1;
    })
    .finally(() => admin.app().delete());
