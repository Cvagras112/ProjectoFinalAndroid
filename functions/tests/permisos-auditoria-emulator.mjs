import assert from "node:assert/strict";
import {createRequire} from "node:module";

const require = createRequire(
  new URL("../../web/package.json", import.meta.url)
);

const {initializeApp, deleteApp} = require("firebase/app");
const {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
} = require("firebase/auth");
const {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} = require("firebase/firestore");

const app = initializeApp({
  apiKey: "fake-api-key",
  authDomain: "demo-bora-admin.firebaseapp.com",
  projectId: "demo-bora-admin",
}, "prueba-permisos-auditoria");

const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, "http://127.0.0.1:9099", {
  disableWarnings: true,
});
connectFirestoreEmulator(db, "127.0.0.1", 8087);

const auditoria = collection(db, "auditoria_administrativa");
const registro = doc(auditoria, "prueba-cliente-no-autorizada");

async function verificarDenegado(nombre, operacion) {
  let rechazado = false;

  try {
    await operacion();
  } catch (error) {
    assert.equal(
      error.code,
      "permission-denied",
      `${nombre}: error inesperado: ${error.code || error.message}`
    );
    rechazado = true;
  }

  assert.ok(rechazado, `${nombre}: debio ser denegado.`);
  console.log("APROBADO:", nombre);
}

async function ejecutar() {
  await verificarDenegado(
    "Usuario sin sesion no puede leer auditoria",
    () => getDocs(auditoria)
  );

  await signInWithEmailAndPassword(
    auth,
    "admin1@example.com",
    "PruebaAdmin2026A!"
  );

  await getDocs(auditoria);
  console.log("APROBADO: administrador activo puede consultar auditoria");

  await verificarDenegado(
    "Administrador no puede crear auditoria",
    () => setDoc(registro, {resultado: "falso"})
  );

  await verificarDenegado(
    "Administrador no puede modificar auditoria",
    () => updateDoc(registro, {resultado: "alterado"})
  );

  await verificarDenegado(
    "Administrador no puede eliminar auditoria",
    () => deleteDoc(registro)
  );

  await signOut(auth);

  await signInWithEmailAndPassword(
    auth,
    "emprendedor-auditoria@example.com",
    "PruebaEmprendedor2026!"
  );

  await verificarDenegado(
    "Emprendedor no puede consultar auditoria",
    () => getDocs(auditoria)
  );

  await signOut(auth);

  await signInWithEmailAndPassword(
    auth,
    "admin-inactivo-auditoria@example.com",
    "PruebaInactivo2026!"
  );

  await verificarDenegado(
    "Administrador desactivado no puede consultar auditoria",
    () => getDocs(auditoria)
  );

  await signOut(auth);
  console.log("PRUEBAS DE PERMISOS COMPLETADAS.");
}

try {
  await ejecutar();
} catch (error) {
  console.error("PRUEBA FALLIDA:", error.message);
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
