"use strict";

// ---------- Nutrients ----------
// `limit: true` means the target is a maximum rather than a goal.
const NUTRIENTS = [
  { key: "kcal", label: "Calories", unit: "kcal", target: 2000 },
  { key: "protein", label: "Protein", unit: "g", target: 50 },
  { key: "carbs", label: "Carbs", unit: "g", target: 275 },
  { key: "fat", label: "Fat", unit: "g", target: 78 },
  { key: "fiber", label: "Fiber", unit: "g", target: 28 },
  { key: "sugar", label: "Sugar", unit: "g", target: 50, limit: true },
  { key: "satfat", label: "Saturated fat", unit: "g", target: 20, limit: true },
  { key: "sodium", label: "Sodium", unit: "mg", target: 2300, limit: true },
  { key: "potassium", label: "Potassium", unit: "mg", target: 4700 },
  { key: "calcium", label: "Calcium", unit: "mg", target: 1300 },
  { key: "iron", label: "Iron", unit: "mg", target: 18 },
  { key: "vitc", label: "Vitamin C", unit: "mg", target: 90 },
  { key: "vitd", label: "Vitamin D", unit: "µg", target: 20 },
];
const MACROS = ["protein", "carbs", "fat"];

// ---------- Storage ----------
const STORAGE_KEY = "food-tracker-v1";

function defaultState() {
  return {
    foods: STARTER_FOODS.map(([name, servingG, servingLabel, values]) => ({
      id: uid(),
      name,
      servingG,
      servingLabel,
      n: Object.fromEntries(NUTRIENTS.map((x, i) => [x.key, values[i]])),
      used: 0,
    })),
    log: {},
    targets: Object.fromEntries(NUTRIENTS.map((x) => [x.key, x.target])),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return defaultState();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = load();

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmt(v) {
  if (!v) return "0";
  return Math.abs(v) < 10 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function isoDate(d) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 10);
}

function shiftDate(iso, days) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

// Nutrients for a given amount of food, from per-100 g values.
function scale(n, grams) {
  const out = {};
  for (const { key } of NUTRIENTS) out[key] = ((n[key] || 0) * grams) / 100;
  return out;
}

function dayEntries(date) {
  return state.log[date] || [];
}

function dayTotals(date) {
  const t = Object.fromEntries(NUTRIENTS.map((x) => [x.key, 0]));
  for (const e of dayEntries(date)) {
    const s = scale(e.n, e.grams);
    for (const k in t) t[k] += s[k];
  }
  return t;
}

// ---------- Tabs ----------
document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + btn.dataset.view));
    if (btn.dataset.view === "foods") renderFoods();
    if (btn.dataset.view === "targets") renderTargets();
  });
});

// ---------- Log view ----------
let currentDate = isoDate(new Date());

$("#date").addEventListener("change", (e) => {
  if (e.target.value) {
    currentDate = e.target.value;
    renderLog();
  }
});
$("#prev-day").addEventListener("click", () => {
  currentDate = shiftDate(currentDate, -1);
  renderLog();
});
$("#next-day").addEventListener("click", () => {
  currentDate = shiftDate(currentDate, 1);
  renderLog();
});

function bar(value, target, limit) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target && value > target;
  const cls = over ? (limit ? "over" : "done") : "";
  return `<div class="bar ${cls}"><span style="width:${pct}%"></span></div>`;
}

