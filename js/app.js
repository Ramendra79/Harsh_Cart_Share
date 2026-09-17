(function(){
"use strict";

  var LS_PREFIX = "cartshare:";
  var state = {
    room: null,        // room code
    name: null,         // this user's display name
  };

  function roomKey(code){ return LS_PREFIX + "room:" + code; }

  function loadRoom(code){
    try{
      var raw = localStorage.getItem(roomKey(code));
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  function saveRoom(code, data){
    try{
      localStorage.setItem(roomKey(code), JSON.stringify(data));
    }catch(e){ /* storage unavailable; app still works for this session */ }
    render();
  }

  function newRoomData(){
    return { participants: [], items: [], log: [] };
  }

  function genCode(){
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for(var i=0;i<5;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  function logEvent(data, text){
    data.log.unshift({ text: text, t: Date.now() });
    if(data.log.length > 60) data.log.length = 60;
  }

  function timeAgo(ts){
    var s = Math.floor((Date.now()-ts)/1000);
    if(s < 5) return "just now";
    if(s < 60) return s + "s ago";
    var m = Math.floor(s/60);
    if(m < 60) return m + "m ago";
    var h = Math.floor(m/60);
    return h + "h ago";
  }

  function fmt(n){ return "$" + n.toFixed(2); }

  // ---------- Persisted session (which room/name this tab is in) ----------
  function getSession(){
    try{
      var raw = localStorage.getItem(LS_PREFIX + "session");
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function setSession(s){
    try{ localStorage.setItem(LS_PREFIX + "session", JSON.stringify(s)); }catch(e){}
  }
  function clearSession(){
    try{ localStorage.removeItem(LS_PREFIX + "session"); }catch(e){}
  }

  var sess = getSession();
  if(sess && sess.room && sess.name){
    state.room = sess.room;
    state.name = sess.name;
  }

  // ---------- Actions ----------
  function createRoom(name){
    var code = genCode();
    var data = newRoomData();
    data.participants.push(name);
    logEvent(data, "<b>"+esc(name)+"</b> created the room");
    saveRoom(code, data);
    state.room = code; state.name = name;
    setSession({room:code, name:name});
    render();
  }

  function joinRoom(name, code){
    code = code.trim().toUpperCase();
    var data = loadRoom(code);
    var err = document.getElementById("gate-error");
    if(!data){
      if(err) err.textContent = "No room found with code " + code + ". Check it and try again.";
      return;
    }
    if(data.participants.indexOf(name) === -1){
      data.participants.push(name);
      logEvent(data, "<b>"+esc(name)+"</b> joined the room");
    }
    saveRoom(code, data);
    state.room = code; state.name = name;
    setSession({room:code, name:name});
    render();
  }

  function leaveRoom(){
    state.room = null;
    clearSession();
    render();
  }

  function addItem(name, qty, price){
    var data = loadRoom(state.room);
    if(!data) return;
    var item = {
      id: Date.now() + "-" + Math.floor(Math.random()*1000),
      name: name, qty: qty, price: price, by: state.name
    };
    data.items.push(item);
    logEvent(data, "<b>"+esc(state.name)+"</b> added " + (qty>1? qty+"× ":"") + esc(name));
    saveRoom(state.room, data);
  }

  function removeItem(id){
    var data = loadRoom(state.room);
    if(!data) return;
    var idx = -1;
    for(var i=0;i<data.items.length;i++){ if(data.items[i].id === id){ idx = i; break; } }
    if(idx === -1) return;
    var removed = data.items[idx];
    data.items.splice(idx,1);
    logEvent(data, "<b>"+esc(state.name)+"</b> removed " + esc(removed.name));
    saveRoom(state.room, data);
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  // ---------- Cross-tab sync ----------
  window.addEventListener("storage", function(e){
    if(!state.room) return;
    if(e.key === roomKey(state.room)){
      render();
    }
  });

  // Fallback: light polling in case the storage event is missed by a tab
  setInterval(function(){ if(state.room) render(); }, 2500);

  // ---------- Rendering ----------
  var showReceipt = false;
  var copyFeedback = false;

  function render(){
    var app = document.getElementById("app");
    if(!state.room){
      app.innerHTML = gateHTML();
      wireGate();
      return;
    }
    var data = loadRoom(state.room);
    if(!data){ state.room = null; clearSession(); render(); return; }
    app.innerHTML = roomHTML(data);
    wireRoom(data);
  }

  function gateHTML(){
    return ''
    + '<div class="gate">'
    + '  <h1 class="gate-mark">Cart<span>Share</span></h1>'
    + '  <p class="gate-sub">One cart, one room, no more "did anyone get milk?" texts.</p>'
    + '  <div class="field"><label for="gname">Your name</label>'
    + '    <input id="gname" type="text" placeholder="e.g. Priya" maxlength="24"></div>'
    + '  <div class="field code"><label for="gcode">Room code</label>'
    + '    <input id="gcode" type="text" placeholder="e.g. 7K2QM" maxlength="8"></div>'
    + '  <div class="gate-actions">'
    + '    <button class="btn btn-primary" id="btn-join">Join room</button>'
    + '    <button class="btn btn-outline" id="btn-create">Create new room</button>'
    + '  </div>'
    + '  <div class="gate-error" id="gate-error"></div>'
    + '  <div class="gate-divider">how it works</div>'
    + '  <p class="sync-note" style="text-align:left; margin-top:0;">'
    + '  Create a room to get a code, or enter a code someone shared with you. '
    + '  Everyone in the room sees the same cart, activity log, and running total &mdash; '
    + '  open this page in a second tab with the same code to see it sync live.</p>'
    + '</div>';
  }

  function wireGate(){
    var err = document.getElementById("gate-error");
    function getName(){
      var v = document.getElementById("gname").value.trim();
      if(!v){ err.textContent = "Enter your name first."; return null; }
      return v;
    }
    document.getElementById("btn-create").addEventListener("click", function(){
      var n = getName(); if(!n) return;
      createRoom(n);
    });
    document.getElementById("btn-join").addEventListener("click", function(){
      var n = getName(); if(!n) return;
      var code = document.getElementById("gcode").value.trim();
      if(!code){ err.textContent = "Enter a room code to join."; return; }
      joinRoom(n, code);
    });
    document.getElementById("gcode").addEventListener("keydown", function(e){
      if(e.key === "Enter") document.getElementById("btn-join").click();
    });
  }

  var THRESHOLD = 75;

  function roomHTML(data){
    var subtotal = data.items.reduce(function(s,it){ return s + it.qty*it.price; }, 0);
    var pct = Math.min(100, (subtotal/THRESHOLD)*100);
    var unlocked = subtotal >= THRESHOLD;

    var peopleHTML = data.participants.map(function(p){
      return '<li><span class="dot"></span>' + esc(p) +
        (p === state.name ? ' <span class="you-tag">(you)</span>' : '') + '</li>';
    }).join("");

    var logHTML = data.log.length
      ? data.log.map(function(l){
          return '<li>' + l.text + '<span class="t">' + timeAgo(l.t) + '</span></li>';
        }).join("")
      : '<li class="log-empty">No activity yet.</li>';

    var itemsHTML = data.items.length
      ? data.items.map(function(it){
          return '<li class="item-row">'
            + '<div class="item-name">' + esc(it.name) + '<span class="who">added by ' + esc(it.by) + '</span></div>'
            + '<div class="item-qty">×' + it.qty + '</div>'
            + '<div class="item-price">' + fmt(it.qty*it.price) + '</div>'
            + '<button class="item-remove" data-remove="' + it.id + '" aria-label="Remove ' + esc(it.name) + '">&times;</button>'
            + '</li>';
        }).join("")
      : '<li class="items-empty">The cart is empty. Add the first item below.</li>';

    var html = ''
    + '<div class="masthead">'
    + '  <div><h1>Cart<span class="mark">Share</span></h1><div class="tagline">signed in as ' + esc(state.name) + '</div></div>'
    + '  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">'
    + '    <div class="room-chip">room&nbsp;<span class="code">' + esc(state.room) + '</span><button id="btn-copy">' + (copyFeedback ? "copied" : "copy") + '</button></div>'
    + '    <button class="leave-btn" id="btn-leave">Leave room</button>'
    + '  </div>'
    + '</div>'
    + '<div class="grid">'
    + '  <div>'
    + '    <div class="panel" style="margin-bottom:18px;">'
    + '      <h2>In this room</h2>'
    + '      <ul class="people">' + peopleHTML + '</ul>'
    + '    </div>'
    + '    <div class="panel">'
    + '      <h2>Activity</h2>'
    + '      <ul class="log">' + logHTML + '</ul>'
    + '    </div>'
    + '  </div>'
    + '  <div class="panel cart-panel">'
    + '    <form class="add-form" id="add-form">'
    + '      <input class="i-name" id="i-name" type="text" placeholder="Item name" required>'
    + '      <input class="i-qty" id="i-qty" type="number" min="1" value="1" placeholder="Qty">'
    + '      <input class="i-price" id="i-price" type="number" min="0" step="0.01" placeholder="Price">'
    + '      <button type="submit">Add to cart</button>'
    + '    </form>'
    + '    <div class="threshold">'
    + '      <div class="threshold-row"><span>Free-shipping threshold</span>'
    + '        <span class="status ' + (unlocked ? "unlocked" : "") + '">'
    + (unlocked ? "unlocked" : fmt(THRESHOLD - subtotal) + " to go")
    + '        </span></div>'
    + '      <div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>'
    + '    </div>'
    + '    <ul class="items">' + itemsHTML + '</ul>'
    + '    <div class="cart-footer">'
    + '      <div class="subtotal">subtotal <b>' + fmt(subtotal) + '</b></div>'
    + '      <button class="print-btn" id="btn-receipt">Generate receipt</button>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<p class="sync-note">Cart data lives in this browser\'s storage and syncs automatically across tabs open to the same room.</p>'
    + (showReceipt ? receiptHTML(data, subtotal) : '');

    return html;
  }

  function receiptHTML(data, subtotal){
    var lines = data.items.map(function(it){
      return '<div class="rline"><div class="rname">' + esc(it.name) + ' ×' + it.qty
        + '<span class="rwho">' + esc(it.by) + '</span></div><div>' + fmt(it.qty*it.price) + '</div></div>';
    }).join("");
    return ''
    + '<div class="modal-backdrop" id="receipt-backdrop">'
    + '  <div class="receipt">'
    + '    <h3>CartShare Receipt</h3>'
    + '    <div class="rmeta">room ' + esc(state.room) + ' &middot; ' + new Date().toLocaleString() + '</div>'
    + '    <hr>'
    + (lines || '<div class="rline">Cart is empty</div>')
    + '    <hr>'
    + '    <div class="rtotal"><span>Total</span><span>' + fmt(subtotal) + '</span></div>'
    + '    <div class="rtotal" style="font-size:11px; font-weight:400; color:var(--ink-soft);"><span>Split ' + Math.max(1,data.participants.length) + ' ways</span><span>' + fmt(subtotal/Math.max(1,data.participants.length)) + ' each</span></div>'
    + '    <div class="receipt-actions">'
    + '      <button class="btn-outline" id="btn-close-receipt">Close</button>'
    + '      <button class="btn-primary" id="btn-print" style="border:none;">Print</button>'
    + '    </div>'
    + '  </div>'
    + '</div>';
  }

  function wireRoom(data){
    document.getElementById("btn-leave").addEventListener("click", leaveRoom);
    document.getElementById("btn-copy").addEventListener("click", function(){
      var code = state.room;
      function done(){ copyFeedback = true; render(); setTimeout(function(){ copyFeedback=false; render(); }, 1500); }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code).then(done).catch(done);
      } else { done(); }
    });

    document.getElementById("add-form").addEventListener("submit", function(e){
      e.preventDefault();
      var name = document.getElementById("i-name").value.trim();
      if(!name) return;
      var qty = parseInt(document.getElementById("i-qty").value, 10) || 1;
      var price = parseFloat(document.getElementById("i-price").value) || 0;
      addItem(name, qty, price);
      document.getElementById("i-name").value = "";
      document.getElementById("i-qty").value = "1";
      document.getElementById("i-price").value = "";
      document.getElementById("i-name").focus();
    });

    var removeBtns = document.querySelectorAll("[data-remove]");
    for(var i=0;i<removeBtns.length;i++){
      removeBtns[i].addEventListener("click", function(){
        removeItem(this.getAttribute("data-remove"));
      });
    }

    document.getElementById("btn-receipt").addEventListener("click", function(){
      showReceipt = true; render();
    });

    var backdrop = document.getElementById("receipt-backdrop");
    if(backdrop){
      backdrop.addEventListener("click", function(e){
        if(e.target === backdrop){ showReceipt = false; render(); }
      });
      document.getElementById("btn-close-receipt").addEventListener("click", function(){
        showReceipt = false; render();
      });
      document.getElementById("btn-print").addEventListener("click", function(){
        window.print();
      });
    }
  }

  render();
})();
