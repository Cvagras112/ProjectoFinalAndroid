import { readFile } from "node:fs/promises";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-bora";
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
    storage: {
      rules: await readFile(new URL("../storage.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/owner"), { role: "emprendedora", storeId: "store-1" });
    await setDoc(doc(context.firestore(), "users/admin"), { role: "admin" });
    await setDoc(doc(context.firestore(), "products/product-1"), validProduct("owner"));
    await setDoc(doc(context.firestore(), "fairs/fair-1"), validFair());
    await setDoc(doc(context.firestore(), "fairs/fair-1/participants/owner"), {
      entrepreneurUid: "owner",
      entrepreneurName: "Tienda de prueba",
      status: "invitada",
      invitedBy: "admin",
      updatedAt: new Date(),
    });
  });
});

after(async () => {
  await env.cleanup();
});

function validProduct(ownerUid) {
  return {
    storeId: "store-1",
    ownerUid,
    name: "Producto de prueba",
    description: "",
    price: 1000,
    imageUrl: "https://example.test/product.jpg",
    imagePath: `products/${ownerUid}/p1.jpg`,
    category: "Artesanía",
    productType: "General",
    modality: "Regular",
    managesStock: true,
    stock: 4,
    exhaustedBehavior: "Mostrar agotado",
    available: true,
    sold: false,
    variants: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validFair() {
  return {
    name: "Feria de prueba",
    description: "",
    imageUrl: "https://example.test/fair.jpg",
    address: "Puerto Montt",
    latitude: -41.47,
    longitude: -72.94,
    startsAt: new Date("2030-01-01T12:00:00Z"),
    endsAt: new Date("2030-01-01T20:00:00Z"),
    organizer: "Municipalidad",
    published: true,
    cancelled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

test("emprendedora crea su producto y comprador no puede escribirlo", async () => {
  const entrepreneurDb = env.authenticatedContext("owner").firestore();
  await assertSucceeds(setDoc(doc(entrepreneurDb, "products/new-product"), validProduct("owner")));

  const buyerDb = env.authenticatedContext("buyer", {
    firebase: { sign_in_provider: "google.com" },
  }).firestore();
  await assertFails(setDoc(doc(buyerDb, "products/buyer-product"), validProduct("buyer")));
});

test("Storage deja subir JPEG a la emprendedora y leerlo al público; rechaza otros tipos", async () => {
  const ownerStorage = env.authenticatedContext("owner").storage();
  const buyerStorage = env.authenticatedContext("buyer", {
    firebase: { sign_in_provider: "google.com" },
  }).storage();
  const path = `products/owner/test-${Date.now()}.jpg`;
  await assertSucceeds(uploadBytes(ref(ownerStorage, path), new Uint8Array([1, 2, 3]), {
    contentType: "image/jpeg",
  }));
  await assertSucceeds(getBytes(ref(buyerStorage, path)));
  await assertFails(uploadBytes(ref(ownerStorage, `products/owner/bad-${Date.now()}.png`), new Uint8Array([1]), {
    contentType: "image/png",
  }));
  await assertFails(uploadBytes(ref(buyerStorage, `products/buyer/bad-${Date.now()}.jpg`), new Uint8Array([1]), {
    contentType: "image/jpeg",
  }));
});

test("admin y visitante no pueden escribir productos y el catálogo es de lectura pública", async () => {
  const adminDb = env.authenticatedContext("admin").firestore();
  const anonymousDb = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(adminDb, "products/admin-product"), validProduct("admin")));
  await assertFails(setDoc(doc(anonymousDb, "products/anonymous-product"), validProduct("anonymous")));
  await assertSucceeds(getDoc(doc(anonymousDb, "products/product-1")));
});

test("emprendedora no puede transferir la propiedad de un producto", async () => {
  const db = env.authenticatedContext("owner").firestore();
  await assertFails(updateDoc(doc(db, "products/product-1"), {
    ownerUid: "other",
    updatedAt: serverTimestamp(),
  }));
});

test("historial de ventas solo es legible por su emprendedora", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "sales/sale-1"), {
      ownerUid: "owner",
      productId: "product-1",
      productName: "Producto de prueba",
      variantId: "",
      variantName: "",
      quantity: 1,
      unitPrice: 1000,
      totalPrice: 1000,
      placeType: "otro",
      placeName: "Puerto Montt",
      soldAt: new Date(),
    });
  });
  const ownerDb = env.authenticatedContext("owner").firestore();
  const buyerDb = env.authenticatedContext("buyer", {
    firebase: { sign_in_provider: "google.com" },
  }).firestore();
  const adminDb = env.authenticatedContext("admin").firestore();
  await assertSucceeds(getDoc(doc(ownerDb, "sales/sale-1")));
  await assertFails(getDoc(doc(buyerDb, "sales/sale-1")));
  await assertFails(getDoc(doc(adminDb, "sales/sale-1")));
});

test("solo administrador crea ferias; la emprendedora puede responder su invitación", async () => {
  const adminDb = env.authenticatedContext("admin").firestore();
  await assertSucceeds(setDoc(doc(adminDb, "fairs/new-fair"), validFair()));

  const entrepreneurDb = env.authenticatedContext("owner").firestore();
  await assertFails(setDoc(doc(entrepreneurDb, "fairs/unauthorized-fair"), validFair()));
  await assertSucceeds(updateDoc(doc(entrepreneurDb, "fairs/fair-1/participants/owner"), {
    status: "confirmada",
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(entrepreneurDb, "fairs/fair-1/participants/owner"), {
    status: "agregada_admin",
    updatedAt: serverTimestamp(),
  }));
});

test("comprador Google administra sus seguimientos, no los de otra cuenta", async () => {
  const buyerDb = env.authenticatedContext("buyer", {
    firebase: { sign_in_provider: "google.com" },
  }).firestore();
  const follow = {
    targetId: "store-1",
    targetType: "store",
    notificationsEnabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(buyerDb, "users/buyer/follows/store_store-1"), follow));
  await assertFails(setDoc(doc(buyerDb, "users/other/follows/store_store-1"), follow));
});