function renderLog() {
  $("#date").value = currentDate;
  const t = dayTotals(currentDate);
  const targets = state.targets;

  const left = targets.kcal - t.kcal;
  const macroCals = { protein: t.protein * 4, carbs: t.carbs * 4, fat: t.fat * 9 };
  const macroSum = macroCals.protein + macroCals.carbs + macroCals.fat;

  $("#summary").innerHTML = `
    <div class="kcal">
      <div><strong>${fmt(t.kcal)}</strong> / ${fmt(targets.kcal)} kcal</div>
      <div class="muted">${left >= 0 ? fmt(left) + " left" : fmt(-left) + " over"}</div>
    </div>
    ${bar(t.kcal, targets.kcal, true)}
    <div class="macros">
      ${MACROS.map((k) => {
        const nut = NUTRIENTS.find((x) => x.key === k);
        const share = macroSum ? Math.round((macroCals[k] / macroSum) * 100) : 0;
        return `<div class="macro ${k}">
          <div class="macro-label">${nut.label} <span class="muted">${share}%</span></div>
          <div><strong>${fmt(t[k])}</strong> / ${fmt(targets[k])} g</div>
          ${bar(t[k], targets[k])}
        </div>`;
      }).join("")}
    </div>`;

  const entries = dayEntries(currentDate);
  $("#entries").innerHTML = entries.length
    ? entries
        .map((e) => {
          const s = scale(e.n, e.grams);
          const amount = e.unit === "serving" ? `${fmt(e.qty)} × ${esc(e.servingLabel || "serving")} (${fmt(e.grams)} g)` : `${fmt(e.grams)} g`;
          return `<li data-id="${e.id}" tabindex="0">
            <div><div>${esc(e.name)}</div><div class="muted small">${amount}</div></div>
            <div class="right"><strong>${fmt(s.kcal)}</strong> kcal<div class="muted small">P ${fmt(s.protein)} · C ${fmt(s.carbs)} · F ${fmt(s.fat)}</div></div>
          </li>`;
        })
        .join("")
    : `<li class="empty muted">Nothing logged for this day.</li>`;

  $("#details").innerHTML =
    `<tr><th>Nutrient</th><th>Total</th><th>Target</th><th></th></tr>` +
    NUTRIENTS.map((x) => {
      const target = targets[x.key];
      const pct = target ? Math.round((t[x.key] / target) * 100) : 0;
      return `<tr>
        <td>${x.label}${x.limit ? ' <span class="muted small">(max)</span>' : ""}</td>
        <td>${fmt(t[x.key])} ${x.unit}</td>
        <td class="muted">${fmt(target)} ${x.unit}</td>
        <td class="pct ${x.limit && pct > 100 ? "over-text" : ""}">${pct}%</td>
      </tr>`;
    }).join("");
}

function openEntryFromList(ev) {
  const li = ev.target.closest("li[data-id]");
  if (li) openEntryDialog(dayEntries(currentDate).find((e) => e.id === li.dataset.id));
}
$("#entries").addEventListener("click", openEntryFromList);
$("#entries").addEventListener("keydown", (ev) => ev.key === "Enter" && openEntryFromList(ev));

// ---------- Entry dialog ----------
const entryDialog = $("#entry-dialog");
let entryFood = null; // { name, n, servingG, servingLabel, foodId }
let editingEntry = null;

function foodsByRecent(filter) {
  const q = (filter || "").trim().toLowerCase();
  return state.foods
    .filter((f) => !q || f.name.toLowerCase().includes(q))
    .sort((a, b) => (b.used || 0) - (a.used || 0) || a.name.localeCompare(b.name));
}

function renderEntryResults() {
  const foods = foodsByRecent($("#entry-search").value);
  $("#entry-results").innerHTML = foods.length
    ? foods
        .map((f) => `<li data-id="${f.id}" tabindex="0"><span>${esc(f.name)}</span><span class="muted small">${fmt(f.n.kcal)} kcal/100 g</span></li>`)
        .join("")
    : `<li class="empty muted">No matching foods.</li>`;
}

function showEntryStep(step) {
  $("#entry-pick").hidden = step !== "pick";
  $("#entry-amount").hidden = step !== "amount";
  $("#entry-save").hidden = step !== "amount";
}

function openEntryDialog(entry) {
  editingEntry = entry || null;
  $("#entry-title").textContent = entry ? "Edit entry" : "Add food";
  $("#entry-delete").hidden = !entry;
  if (entry) {
    selectEntryFood({ name: entry.name, n: entry.n, servingG: entry.servingG, servingLabel: entry.servingLabel, foodId: entry.foodId });
    $("#entry-unit").value = entry.unit === "serving" && entry.servingG ? "serving" : "g";
    $("#entry-qty").value = entry.unit === "serving" ? entry.qty : entry.grams;
    updatePreview();
  } else {
    entryFood = null;
    $("#entry-search").value = "";
    renderEntryResults();
    showEntryStep("pick");
  }
  entryDialog.showModal();
  if (!entry) $("#entry-search").focus();
}

function selectEntryFood(food) {
  entryFood = food;
  $("#entry-food-name").textContent = food.name;
  const unit = $("#entry-unit");
  unit.innerHTML = `<option value="g">grams</option>`;
  if (food.servingG) {
    unit.innerHTML += `<option value="serving">× ${esc(food.servingLabel || "serving")} (${fmt(food.servingG)} g)</option>`;
    unit.value = "serving";
    $("#entry-qty").value = 1;
  } else {
    $("#entry-qty").value = 100;
  }
  showEntryStep("amount");
  updatePreview();
}

function entryGrams() {
  const qty = parseFloat($("#entry-qty").value) || 0;
  return $("#entry-unit").value === "serving" ? qty * entryFood.servingG : qty;
}

