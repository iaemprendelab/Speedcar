(function () {
  "use strict";

  const container = document.getElementById("game-container");
  const room = document.getElementById("room");
  const messageEl = document.getElementById("message");
  const invSlots = document.getElementById("inv-slots");
  const timerEl = document.getElementById("timer");
  const bestEl = document.getElementById("best");
  const hintBtn = document.getElementById("hintBtn");
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modal-content");
  const modalClose = document.getElementById("modalClose");
  const startScreen = document.getElementById("start-screen");
  const winScreen = document.getElementById("win-screen");
  const finalTimeEl = document.getElementById("finalTime");
  const hintsUsedEl = document.getElementById("hintsUsed");
  const newBestMsg = document.getElementById("newBestMsg");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const monitorEl = document.getElementById("monitor");
  const ventEl = document.querySelector(".vent");
  const doorEl = document.querySelector(".door");

  const BEST_KEY = "speedcar_escape_best_time";
  const TOOLBOX_CODE = "418";
  const PASSWORD = "TURBO";

  const ITEMS = {
    screwdriver: { icon: "🪛", name: "Destornillador" },
    fuse: { icon: "🔌", name: "Fusible" },
    carKey: { icon: "🔑", name: "Llave del coche" },
    remote: { icon: "📟", name: "Mando del garaje" },
  };

  const HINTS = [
    { done: () => state.toolboxOpen, text: "El póster del Gran Premio muestra un podio. ¿Y si el orden de los números abre algo?" },
    { done: () => state.ventOpen, text: "La rejilla de ventilación está atornillada. Necesitas una herramienta." },
    { done: () => state.powerOn, text: "La caja de fusibles tiene un hueco vacío. Algo que encontraste encaja ahí." },
    { done: () => state.drawerOpen, text: "Con la luz encendida aparece algo pintado en la pared. El ordenador pide una contraseña." },
    { done: () => state.carSearched, text: "Tienes la llave del coche. Prueba a usarla en el coche." },
    { done: () => false, text: "El mando abre la puerta del garaje. ¡Úsalo en la puerta!" },
  ];

  let state;
  let timerId = null;
  let startTime = 0;

  function freshState() {
    return {
      inventory: [],
      selected: null,
      toolboxOpen: false,
      ventOpen: false,
      powerOn: false,
      drawerOpen: false,
      carSearched: false,
      escaped: false,
      hints: 0,
    };
  }

  // ---------- Utilidades ----------

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function loadBest() {
    try {
      const v = parseInt(localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(v) ? v : null;
    } catch (e) {
      return null;
    }
  }

  function saveBest(ms) {
    try {
      localStorage.setItem(BEST_KEY, String(ms));
    } catch (e) {
      /* almacenamiento no disponible */
    }
  }

  function renderBest() {
    const best = loadBest();
    bestEl.textContent = "Mejor: " + (best === null ? "--:--" : formatTime(best));
  }

  function say(text) {
    messageEl.textContent = text;
  }

  function scaleToFit() {
    const scale = Math.min(window.innerWidth / 480, window.innerHeight / 720, 1);
    container.style.transform = "scale(" + scale + ")";
  }

  // ---------- Inventario ----------

  function addItem(id) {
    if (!state.inventory.includes(id)) state.inventory.push(id);
    renderInventory();
  }

  function removeItem(id) {
    state.inventory = state.inventory.filter((i) => i !== id);
    if (state.selected === id) state.selected = null;
    renderInventory();
  }

  function renderInventory() {
    invSlots.innerHTML = "";
    state.inventory.forEach((id) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot" + (state.selected === id ? " selected" : "");
      slot.textContent = ITEMS[id].icon;
      slot.title = ITEMS[id].name;
      slot.addEventListener("click", () => {
        state.selected = state.selected === id ? null : id;
        if (state.selected) say("Has seleccionado: " + ITEMS[id].name + ". Toca dónde quieres usarlo.");
        renderInventory();
      });
      invSlots.appendChild(slot);
    });
    document.body.classList.toggle("using", !!state.selected);
  }

  // ---------- Modal ----------

  function openModal(html) {
    modalContent.innerHTML = html;
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
    modalContent.innerHTML = "";
  }

  function openCodeInput(opts) {
    openModal(
      "<h2>" + opts.title + "</h2>" +
      "<p>" + opts.prompt + "</p>" +
      '<div class="code-display" id="codeDisplay"></div>' +
      '<div class="' + opts.layout + '" id="codeKeys"></div>'
    );
    const display = document.getElementById("codeDisplay");
    const keysEl = document.getElementById("codeKeys");
    let value = "";

    function update() {
      display.classList.remove("error");
      display.textContent = value.padEnd(opts.length, "_");
    }

    function press(key) {
      if (key === "⌫") {
        value = value.slice(0, -1);
      } else if (value.length < opts.length) {
        value += key;
      }
      update();
      if (value.length === opts.length) {
        if (value === opts.answer) {
          closeModal();
          opts.onSuccess();
        } else {
          display.textContent = "ERROR";
          display.classList.add("error");
          value = "";
          setTimeout(update, 700);
        }
      }
    }

    opts.keys.forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = k;
      b.addEventListener("click", () => press(k));
      keysEl.appendChild(b);
    });
    update();
  }

  // ---------- Interacciones ----------

  const handlers = {
    poster() {
      say("Un póster del Gran Premio. Podio: 🥇 coche #4, 🥈 coche #1, 🥉 coche #8.");
    },

    calendar() {
      openModal(
        "<h2>📅 Calendario</h2>" +
        '<div class="note">Recordatorio:<br>• Cambiar el fusible quemado (¡guardé el de repuesto en la ventilación!)<br>• Revisar el ordenador del taller<br>• No olvidar el mando en la guantera</div>'
      );
      say("Un calendario lleno de notas del mecánico.");
    },

    trash() {
      openModal(
        "<h2>🗑️ Papelera</h2>" +
        '<div class="note">"Para no olvidar la clave del ordenador la pinté en la pared con pintura fluorescente. Solo se ve con la luz encendida."</div>'
      );
      say("Entre papeles arrugados encuentras una nota.");
    },

    toolbox() {
      if (state.toolboxOpen) {
        say("La caja de herramientas está vacía.");
        return;
      }
      openCodeInput({
        title: "🧰 Caja de herramientas",
        prompt: "Un candado de 3 dígitos.",
        length: 3,
        answer: TOOLBOX_CODE,
        layout: "keypad",
        keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"],
        onSuccess() {
          state.toolboxOpen = true;
          addItem("screwdriver");
          say("¡Clic! El candado se abre. Dentro hay un destornillador. 🪛");
        },
      });
    },

    vent() {
      if (state.ventOpen) {
        say("La rejilla ya está abierta. No queda nada dentro.");
        return;
      }
      if (state.selected === "screwdriver") {
        state.ventOpen = true;
        ventEl.classList.add("opened");
        removeItem("screwdriver");
        addItem("fuse");
        say("Quitas los tornillos de la rejilla. ¡Dentro hay un fusible de repuesto! 🔌");
        return;
      }
      say("Una rejilla de ventilación sujeta con cuatro tornillos.");
    },

    fusebox() {
      if (state.powerOn) {
        say("Los fusibles funcionan. Hay corriente en el garaje.");
        return;
      }
      if (state.selected === "fuse") {
        state.powerOn = true;
        removeItem("fuse");
        room.classList.remove("dark");
        monitorEl.classList.add("on");
        say("Colocas el fusible… ¡Las luces se encienden! Algo verde brilla en la pared.");
        return;
      }
      say("La caja de fusibles. Falta un fusible: por eso no hay luz.");
    },

    desk() {
      if (state.drawerOpen) {
        say("El cajón está abierto y vacío.");
        return;
      }
      if (!state.powerOn) {
        say("Un escritorio con un ordenador apagado y un cajón con cierre electrónico. No hay corriente.");
        return;
      }
      openCodeInput({
        title: "🖥️ Ordenador del taller",
        prompt: '<span class="terminal">SPEEDCAR OS v2.0<br>&gt; Introduce la contraseña para abrir el cajón:</span>',
        length: PASSWORD.length,
        answer: PASSWORD,
        layout: "letters",
        keys: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").concat(["⌫"]),
        onSuccess() {
          state.drawerOpen = true;
          addItem("carKey");
          say("ACCESO CONCEDIDO. El cajón se abre: ¡la llave del coche! 🔑");
        },
      });
    },

    car() {
      if (state.carSearched) {
        say("El coche de carreras. Ya revisaste la guantera.");
        return;
      }
      if (state.selected === "carKey") {
        state.carSearched = true;
        removeItem("carKey");
        addItem("remote");
        say("Abres el coche con la llave. En la guantera encuentras el mando del garaje. 📟");
        return;
      }
      say("Un coche de carreras. Las puertas están cerradas con llave.");
    },

    door() {
      if (state.selected === "remote") {
        removeItem("remote");
        doorEl.classList.add("open");
        say("Pulsas el mando… ¡La puerta del garaje se levanta!");
        win();
        return;
      }
      say("La puerta del garaje. Está cerrada y es motorizada: necesita un mando.");
    },
  };

  function onHotspot(id) {
    if (state.escaped) return;
    const selectedBefore = state.selected;
    handlers[id]();
    // Si el objeto seleccionado no se usó, avisar y deseleccionar.
    if (selectedBefore && state.selected === selectedBefore) {
      say("Eso no funciona aquí. (" + ITEMS[selectedBefore].name + ")");
      state.selected = null;
      renderInventory();
    }
  }

  function showHint() {
    if (state.escaped) return;
    const hint = HINTS.find((h) => !h.done());
    state.hints++;
    say("💡 " + hint.text);
  }

  // ---------- Flujo de juego ----------

  function tick() {
    timerEl.textContent = "⏱ " + formatTime(Date.now() - startTime);
  }

  function startGame() {
    state = freshState();
    room.classList.add("dark");
    monitorEl.classList.remove("on");
    ventEl.classList.remove("opened");
    doorEl.classList.remove("open");
    renderInventory();
    closeModal();
    say("Estás encerrado en el garaje de Speed Car. Está oscuro… ¡encuentra la forma de salir!");
    startScreen.classList.add("hidden");
    winScreen.classList.add("hidden");
    startTime = Date.now();
    tick();
    clearInterval(timerId);
    timerId = setInterval(tick, 250);
  }

  function win() {
    state.escaped = true;
    clearInterval(timerId);
    const elapsed = Date.now() - startTime;
    const best = loadBest();
    const isBest = best === null || elapsed < best;
    if (isBest) saveBest(elapsed);
    renderBest();
    finalTimeEl.textContent = "Tiempo: " + formatTime(elapsed);
    hintsUsedEl.textContent = "Pistas usadas: " + state.hints;
    newBestMsg.classList.toggle("hidden", !isBest);
    setTimeout(() => winScreen.classList.remove("hidden"), 1600);
  }

  document.querySelectorAll(".hotspot").forEach((el) => {
    el.addEventListener("click", () => onHotspot(el.dataset.id));
  });
  hintBtn.addEventListener("click", showHint);
  modalClose.addEventListener("click", closeModal);
  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  window.addEventListener("resize", scaleToFit);

  state = freshState();
  renderBest();
  scaleToFit();
})();
