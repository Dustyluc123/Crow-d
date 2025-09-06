// notificacoes.js — v3 (Firebase Web v8 compat: firebase.auth() / firebase.firestore())
// Recursos:
// - Pedidos recebidos (aceitar/recusar via UPDATE) e enviados (cancelar via DELETE)
// - Notificações gerais com nome/foto de quem curtiu/comentou
// - Botão “Marcar como lida” some após clicar
// - Convites de grupo com Aceitar/Recusar (atualiza members e marca handled)
// - Grid montado dentro de #notifications-container

(function () {
  // ----------------------------- Utils -----------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "\"")
      .replace(/'/g, "'");
  }

  function ensureFirebase() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      throw new Error("Firebase não inicializado. Carregue a config antes deste arquivo (use defer).");
    }
    return { auth: firebase.auth(), db: firebase.firestore() };
  }

  function toast(msg, type, ms) {
    var kind = type || "info";
    var dur = ms || 2600;
    try {
      if (typeof window.createToast === "function") {
        window.createToast(msg, kind);
        return;
      }
    } catch (_) {}
    // fallback
    var c = document.getElementById("toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "toast-container";
      c.style.position = "fixed";
      c.style.top = "12px";
      c.style.right = "12px";
      c.style.zIndex = "9999";
      document.body.appendChild(c);
    }
    var el = document.createElement("div");
    el.className = "toast toast-" + kind;
    el.textContent = msg;
    el.style.margin = "6px";
    el.style.padding = "10px 14px";
    el.style.borderRadius = "10px";
    el.style.color = "#fff";
    el.style.background = kind === "error" ? "#e74c3c" : (kind === "success" ? "#2ecc71" : "#444");
    el.style.boxShadow = "0 4px 12px rgba(0,0,0,.2)";
    c.appendChild(el);
    setTimeout(function () { el.remove(); }, dur);
  }

  // Loader (controlado via atributo hidden)
  function setLoadingVisible(v) {
    var el = document.getElementById("loading-notifications");
    if (el) el.hidden = !v;
  }

  // ----------------------------- Estrutura DOM -----------------------------
  function ensureContainers() {
    var mount = document.getElementById("notifications-container");
    if (!mount) return;

    if (!document.getElementById("notifications-root")) {
      var root = document.createElement("div");
      root.id = "notifications-root";
      root.className = "notifs-grid";
      root.innerHTML =
        '<section id="col-left">' +
          '<h3>Pedidos recebidos</h3>' +
          '<div id="friend-requests"></div>' +
          '<h3>Pedidos enviados</h3>' +
          '<div id="sent-requests"></div>' +
        '</section>' +
        '<aside id="col-right">' +
          '<div class="right-toolbar">' +
            '<button id="mark-all-read" class="btn">Marcar todas como lidas</button>' +
          '</div>' +
          '<div id="general-notifications"></div>' +
        '</aside>';

      var loader = document.getElementById("loading-notifications");
      if (loader) {
        mount.insertBefore(root, loader);
      } else {
        mount.appendChild(root);
      }
    }
  }

  var refs = {
    incomingList: function () { return document.getElementById("friend-requests"); },
    sentList: function () { return document.getElementById("sent-requests"); },
    generalList: function () { return document.getElementById("general-notifications"); },
    markAllBtn: function () { return document.getElementById("mark-all-read"); },
    emptyBox: function () { return document.getElementById("notifications-empty"); }
  };

  // ----------------------------- Estado -----------------------------
  var currentUser = null;
  var profileCache = {}; // uid -> {nickname, photoURL}
  var unsubIncoming = null;
  var unsubSent = null;
  var unsubGeneral = null;

  // ----------------------------- Perfis -----------------------------
  function getProfile(db, uid) {
    if (!uid) return Promise.resolve({ uid: uid, nickname: "Usuário", photoURL: null });
    if (profileCache[uid]) return Promise.resolve(profileCache[uid]);

    return db.collection("users").doc(uid).get().then(function (snap) {
      var data = snap.exists ? (snap.data() || {}) : {};
      var p = {
        uid: uid,
        nickname: data.nickname || data.displayName || data.name || "Usuário",
        photoURL: data.photoURL || null
      };
      profileCache[uid] = p;
      return p;
    }).catch(function () {
      return { uid: uid, nickname: "Usuário", photoURL: null };
    });
  }

  // ----------------------------- Render -----------------------------
  function formatTimestamp(ts) {
    try {
      if (!ts) return "";
      var d = ts.toDate ? ts.toDate() : new Date(ts);
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
    } catch (e) { return ""; }
  }

  function iconFor(type) {
    switch (type) {
      case "friend_request": return "👋";
      case "friend_accept": return "✅";
      case "friend_decline": return "❌";
      case "like": return "❤️";
      case "comment": return "💬";
      case "group_invite": return "👥";
      default: return "🔔";
    }
  }

  function renderIncomingItem(reqId, data, fromProfile) {
    var photo = esc((fromProfile && fromProfile.photoURL) || "../img/Design sem nome2.png");
    var name = esc((fromProfile && fromProfile.nickname) || "Usuário");
    var when = formatTimestamp(data.timestamp);
    return (
      '<div class="request-item" data-id="' + esc(reqId) + '" data-from="' + esc(data.from) + '" data-to="' + esc(data.to) + '">' +
        '<img class="avatar" src="' + photo + '" alt="' + name + '">' +
        '<div class="info">' +
          "<strong>" + name + "</strong>" +
          "<span> enviou uma solicitação de amizade</span>" +
          '<small class="when">' + when + "</small>" +
        "</div>" +
        '<div class="actions">' +
          '<button class="btn-accept">Aceitar</button>' +
          '<button class="btn-decline">Recusar</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderSentItem(reqId, data, toProfile) {
    var photo = esc((toProfile && toProfile.photoURL) || "../img/Design sem nome2.png");
    var name = esc((toProfile && toProfile.nickname) || "Usuário");
    var when = formatTimestamp(data.timestamp);
    return (
      '<div class="request-item sent" data-id="' + esc(reqId) + '" data-from="' + esc(data.from) + '" data-to="' + esc(data.to) + '">' +
        '<img class="avatar" src="' + photo + '" alt="' + name + '">' +
        '<div class="info">' +
          "<span>Você enviou um pedido para</span>" +
          "<strong> " + name + "</strong>" +
          '<small class="when">' + when + "</small>" +
        "</div>" +
        '<div class="actions">' +
          '<button class="btn-cancel">Cancelar</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderGeneralItem(id, n, fromProfile) {
    var ico = iconFor(n.type);
    var when = formatTimestamp(n.timestamp);
    var readClass = n.read ? "read" : "unread";
    var hasProfile = !!fromProfile;
    var avatarHtml = (hasProfile && fromProfile.photoURL)
      ? '<img class="avatar" src="' + esc(fromProfile.photoURL) + '" alt="' + esc(fromProfile.nickname || "Usuário") + '">'
      : "";
    var actorName = hasProfile ? esc(fromProfile.nickname || "Usuário") : "Alguém";

    var line = esc(n.content || "Nova atividade");
    if (n.type === "like") {
      line = actorName + " curtiu " + (n.targetType === "comment" ? "seu comentário" : "seu post");
    } else if (n.type === "comment") {
      line = actorName + " comentou no seu post" + (n.commentText ? ": " + esc(n.commentText) : "");
    } else if (n.type === "group_invite") {
      var gname = n.groupName ? esc(n.groupName) : (n.groupId ? ("grupo " + esc(n.groupId)) : "um grupo");
      line = actorName + " convidou você para " + gname;
    }

    var actionsHtml = "";
    if (n.type === "group_invite" && !n.handled) {
      actionsHtml =
        '<div class="actions">' +
          '<button class="btn-accept-invite" data-notif-id="' + esc(id) + '" data-group-id="' + esc(n.groupId || "") + '">Aceitar</button>' +
          '<button class="btn-decline-invite" data-notif-id="' + esc(id) + '" data-group-id="' + esc(n.groupId || "") + '">Recusar</button>' +
        "</div>";
    } else if (!n.read) {
      actionsHtml = '<button class="btn-mark">Marcar como lida</button>';
    }

    return (
      '<div class="notif-item ' + readClass + '" data-id="' + esc(id) + '"' +
        (n.fromUserId ? (' data-from="' + esc(n.fromUserId) + '"') : "") +
        (n.requestId ? (' data-req="' + esc(n.requestId) + '"') : "") +
      ">" +
        '<span class="ico">' + ico + "</span>" +
        avatarHtml +
        '<div class="text">' +
          '<div class="line">' + line + "</div>" +
          '<small class="when">' + when + "</small>" +
        "</div>" +
        actionsHtml +
      "</div>"
    );
  }

  // ----------------------------- Ações: Friend Requests -----------------------------
  function acceptRequest(db, reqId) {
    var reqRef = db.collection("friendRequests").doc(reqId);
    return reqRef.get().then(function (snap) {
      if (!snap.exists) { toast("Pedido não encontrado.", "error"); return; }
      var r = snap.data();
      if (!r || r.to !== currentUser.uid) { toast("Sem permissão para aceitar.", "error"); return; }
      if (r.status !== "pending") { toast("Pedido já processado.", "info"); return; }

      var now = firebase.firestore.FieldValue.serverTimestamp();

      // 1) status
      return reqRef.update({ status: "accepted", acceptedAt: now }).then(function () {
        // 2) amizade bi-direcional
        var aRef = db.collection("users").doc(r.from).collection("friends").doc(r.to);
        var bRef = db.collection("users").doc(r.to).collection("friends").doc(r.from);
        var batch = db.batch();
        batch.set(aRef, { status: "accepted", createdAt: now });
        batch.set(bRef, { status: "accepted", createdAt: now });
        return batch.commit();
      }).then(function () {
        // 3) notifica remetente
        return db.collection("users").doc(r.from).collection("notifications").add({
          type: "friend_accept",
          fromUserId: r.to,
          content: "aceitou sua solicitação de amizade",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          read: false
        });
      }).then(function () {
        toast("Solicitação aceita. Agora vocês são amigos!", "success");
      });
    }).catch(function (err) {
      console.error(err);
      toast(err && err.message ? err.message : "Falha ao aceitar.", "error");
    });
  }

  function declineRequest(db, reqId) {
    var reqRef = db.collection("friendRequests").doc(reqId);
    return reqRef.get().then(function (snap) {
      if (!snap.exists) { toast("Pedido não encontrado.", "error"); return; }
      var r = snap.data();
      if (!r || r.to !== currentUser.uid) { toast("Sem permissão para recusar.", "error"); return; }
      if (r.status !== "pending") { toast("Pedido já processado.", "info"); return; }

      var now = firebase.firestore.FieldValue.serverTimestamp();

      return reqRef.update({ status: "declined", declinedAt: now }).then(function () {
        return db.collection("users").doc(r.from).collection("notifications").add({
          type: "friend_decline",
          fromUserId: r.to,
          content: "recusou sua solicitação de amizade",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          read: false
        });
      }).then(function () { toast("Solicitação recusada.", "info"); });
    }).catch(function (err) {
      console.error(err);
      toast(err && err.message ? err.message : "Falha ao recusar.", "error");
    });
  }

  function cancelRequest(db, reqId) {
    var reqRef = db.collection("friendRequests").doc(reqId);
    return reqRef.get().then(function (snap) {
      if (!snap.exists) { toast("Pedido não encontrado.", "error"); return; }
      var r = snap.data();
      if (!r || r.from !== currentUser.uid) { toast("Apenas quem enviou pode cancelar.", "error"); return; }
      return reqRef.delete().then(function () { toast("Solicitação cancelada.", "success"); });
    }).catch(function (err) {
      console.error(err);
      toast(err && err.message ? err.message : "Falha ao cancelar.", "error");
    });
  }

  // ----------------------------- Ações: Group Invites -----------------------------
  function acceptGroupInvite(db, notifId, groupId) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    // entra no grupo
    return db.collection("groups").doc(groupId).update({
      members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    }).then(function () {
      // marca notificação
      return db.collection("users").doc(currentUser.uid).collection("notifications").doc(notifId)
        .update({ read: true, handled: true, response: "accepted", handledAt: now });
    }).then(function () {
      toast("Convite aceito! Você entrou no grupo.", "success");
    }).catch(function (err) {
      console.error(err);
      toast(err && err.message ? err.message : "Falha ao aceitar convite.", "error");
    });
  }

  function declineGroupInvite(db, notifId /*, groupId */) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection("users").doc(currentUser.uid).collection("notifications").doc(notifId)
      .update({ read: true, handled: true, response: "declined", handledAt: now })
      .then(function () { toast("Convite recusado.", "info"); })
      .catch(function (err) {
        console.error(err);
        toast(err && err.message ? err.message : "Falha ao recusar convite.", "error");
      });
  }

  // ----------------------------- Realtime -----------------------------
  function sortByTimestampDesc(docs) {
    return docs
      .map(function (doc) { return { id: doc.id, data: doc.data() }; })
      .sort(function (a, b) {
        var ta = ((a.data && a.data.timestamp && a.data.timestamp.toDate && a.data.timestamp.toDate()) || new Date(0)).getTime();
        var tb = ((b.data && b.data.timestamp && b.data.timestamp.toDate && b.data.timestamp.toDate()) || new Date(0)).getTime();
        return tb - ta;
      });
  }

  function startIncomingRealtime(db) {
    stopIncomingRealtime();
    if (!refs.incomingList()) return;

    unsubIncoming = db.collection("friendRequests")
      .where("to", "==", currentUser.uid)
      .where("status", "==", "pending")
      .onSnapshot(function (snap) {
        setLoadingVisible(false);
        var container = refs.incomingList();
        if (!container) return;
        if (snap.empty) {
          container.innerHTML = '<div class="empty">Sem solicitações pendentes.</div>';
          updateEmptyState();
          return;
        }
        var docs = sortByTimestampDesc(snap.docs);
        var proms = docs.map(function (obj) {
          return getProfile(db, obj.data.from).then(function (p) {
            return renderIncomingItem(obj.id, obj.data, p);
          });
        });
        Promise.all(proms).then(function (rows) {
          container.innerHTML = rows.join("");
          updateEmptyState();
        });
      }, function (err) {
        setLoadingVisible(false);
        console.error("incoming onSnapshot:", err);
        var c = refs.incomingList();
        if (c) c.innerHTML = '<div class="error">Erro ao carregar pedidos recebidos.</div>';
        updateEmptyState();
      });
  }
  function stopIncomingRealtime() { if (typeof unsubIncoming === "function") { unsubIncoming(); unsubIncoming = null; } }

  function startSentRealtime(db) {
    stopSentRealtime();
    if (!refs.sentList()) return;

    unsubSent = db.collection("friendRequests")
      .where("from", "==", currentUser.uid)
      .where("status", "==", "pending")
      .onSnapshot(function (snap) {
        setLoadingVisible(false);
        var container = refs.sentList();
        if (!container) return;
        if (snap.empty) {
          container.innerHTML = '<div class="empty">Você não tem solicitações pendentes.</div>';
          updateEmptyState();
          return;
        }
        var docs = sortByTimestampDesc(snap.docs);
        var proms = docs.map(function (obj) {
          return getProfile(db, obj.data.to).then(function (p) {
            return renderSentItem(obj.id, obj.data, p);
          });
        });
        Promise.all(proms).then(function (rows) {
          container.innerHTML = rows.join("");
          updateEmptyState();
        });
      }, function (err) {
        setLoadingVisible(false);
        console.error("sent onSnapshot:", err);
        var c = refs.sentList();
        if (c) c.innerHTML = '<div class="error">Erro ao carregar pedidos enviados.</div>';
        updateEmptyState();
      });
  }
  function stopSentRealtime() { if (typeof unsubSent === "function") { unsubSent(); unsubSent = null; } }

  function startGeneralRealtime(db) {
    stopGeneralRealtime();
    if (!refs.generalList()) return;

    unsubGeneral = db.collection("users").doc(currentUser.uid).collection("notifications")
      .orderBy("timestamp", "desc")
      .limit(50)
      .onSnapshot(function (snap) {
        setLoadingVisible(false);
        var container = refs.generalList();
        if (!container) return;
        if (snap.empty) {
          container.innerHTML = '<div class="empty">Sem atividades por aqui.</div>';
          updateEmptyState();
          return;
        }
        var proms = snap.docs.map(function (d) {
          var data = d.data();
          if (data && data.fromUserId) {
            return getProfile(db, data.fromUserId).then(function (p) {
              return renderGeneralItem(d.id, data, p);
            });
          }
          return Promise.resolve(renderGeneralItem(d.id, data, null));
        });
        Promise.all(proms).then(function (rows) {
          container.innerHTML = rows.join("");
          updateEmptyState();
        });
      }, function (err) {
        setLoadingVisible(false);
        console.error("general onSnapshot:", err);
        var c = refs.generalList();
        if (c) c.innerHTML = '<div class="error">Erro ao carregar notificações.</div>';
        updateEmptyState();
      });
  }
  function stopGeneralRealtime() { if (typeof unsubGeneral === "function") { unsubGeneral(); unsubGeneral = null; } }

  function updateEmptyState() {
    var box = refs.emptyBox ? refs.emptyBox() : null;
    if (!box) return;
    var hasIncoming = refs.incomingList() && refs.incomingList().children.length > 0 && !refs.incomingList().querySelector(".empty");
    var hasSent = refs.sentList() && refs.sentList().children.length > 0 && !refs.sentList().querySelector(".empty");
    var hasGeneral = refs.generalList() && refs.generalList().children.length > 0 && !refs.generalList().querySelector(".empty");
    box.style.display = (hasIncoming || hasSent || hasGeneral) ? "none" : "block";
  }

  // ----------------------------- Click handlers -----------------------------
  document.addEventListener("click", function (e) {
    var ctx;
    try { ctx = ensureFirebase(); } catch (_) { return; }
    var db = ctx.db;

    // aceitar pedido
    var acceptBtn = e.target.closest(".btn-accept");
    if (acceptBtn) {
      var itemA = acceptBtn.closest(".request-item");
      var idA = itemA && itemA.getAttribute("data-id");
      if (!idA) return;
      acceptBtn.disabled = true; acceptBtn.textContent = "Aceitando...";
      acceptRequest(db, idA).finally(function () {
        acceptBtn.disabled = false; acceptBtn.textContent = "Aceitar";
      });
      return;
    }

    // recusar pedido
    var declineBtn = e.target.closest(".btn-decline");
    if (declineBtn) {
      var itemD = declineBtn.closest(".request-item");
      var idD = itemD && itemD.getAttribute("data-id");
      if (!idD) return;
      declineBtn.disabled = true; declineBtn.textContent = "Recusando...";
      declineRequest(db, idD).finally(function () {
        declineBtn.disabled = false; declineBtn.textContent = "Recusar";
      });
      return;
    }

    // cancelar pedido enviado
    var cancelBtn = e.target.closest(".btn-cancel");
    if (cancelBtn) {
      var itemC = cancelBtn.closest(".request-item");
      var idC = itemC && itemC.getAttribute("data-id");
      if (!idC) return;
      cancelBtn.disabled = true; cancelBtn.textContent = "Cancelando...";
      cancelRequest(db, idC).finally(function () {
        cancelBtn.disabled = false; cancelBtn.textContent = "Cancelar";
      });
      return;
    }

    // marcar como lida
    var markBtn = e.target.closest(".btn-mark");
    if (markBtn) {
      var row = markBtn.closest(".notif-item");
      var id = row && row.getAttribute("data-id");
      if (!id) return;
      db.collection("users").doc(currentUser.uid).collection("notifications").doc(id)
        .update({ read: true })
        .then(function () {
          row.classList.remove("unread");
          row.classList.add("read");
          markBtn.remove(); // esconde o botão
        })
        .catch(function (err) {
          console.error(err);
          toast("Falha ao marcar como lida.", "error");
        });
      return;
    }

    // aceitar convite de grupo
    var acceptInvite = e.target.closest(".btn-accept-invite");
    if (acceptInvite) {
      var rowI = acceptInvite.closest(".notif-item");
      var notifId = acceptInvite.getAttribute("data-notif-id");
      var gid = acceptInvite.getAttribute("data-group-id");
      if (!notifId || !gid) { toast("Convite inválido.", "error"); return; }
      acceptInvite.disabled = true; acceptInvite.textContent = "Aceitando...";
      acceptGroupInvite(db, notifId, gid).then(function () {
        $all(".btn-accept-invite, .btn-decline-invite", rowI).forEach(function (b) { b.remove(); });
      });
      return;
    }

    // recusar convite de grupo
    var declineInvite = e.target.closest(".btn-decline-invite");
    if (declineInvite) {
      var rowR = declineInvite.closest(".notif-item");
      var notifId2 = declineInvite.getAttribute("data-notif-id");
      var gid2 = declineInvite.getAttribute("data-group-id");
      if (!notifId2 || !gid2) { toast("Convite inválido.", "error"); return; }
      declineInvite.disabled = true; declineInvite.textContent = "Recusando...";
      declineGroupInvite(db, notifId2, gid2).then(function () {
        $all(".btn-accept-invite, .btn-decline-invite", rowR).forEach(function (b) { b.remove(); });
      });
      return;
    }

    // abrir perfil do autor do pedido recebido
    var openUser = e.target.closest(".request-item .avatar, .request-item .info strong");
    if (openUser) {
      var item = openUser.closest(".request-item");
      var from = item && item.getAttribute("data-from");
      if (from) window.location.href = "../pages/user.html?uid=" + from;
    }
  });

  // ----------------------------- Mark all as read -----------------------------
  function markAllAsRead() {
    var ctx;
    try { ctx = ensureFirebase(); } catch (e) { console.error(e); return; }
    var db = ctx.db;
    var col = db.collection("users").doc(currentUser.uid).collection("notifications");
    col.where("read", "==", false).get().then(function (snap) {
      if (snap.empty) return;
      var batch = db.batch();
      snap.forEach(function (doc) { batch.update(col.doc(doc.id), { read: true }); });
      return batch.commit();
    }).then(function () {
      // Atualiza UI
      $all(".notif-item.unread").forEach(function (row) {
        row.classList.remove("unread");
        row.classList.add("read");
        var btn = row.querySelector(".btn-mark");
        if (btn) btn.remove();
      });
      toast("Todas marcadas como lidas.", "success");
    }).catch(function (e) {
      console.error(e);
      toast("Não foi possível marcar todas.", "error");
    });
  }

  // ----------------------------- Boot -----------------------------
  document.addEventListener("DOMContentLoaded", function () {
    try { ensureFirebase(); } catch (e) { console.error(e); toast(e.message, "error"); return; }

    ensureContainers();
    setLoadingVisible(true);

    // auth
    firebase.auth().onAuthStateChanged(function (u) {
      currentUser = u || null;
      stopIncomingRealtime();
      stopSentRealtime();
      stopGeneralRealtime();

      if (!u) {
        if (refs.incomingList()) refs.incomingList().innerHTML = '<div class="empty">Faça login para ver seus pedidos.</div>';
        if (refs.sentList()) refs.sentList().innerHTML = '<div class="empty">Faça login para ver os pedidos enviados.</div>';
        if (refs.generalList()) refs.generalList().innerHTML = '<div class="empty">Faça login para ver notificações.</div>';
        setLoadingVisible(false);
        return;
      }

      var ctx = ensureFirebase();
      var db = ctx.db;
      startIncomingRealtime(db);
      startSentRealtime(db);
      startGeneralRealtime(db);
      setLoadingVisible(false);

      var markAll = refs.markAllBtn();
      if (markAll) {
        markAll.onclick = function () { markAllAsRead(); };
      }
    });
  });
})();
