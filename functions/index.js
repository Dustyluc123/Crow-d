const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Função agendada para rodar todos os dias à meia-noite
exports.deleteOldEvents = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const db = admin.firestore();

  // Busca por eventos cuja data já passou
  const oldEventsQuery = db.collection("events").where("eventDateTime", "<", now);
  
  const snapshot = await oldEventsQuery.get();

  if (snapshot.empty) {
    console.log("Nenhum evento antigo para excluir.");
    return null;
  }

  // Deleta cada evento antigo encontrado
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Excluídos ${snapshot.size} eventos antigos.`);
  return null;
});