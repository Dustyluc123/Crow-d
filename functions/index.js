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

