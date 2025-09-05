// notificacoes.js — reescrito e compatível com suas regras de segurança (v2)
// Alterações nesta versão:
// 1) Removido orderBy nas queries de friendRequests para evitar necessidade de índice composto.
// 2) Cria automaticamente a estrutura de containers se não existir no HTML (fallback amigável).
// 3) Mensagens de diagnóstico mais claras na tela e no console.
// 4) Mantido: aceitar=update; recusar=update; cancelar=delete; notificações gerais em tempo real.

(function () {
  // ----------------------------- Utils -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/\"/g, '\"').replace(/'/g, "'");

  function ensureFirebase() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      throw new Error("Firebase não inicializado. Garanta que o config global foi carregado ANTES deste arquivo (use defer).");
    }
    return { auth: firebase.auth(), db: firebase.firestore() };
  }

  function toast(msg, type = "info", ms = 2600) {
    if (typeof window.createToast === "function") {
      try { window.createToast(msg, type); return; } catch (_) {}
    }
    console[type === "error" ? "error" : type === "success" ? "log" : "log"](msg);
    const id = "toast-container";
    let c = document.getElementById(id);
    if (!c) {
      c = document.createElement("div");
      c.id = id; Object.assign(c.style, { position: "fixed", top: "12px", right: "12px", zIndex: 9999 });
      document.body.appendChild(c);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    Object.assign(el.style, { margin: "6px", padding: "10px 14px", borderRadius: "10px", color: "#fff",
      background: type === "error" ? "#e74c3c" : type === "success" ? "#2ecc71" : "#444",
      boxShadow: "0 4px 12px rgba(0,0,0,.2)" });
    c.appendChild(el); setTimeout(() => el.remove(), ms);
  }

  // ----------------------------- DOM Fallback -----------------------------
  function ensureContainers() {
    let root = $("#notifications-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "notifications-root";
      root.innerHTML = `
        <section>
          <h3>Pedidos recebidos</h3>
          <div id="friend-requests"></div>
        </section>
        <section>
          <h3>Pedidos enviados</h3>
          <div id="sent-requests"></div>
        </section>
        <section>
          <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;">
            <h3>Notificações</h3>
            <button id="mark-all-read" class="btn">Marcar todas como lidas</button>
          </div>
          <div id="general-notifications"></div>
        </section>
        <div id="notifications-empty" style="display:none;margin-top:12px;opacity:.7;">Sem atividades por aqui.</div>`;
      document.body.appendChild(root);
    }
  }

  // ----------------------------- DOM Refs -----------------------------
  const refs = {
    incomingList: () => document.getElementById("friend-requests"),
    sentList: () => document.getElementById("sent-requests"),
    generalList: () => document.getElementById("general-notifications"),
    markAllBtn: () => document.getElementById("mark-all-read"),
    emptyBox: () => document.getElementById("notifications-empty"),
  };

  // ----------------------------- Estado -----------------------------
  let currentUser = null;
  let profileCache = new Map();
  let unsubIncoming = null;
  let unsubSent = null;
  let unsubGeneral = null;

  // ----------------------------- Perfis -----------------------------
  async function getProfile(db, uid) {
    if (!uid) return { uid, nickname: "Usuário", photoURL: null };
    if (profileCache.has(uid)) return profileCache.get(uid);
    try {
      const snap = await db.collection("users").doc(uid).get();
      const data = snap.exists ? (snap.data() || {}) : {};
      const p = { uid, nickname: data.nickname || data.displayName || data.name || "Usuário", photoURL: data.photoURL || null };
      profileCache.set(uid, p); return p;
    } catch (e) {
      return { uid, nickname: "Usuário", photoURL: null };
    }
  }

  // ----------------------------- Renderização -----------------------------
  function renderIncomingItem(reqId, data, fromProfile) {
    const photo = esc(fromProfile.photoURL || "../img/Design sem nome2.png");
    const name = esc(fromProfile.nickname || "Usuário");
    const when = formatTimestamp(data.timestamp);
    return `
      <div class="request-item" data-id="${esc(reqId)}" data-from="${esc(data.from)}" data-to="${esc(data.to)}">
        <img class="avatar" src="${photo}" alt="${name}">
        <div class="info">
          <strong>${name}</nstrong>
          <span> enviou uma solicitação de amizade</span>
          <small class="when">${when}</small>
        </div>
        <div class="actions">
          <button class="btn-accept">Aceitar</button>
          <button class="btn-decline">Recusar</button>
        </div>
      </div>`;
  }

  function renderSentItem(reqId, data, toProfile) {
    const photo = esc(toProfile.photoURL || "../img/Design sem nome2.png");
    const name = esc(toProfile.nickname || "Usuário");
    const when = formatTimestamp(data.timestamp);
    return `
      <div class="request-item sent" data-id="${esc(reqId)}" data-from="${esc(data.from)}" data-to="${esc(data.to)}">
        <img class="avatar" src="${photo}" alt="${name}">
        <div class="info">
          <span>Você enviou um pedido para</span>
          <strong> ${name}</strong>
          <small class="when">${when}</small>
        </div>
        <div class="actions">
          <button class="btn-cancel">Cancelar</button>
        </div>
      </div>`;
  }

  function iconFor(type) {
    switch (type) {
      case "friend_request": return "👋";
      case "friend_accept": return "✅";
      case "friend_decline": return "❌";
      case "like": return "❤️";
      case "comment": return "💬";
      case "event_invite": return "📅";
      default: return "🔔";
    }
  }

  function renderGeneralItem(id, n) {
    const ico = iconFor(n.type);
    const when = formatTimestamp(n.timestamp);
    const readClass = n.read ? "read" : "unread";
    const from = n.fromUserId ? ` data-from="${esc(n.fromUserId)}"` : "";
    const req = n.requestId ? ` data-req="${esc(n.requestId)}"` : "";
    return `
      <div class="notif-item ${readClass}" data-id="${esc(id)}"${from}${req}>
        <span class="ico">${ico}</span>
        <div class="text">
          <div class="line">${esc(n.content || "Nova atividade")}</div>
          <small class="when">${when}</small>
        </div>
        <button class="btn-mark">Marcar como lida</button>
      </div>`;
  }

  function formatTimestamp(ts) {
    try {
      if (!ts) return "";
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
    } catch { return ""; }
  }

  // ----------------------------- Ações (FR) -----------------------------
  async function acceptRequest(db, reqId) {
    const reqRef = db.collection("friendRequests").doc(reqId);
    const snap = await reqRef.get();
    if (!snap.exists) return toast("Pedido não encontrado.", "error");

    const r = snap.data();
    if (!r || r.to !== currentUser.uid) return toast("Sem permissão para aceitar.", "error");
    if (r.status !== "pending") return toast("Pedido já processado.", "info");

    const now = firebase.firestore.FieldValue.serverTimestamp();

    await reqRef.update({ status: "accepted", acceptedAt: now });

    const aRef = db.collection("users").doc(r.from).collection("friends").doc(r.to);
    const bRef = db.collection("users").doc(r.to).collection("friends").doc(r.from);
    const batch = db.batch();
    batch.set(aRef, { status: "accepted", createdAt: now });
    batch.set(bRef, { status: "accepted", createdAt: now });
    await batch.commit();

    await db.collection("users").doc(r.from).collection("notifications").add({
      type: "friend_accept",
      fromUserId: r.to,
      content: "aceitou sua solicitação de amizade",
      timestamp: now,
      read: false,
    });

    toast("Solicitação aceita. Agora vocês são amigos!", "success");
  }

  async function declineRequest(db, reqId) {
    const reqRef = db.collection("friendRequests").doc(reqId);
    const snap = await reqRef.get();
    if (!snap.exists) return toast("Pedido não encontrado.", "error");

    const r = snap.data();
    if (!r || r.to !== currentUser.uid) return toast("Sem permissão para recusar.", "error");
    if (r.status !== "pending") return toast("Pedido já processado.", "info");

    const now = firebase.firestore.FieldValue.serverTimestamp();

    await reqRef.update({ status: "declined", declinedAt: now });

    await db.collection("users").doc(r.from).collection("notifications").add({
      type: "friend_decline",
      fromUserId: r.to,
      content: "recusou sua solicitação de amizade",
      timestamp: now,
      read: false,
    });

    toast("Solicitação recusada.", "info");
  }

  async function cancelRequest(db, reqId) {
    const reqRef = db.collection("friendRequests").doc(reqId);
    const snap = await reqRef.get();
    if (!snap.exists) return toast("Pedido não encontrado.", "error");

    const r = snap.data();
    if (!r || r.from !== currentUser.uid) return toast("Apenas quem enviou pode cancelar.", "error");

    await reqRef.delete();
    toast("Solicitação cancelada.", "success");
  }

  // ----------------------------- Realtime -----------------------------
  function sortByTimestampDesc(docs) {
    return docs
      .map(doc => ({ id: doc.id, data: doc.data() }))
      .sort((a, b) => {
        const ta = (a.data?.timestamp?.toDate?.() || new Date(0)).getTime();
        const tb = (b.data?.timestamp?.toDate?.() || new Date(0)).getTime();
        return tb - ta;
      });
  }

  async function startIncomingRealtime(db) {
    stopIncomingRealtime();
    if (!refs.incomingList()) return;

    unsubIncoming = db.collection("friendRequests")
      .where("to", "==", currentUser.uid)
      .where("status", "==", "pending")
      .onSnapshot(async (snap) => {
        const container = refs.incomingList();
        if (!container) return;
        if (snap.empty) {
          container.innerHTML = `<div class="empty">Sem solicitações pendentes.</div>`;
          updateEmptyState();
          return;
        }
        const rows = [];
        for (const { id, data } of sortByTimestampDesc(snap.docs)) {
          const p = await getProfile(db, data.from);
          rows.push(renderIncomingItem(id, data, p));
        }
        container.innerHTML = rows.join("");
        updateEmptyState();
      }, (err) => {
        console.error("incoming onSnapshot:", err);
        const c = refs.incomingList(); if (c) c.innerHTML = `<div class="error">Erro ao carregar pedidos recebidos: ${esc(err.message || err.code || 'erro')}</div>`;
        updateEmptyState();
      });
  }
  function stopIncomingRealtime() { if (typeof unsubIncoming === "function") { unsubIncoming(); unsubIncoming = null; } }

  async function startSentRealtime(db) {
    stopSentRealtime();
    if (!refs.sentList()) return;

    unsubSent = db.collection("friendRequests")
      .where("from", "==", currentUser.uid)
      .where("status", "==", "pending")
      .onSnapshot(async (snap) => {
        const container = refs.sentList();
        if (!container) return;
        if (snap.empty) { container.innerHTML = `<div class="empty">Você não tem solicitações pendentes.</div>`; updateEmptyState(); return; }
        const rows = [];
        for (const { id, data } of sortByTimestampDesc(snap.docs)) {
          const p = await getProfile(db, data.to);
          rows.push(renderSentItem(id, data, p));
        }
        container.innerHTML = rows.join("");
        updateEmptyState();
      }, (err) => {
        console.error("sent onSnapshot:", err);
        const c = refs.sentList(); if (c) c.innerHTML = `<div class="error">Erro ao carregar pedidos enviados: ${esc(err.message || err.code || 'erro')}</div>`;
        updateEmptyState();
      });
  }
  function stopSentRealtime() { if (typeof unsubSent === "function") { unsubSent(); unsubSent = null; } }

  async function startGeneralRealtime(db) {
    stopGeneralRealtime();
    if (!refs.generalList()) return;

    unsubGeneral = db.collection("users").doc(currentUser.uid).collection("notifications")
      .orderBy("timestamp", "desc")
      .limit(50)
      .onSnapshot((snap) => {
        const container = refs.generalList();
        if (!container) return;
        if (snap.empty) {
          container.innerHTML = `<div class="empty">Sem atividades por aqui.</div>`;
          updateEmptyState();
          return;
        }
        const rows = [];
        snap.forEach((d) => rows.push(renderGeneralItem(d.id, d.data())));
        container.innerHTML = rows.join("");
        updateEmptyState();
      }, (err) => {
        console.error("general onSnapshot:", err);
        const c = refs.generalList(); if (c) c.innerHTML = `<div class="error">Erro ao carregar notificações: ${esc(err.message || err.code || 'erro')}</div>`;
        updateEmptyState();
      });
  }
  function stopGeneralRealtime() { if (typeof unsubGeneral === "function") { unsubGeneral(); unsubGeneral = null; } }

  function updateEmptyState() {
    const box = refs.emptyBox?.(); if (!box) return;
    const hasIncoming = refs.incomingList() && refs.incomingList().children.length > 0 && !refs.incomingList().querySelector('.empty');
    const hasSent = refs.sentList() && refs.sentList().children.length > 0 && !refs.sentList().querySelector('.empty');
    const hasGeneral = refs.generalList() && refs.generalList().children.length > 0 && !refs.generalList().querySelector('.empty');
    box.style.display = (hasIncoming || hasSent || hasGeneral) ? 'none' : 'block';
  }

  // ----------------------------- Clicks -----------------------------
  document.addEventListener("click", async (e) => {
    let db; try { ({ db } = ensureFirebase()); } catch { return; }

    const acceptBtn = e.target.closest('.btn-accept');
    if (acceptBtn) {
      const item = acceptBtn.closest('.request-item');
      const id = item?.dataset?.id; if (!id) return;
      acceptBtn.disabled = true; acceptBtn.textContent = 'Aceitando...';
      try { await acceptRequest(db, id); } catch (err) { console.error(err); toast(err?.message || 'Falha ao aceitar.', 'error'); }
      finally { acceptBtn.disabled = false; acceptBtn.textContent = 'Aceitar'; }
      return;
    }

    const declineBtn = e.target.closest('.btn-decline');
    if (declineBtn) {
      const item = declineBtn.closest('.request-item');
      const id = item?.dataset?.id; if (!id) return;
      declineBtn.disabled = true; declineBtn.textContent = 'Recusando...';
      try { await declineRequest(db, id); } catch (err) { console.error(err); toast(err?.message || 'Falha ao recusar.', 'error'); }
      finally { declineBtn.disabled = false; declineBtn.textContent = 'Recusar'; }
      return;
    }

    const cancelBtn = e.target.closest('.btn-cancel');
    if (cancelBtn) {
      const item = cancelBtn.closest('.request-item');
      const id = item?.dataset?.id; if (!id) return;
      cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelando...';
      try { await cancelRequest(db, id); } catch (err) { console.error(err); toast(err?.message || 'Falha ao cancelar.', 'error'); }
      finally { cancelBtn.disabled = false; cancelBtn.textContent = 'Cancelar'; }
      return;
    }

    const markBtn = e.target.closest('.btn-mark');
    if (markBtn) {
      const row = markBtn.closest('.notif-item');
      const id = row?.dataset?.id; if (!id) return;
      try {
        await db.collection('users').doc(currentUser.uid).collection('notifications').doc(id).update({ read: true });
        row.classList.remove('unread'); row.classList.add('read');
      } catch (err) { console.error(err); toast('Falha ao marcar como lida.', 'error'); }
      return;
    }

    const openUser = e.target.closest('.request-item .avatar, .request-item .info strong');
    if (openUser) {
      const item = openUser.closest('.request-item');
      const from = item?.dataset?.from; if (from) window.location.href = `../pages/user.html?uid=${from}`;
    }
  });

  // ----------------------------- Mark all as read -----------------------------
  async function markAllAsRead() {
    try {
      const { db } = ensureFirebase();
      const col = db.collection('users').doc(currentUser.uid).collection('notifications');
      const snap = await col.where('read', '==', false).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.forEach(doc => batch.update(col.doc(doc.id), { read: true }));
      await batch.commit();
      toast('Todas marcadas como lidas.', 'success');
    } catch (e) {
      console.error(e); toast('Não foi possível marcar todas.', 'error');
    }
  }

  // ----------------------------- Boot -----------------------------
  document.addEventListener('DOMContentLoaded', () => {
    console.info('[notificacoes] iniciando...');
    ensureContainers();

    let auth, db; try { ({ auth, db } = ensureFirebase()); } catch (e) { console.error(e); toast(e.message, 'error'); return; }

    firebase.auth().onAuthStateChanged(async (u) => {
      currentUser = u || null;
      stopIncomingRealtime(); stopSentRealtime(); stopGeneralRealtime();
      if (!u) {
        if (refs.incomingList()) refs.incomingList().innerHTML = '<div class="empty">Faça login para ver seus pedidos.</div>';
        if (refs.sentList()) refs.sentList().innerHTML = '<div class="empty">Faça login para ver os pedidos enviados.</div>';
        if (refs.generalList()) refs.generalList().innerHTML = '<div class="empty">Faça login para ver notificações.</div>';
        updateEmptyState();
        return;
      }
      startIncomingRealtime(db);
      startSentRealtime(db);
      startGeneralRealtime(db);
      updateEmptyState();
    });

    const markAll = refs.markAllBtn();
    if (markAll) markAll.addEventListener('click', markAllAsRead);
  });
})();
