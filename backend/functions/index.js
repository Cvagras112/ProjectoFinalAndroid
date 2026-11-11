const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

initializeApp();

exports.notifyFollowersWhenStoreConfirmsFair = onDocumentUpdated(
  "fairs/{fairId}/participants/{entrepreneurUid}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === "confirmada" || after.status !== "confirmada") return;

    const db = getFirestore();
    const fairSnapshot = await db.doc(`fairs/${event.params.fairId}`).get();
    if (!fairSnapshot.exists || fairSnapshot.get("published") !== true || fairSnapshot.get("cancelled") === true) return;

    const profileSnapshot = await db.doc(`users/${event.params.entrepreneurUid}`).get();
    const storeId = profileSnapshot.get("storeId") || event.params.entrepreneurUid;
    const storeName = profileSnapshot.get("storeName") || after.entrepreneurName || "Una tienda que sigues";
    const fairName = fairSnapshot.get("name") || "una feria";

    const follows = await db.collectionGroup("follows")
      .where("targetType", "==", "store")
      .where("targetId", "==", storeId)
      .where("notificationsEnabled", "==", true)
      .get();

    const deviceSnapshots = await Promise.all(
      follows.docs
        .map((follow) => follow.ref.parent.parent)
        .filter(Boolean)
        .map((userRef) => userRef.collection("devices").get()),
    );
    const tokenOwners = new Map();
    for (const devices of deviceSnapshots) {
      for (const device of devices.docs) {
        const token = device.get("token");
        if (typeof token === "string" && token.length > 0) tokenOwners.set(token, device.ref);
      }
    }
    const entries = [...tokenOwners.entries()];
    for (let offset = 0; offset < entries.length; offset += 500) {
      const batch = entries.slice(offset, offset + 500);
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch.map(([token]) => token),
        notification: {
          title: `${storeName} participará en una feria`,
          body: `${fairName} · ${fairSnapshot.get("address") || "Puerto Montt"}`,
        },
        data: { fairId: event.params.fairId, kind: "store_fair_confirmed" },
      });
      const staleTokens = [];
      response.responses.forEach((result, index) => {
        if (!result.success && [
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered",
        ].includes(result.error?.code)) {
          staleTokens.push(batch[index][1].delete());
        }
      });
      await Promise.all(staleTokens);
    }
  },
);
