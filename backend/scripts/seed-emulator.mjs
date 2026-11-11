import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Seed bloqueado: configura Firestore y Authentication Emulator; no se permite producción.");
}

const projectId = process.env.GCLOUD_PROJECT || "demo-bora";
const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const users = [
  { uid: "bora-demo-owner", email: "emprendedora@example.test", role: "emprendedora" },
  { uid: "bora-demo-admin", email: "admin@example.test", role: "admin" },
  { uid: "bora-demo-buyer", email: "comprador@example.test", role: "comprador" },
];
for (const user of users) {
  try {
    await auth.createUser({ uid: user.uid, email: user.email, password: "solo-emulador-123" });
  } catch (error) {
    if (error.code !== "auth/uid-already-exists" && error.code !== "auth/email-already-exists") throw error;
  }
  await db.doc(`users/${user.uid}`).set({
    role: user.role,
    storeId: user.role === "emprendedora" ? "bora-demo-store" : "",
    storeName: user.role === "emprendedora" ? "Taller de muestra" : "",
  });
}

await db.doc("associations/bora-demo-association").set({
  name: "Asociación de muestra",
  logoUrl: "",
  description: "Datos ficticios para desarrollo.",
  sector: "Puerto Montt",
  contact: "",
  active: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

await db.doc("products/bora-demo-product").set({
  storeId: "bora-demo-store",
  ownerUid: "bora-demo-owner",
  name: "Tejido de muestra",
  description: "Producto ficticio para probar la app.",
  price: 8500,
  imageUrl: "https://example.test/tejido.jpg",
  imagePath: "products/bora-demo-owner/bora-demo-product.jpg",
  category: "Textil",
  productType: "Tejido",
  modality: "Regular",
  managesStock: true,
  stock: 5,
  exhaustedBehavior: "Mostrar agotado",
  available: true,
  sold: false,
  variants: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const endsAt = new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);
await db.doc("fairs/bora-demo-fair").set({
  name: "Feria de prueba",
  description: "Evento ficticio para validar calendario y rutas.",
  imageUrl: "https://example.test/feria.jpg",
  address: "Plaza de Armas, Puerto Montt",
  latitude: -41.4717,
  longitude: -72.9368,
  startsAt: Timestamp.fromDate(startsAt),
  endsAt: Timestamp.fromDate(endsAt),
  organizer: "Equipo BORA (prueba)",
  published: true,
  cancelled: false,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});
await db.doc("fairs/bora-demo-fair/participants/bora-demo-owner").set({
  entrepreneurUid: "bora-demo-owner",
  entrepreneurName: "Taller de muestra",
  status: "invitada",
  invitedBy: "bora-demo-admin",
  updatedAt: Timestamp.now(),
});

console.log("Datos ficticios cargados en demo-bora. Contraseña solo de emulador: solo-emulador-123");
