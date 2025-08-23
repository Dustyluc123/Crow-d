// Ficheiro: functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.manageFriendRequest = functions.https.onCall(async (data, context) => {
  // 1. Validação e autenticação (sem alterações)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated", "Você precisa estar logado."
    );
  }

  const { requestId, action, notificationId } = data; // Adicionámos o notificationId
  const currentUserId = context.auth.uid;

  if (!requestId || !action) {
    throw new functions.https.HttpsError(
      "invalid-argument", "O ID da solicitação e a ação são obrigatórios."
    );
  }

  const requestRef = db.collection("friendRequests").doc(requestId);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Solicitação não encontrada.");
  }
  const requestData = requestDoc.data();

  if (requestData.to !== currentUserId) {
    throw new functions.https.HttpsError(
      "permission-denied", "Você não tem permissão para gerir esta solicitação."
    );
  }
  
  // Início da Lógica Principal
  try {
    const fromUserId = requestData.from;
    const batch = db.batch();

    if (action === "accept") {
      // Lógica para aceitar (semelhante à anterior)
      const currentUserDoc = await db.collection("users").doc(currentUserId).get();
      const fromUserDoc = await db.collection("users").doc(fromUserId).get();

      if (!currentUserDoc.exists || !fromUserDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Perfil de utilizador não encontrado.");
      }
      
      const currentUserData = currentUserDoc.data();
      const fromUserData = fromUserDoc.data();
      
      const friend1Ref = db.collection("users").doc(currentUserId).collection("friends").doc(fromUserId);
      batch.set(friend1Ref, { 
          nickname: fromUserData.nickname || 'Usuário', 
          photoURL: fromUserData.photoURL || null 
      });

      const friend2Ref = db.collection("users").doc(fromUserId).collection("friends").doc(currentUserId);
      batch.set(friend2Ref, { 
          nickname: currentUserData.nickname || 'Usuário', 
          photoURL: currentUserData.photoURL || null 
      });

      // NOVO: Cria uma notificação para quem enviou o pedido, avisando que foi aceite.
      const notificationRef = db.collection("users").doc(fromUserId).collection("notifications").doc();
      batch.set(notificationRef, {
        type: 'friend_accept',
        fromUserId: currentUserId,
        fromUserName: currentUserData.nickname || 'Usuário',
        fromUserPhoto: currentUserData.photoURL || null,
        content: 'aceitou a sua solicitação de amizade.',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });
    }
    
    // --- PONTO-CHAVE DA CORREÇÃO ---
    // Independentemente de aceitar ou recusar, vamos apagar a solicitação original.
    batch.delete(requestRef);

    // Se um ID de notificação foi passado, também vamos apagá-la.
    if (notificationId) {
        const notificationToDeleteRef = db.collection("users").doc(currentUserId).collection("notifications").doc(notificationId);
        batch.delete(notificationToDeleteRef);
    }

    // Executa todas as operações em lote
    await batch.commit();

    return { success: true, message: action === "accept" ? "Amigo adicionado!" : "Solicitação recusada." };

  } catch (error) {
    console.error("Erro na Cloud Function 'manageFriendRequest':", error);
    throw new functions.https.HttpsError("unknown", "Ocorreu um erro interno.", error.message);
  }
});