function updatePreview() {
  if (!entryFood) return;
  const s = scale(entryFood.n, entryGrams());
  $("#entry-preview").textContent = `${fmt(s.kcal)} kcal · Protein ${fmt(s.protein)} g · Carbs ${fmt(s.carbs)} g · Fat ${fmt(s.fat)} g`;
}

$("#add-entry").addEventListener("click", () => openEntryDialog());
$("#entry-search").addEventListener("input", renderEntryResults);
$("#entry-qty").addEventListener("input", updatePreview);
$("#entry-unit").addEventListener("change", () => {
  const grams = parseFloat($("#entry-qty").value) || 0;
  // Convert the current amount so switching units keeps the same quantity.
  if ($("#entry-unit").value === "serving") $("#entry-qty").value = fmt(grams / entryFood.servingG);
  else $("#entry-qty").value = fmt(grams * entryFood.servingG);
  updatePreview();
});

function pickResult(ev) {
  const li = ev.target.closest("li[data-id]");
  if (!li) return;
  const f = state.foods.find((x) => x.id === li.dataset.id);
  selectEntryFood({ name: f.name, n: f.n, servingG: f.servingG, servingLabel: f.servingLabel, foodId: f.id });
  $("#entry-qty").focus();
  $("#entry-qty").select();
}
$("#entry-results").addEventListener("click", pickResult);
$("#entry-results").addEventListener("keydown", (ev) => ev.key === "Enter" && (ev.preventDefault(), pickResult(ev)));

$("#entry-cancel").addEventListener("click", () => entryDialog.close());
$("#entry-new-food").addEventListener("click", () => {
  entryDialog.close();
  openFoodDialog(null, (food) => {
    openEntryDialog();
    selectEntryFood({ name: food.name, n: food.n, servingG: food.servingG, servingLabel: food.servingLabel, foodId: food.id });
  });
});

$("#entry-form").addEventListener("submit", (ev) => {
  const grams = entryGrams();
  if (!entryFood || !(grams > 0)) {
    ev.preventDefault();
    return;
  }
  const unit = $("#entry-unit").value;
  const data = {
    foodId: entryFood.foodId,
    name: entryFood.name,
    n: { ...entryFood.n }, // snapshot, so editing the food later doesn't rewrite history
    servingG: entryFood.servingG || 0,
    servingLabel: entryFood.servingLabel || "",
    unit,
    qty: parseFloat($("#entry-qty").value),
    grams,
  };
  if (editingEntry) {
    Object.assign(editingEntry, data);
  } else {
    (state.log[currentDate] ||= []).push({ id: uid(), ...data });
    const food = state.foods.find((f) => f.id === entryFood.foodId);
    if (food) food.used = Date.now();
  }
  save();
  renderLog();
});

$("#entry-delete").addEventListener("click", () => {
  if (!editingEntry) return;
  state.log[currentDate] = dayEntries(currentDate).filter((e) => e !== editingEntry);
  if (!state.log[currentDate].length) delete state.log[currentDate];
  save();
  entryDialog.close();
  renderLog();
});

