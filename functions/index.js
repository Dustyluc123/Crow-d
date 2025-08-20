const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// FUNÇÃO 1: Deletar eventos antigos
exports.deleteOldEvents = functions.pubsub.schedule("every 24 hours")
    .onRun(async (context) => {
      const now = admin.firestore.Timestamp.now();
      const db = admin.firestore();

      const oldEventsQuery = db.collection("events")
          .where("eventDateTime", "<", now);

      const snapshot = await oldEventsQuery.get();

      if (snapshot.empty) {
        console.log("Nenhum evento antigo para excluir.");
        return null;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Excluídos ${snapshot.size} eventos antigos.`);
      return null;
    });

// FUNÇÃO 2: Gerar a tag de usuário única
exports.generateUniqueUserTag = functions.https
    .onCall(async (data, context) => {
      const db = admin.firestore();
      const nickname = data.nickname;

      if (!nickname) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "A função precisa ser chamada com um 'nickname'.",
        );
      }

      let tag;
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        tag = Math.floor(1000 + Math.random() * 9000).toString();

        const snapshot = await db.collection("users")
            .where("nickname", "==", nickname)
            .where("tag", "==", tag)
            .get();

        if (snapshot.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new functions.https.HttpsError(
            "unavailable",
            "Não foi possível encontrar uma tag única para este nome.",
        );
      }

      return {tag: tag};
    });

// ✨ CORREÇÃO APLICADA: UMA LINHA EM BRANCO FOI ADICIONADA ABAIXO DESTA LINHA ✨
    