// ---------- Foods view ----------
function renderFoods() {
  const foods = [...state.foods]
    .filter((f) => f.name.toLowerCase().includes($("#food-filter").value.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  $("#food-list").innerHTML = foods.length
    ? foods
        .map(
          (f) => `<li data-id="${f.id}" tabindex="0">
            <div><div>${esc(f.name)}</div><div class="muted small">per 100 g: P ${fmt(f.n.protein)} · C ${fmt(f.n.carbs)} · F ${fmt(f.n.fat)}</div></div>
            <div class="right"><strong>${fmt(f.n.kcal)}</strong> kcal</div>
          </li>`
        )
        .join("")
    : `<li class="empty muted">No foods yet.</li>`;
}

$("#food-filter").addEventListener("input", renderFoods);
$("#new-food").addEventListener("click", () => openFoodDialog(null));
function openFoodFromList(ev) {
  const li = ev.target.closest("li[data-id]");
  if (li) openFoodDialog(state.foods.find((f) => f.id === li.dataset.id));
}
$("#food-list").addEventListener("click", openFoodFromList);
$("#food-list").addEventListener("keydown", (ev) => ev.key === "Enter" && openFoodFromList(ev));

// ---------- Food dialog ----------
const foodDialog = $("#food-dialog");
let editingFood = null;
let afterFoodSave = null;
let foodBasis = "100";

$("#food-fields").innerHTML = NUTRIENTS.map(
  (x) => `<label>${x.label} (${x.unit})<input type="number" name="${x.key}" min="0" step="any" inputmode="decimal"${x.key === "kcal" ? " required" : ""}></label>`
).join("");

function openFoodDialog(food, onSave) {
  editingFood = food;
  afterFoodSave = onSave || null;
  foodBasis = "100";
  $("#food-title").textContent = food ? "Edit food" : "New food";
  $("#food-delete").hidden = !food;
  $("#food-name").value = food ? food.name : "";
  $("#food-basis").value = "100";
  $("#food-serving-g").value = food && food.servingG ? food.servingG : "";
  $("#food-serving-label").value = food ? food.servingLabel || "" : "";
  for (const x of NUTRIENTS) {
    const v = food ? food.n[x.key] : null;
    $(`#food-fields [name="${x.key}"]`).value = v || v === 0 ? +v.toFixed(2) : "";
  }
  foodDialog.showModal();
  $("#food-name").focus();
}

// Switching basis converts the numbers already typed in.
$("#food-basis").addEventListener("change", () => {
  const next = $("#food-basis").value;
  const servingG = parseFloat($("#food-serving-g").value);
  if (next === "serving" && !(servingG > 0)) {
    $("#food-basis").value = foodBasis;
    alert("Enter the serving size in grams first.");
    $("#food-serving-g").focus();
    return;
  }
  const factor = next === "serving" ? servingG / 100 : 100 / servingG;
  for (const x of NUTRIENTS) {
    const input = $(`#food-fields [name="${x.key}"]`);
    if (input.value !== "") input.value = +(parseFloat(input.value) * factor).toFixed(2);
  }
  foodBasis = next;
});

$("#food-cancel").addEventListener("click", () => foodDialog.close());

$("#food-form").addEventListener("submit", (ev) => {
  const servingG = parseFloat($("#food-serving-g").value) || 0;
  if (foodBasis === "serving" && !(servingG > 0)) {
    ev.preventDefault();
    alert("Enter the serving size in grams.");
    return;
  }
  const toPer100 = foodBasis === "serving" ? 100 / servingG : 1;
  const n = {};
  for (const x of NUTRIENTS) {
    const v = parseFloat($(`#food-fields [name="${x.key}"]`).value);
    n[x.key] = isNaN(v) ? 0 : v * toPer100;
  }
  const data = {
    name: $("#food-name").value.trim(),
    servingG,
    servingLabel: $("#food-serving-label").value.trim(),
    n,
  };
  let food = editingFood;
  if (food) Object.assign(food, data);
  else state.foods.push((food = { id: uid(), used: 0, ...data }));
  save();
  renderFoods();
  if (afterFoodSave) setTimeout(() => afterFoodSave(food));
});

$("#food-delete").addEventListener("click", () => {
  if (!editingFood || !confirm(`Delete "${editingFood.name}"? Past log entries are kept.`)) return;
  state.foods = state.foods.filter((f) => f !== editingFood);
  save();
  foodDialog.close();
  renderFoods();
});

// ---------- Targets view ----------
$("#targets-fields").innerHTML = NUTRIENTS.map(
  (x) => `<label>${x.label} (${x.unit})${x.limit ? " max" : ""}<input type="number" name="${x.key}" min="0" step="any" inputmode="decimal"></label>`
).join("");

function renderTargets() {
  for (const x of NUTRIENTS) $(`#targets-fields [name="${x.key}"]`).value = state.targets[x.key] ?? "";
}

$("#targets-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  for (const x of NUTRIENTS) {
    const v = parseFloat($(`#targets-fields [name="${x.key}"]`).value);
    state.targets[x.key] = isNaN(v) ? 0 : v;
  }
  save();
  renderLog();
  ev.submitter.textContent = "Saved ✓";
  setTimeout(() => (ev.submitter.textContent = "Save targets"), 1200);
});

// ---------- Backup ----------
$("#export").addEventListener("click", () => {
  const json = JSON.stringify(state, null, 2);
  const fileName = `food-tracker-${isoDate(new Date())}.json`;
  // In the Android app, the native side saves the file.
  if (window.Android) return window.Android.saveBackup(json, fileName);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#import").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.foods) || typeof data.log !== "object" || typeof data.targets !== "object") throw new Error("Not a backup file");
    if (!confirm("Replace all current data with this backup?")) return;
    state = data;
    save();
    renderLog();
    renderTargets();
    renderFoods();
    alert("Backup imported.");
  } catch (e) {
    alert("Could not import: " + e.message);
  }
});

// ---------- Start ----------
save();
renderLog();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
