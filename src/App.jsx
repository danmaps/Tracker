import React, { useState, useEffect, useCallback, useRef } from "react";
import * as storage from "./storage";

// ── Constants ──────────────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0d1117", surface: "#161b22", card: "#1c2333", border: "#30363d",
  accent: "#3fb950", accentDim: "#238636", warn: "#f0883e", danger: "#f85149",
  info: "#58a6ff", muted: "#8b949e", text: "#e6edf3", textDim: "#c9d1d9",
  fastfood: "#ff6b35", heat: "#bf5af2",
};

const gColor = (v) => {
  if (!v) return COLORS.muted;
  if (v < 70) return COLORS.danger;
  if (v <= 140) return COLORS.accent;
  if (v <= 180) return COLORS.warn;
  return COLORS.danger;
};
const gLabel = (v) => {
  if (!v) return "";
  if (v < 70) return "Low";
  if (v <= 140) return "Normal";
  if (v <= 180) return "Elevated";
  return "High";
};
const fmtDT = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const fmtT = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const fmtD = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
const dist = (la1, ln1, la2, ln2) => {
  const R = 6371000, dl = (la2 - la1) * Math.PI / 180, dg = (ln2 - ln1) * Math.PI / 180;
  const a = Math.sin(dl / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dg / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Parse coordinates from many formats:
//   Plain decimal:     "33.76773, -116.93049"
//   Apple Maps:        "33.76773° N, 116.93049° W"
//   Google Maps:       "33.7677° N 116.9305° W"
//   DMS not supported  (degrees/minutes/seconds would need extra work)
const parseCoords = (raw) => {
  // Accepts all popular coordinate formats:
  //   Apple Maps:      "33.76773° N, 116.93049° W"
  //   Google Maps:     "33.7677° N 116.9305° W"
  //   Plain decimal:   "33.76773, -116.93049"
  //   Prefix style:    "N33.76773 W116.93049"
  //   Suffix no space: "33.76773N 116.93049W"
  //   With parens:     "(33.76773, -116.93049)"
  //   Southern/Eastern hemisphere handled automatically

  if (!raw || !raw.trim()) return null;
  let s = raw.trim();
  s = s.replace(/[()]/g, "").replace(/\u00b0/g, " ");
  s = s.replace(/,/g, " ").replace(/  +/g, " ").trim();

  const tokens = s.split(" ").map(t => t.trim()).filter(t => t.length > 0);
  const coords = [];
  let i = 0;

  while (i < tokens.length && coords.length < 2) {
    const t = tokens[i].toUpperCase();
    if (/^[NSEW]$/.test(t)) { i++; continue; }

    let prefixDir = null;
    let numStr = t;
    if (/^[NSEW]/.test(t) && t.length > 1) {
      prefixDir = t[0];
      numStr = t.slice(1);
    }

    const num = parseFloat(numStr);
    if (isNaN(num)) { i++; continue; }

    let val = num;
    const next = (tokens[i + 1] || "").toUpperCase();
    const suffixInNext = /^[NSEW]$/.test(next) ? next : null;
    const suffixInToken = /[NSEW]$/.test(t) ? t.slice(-1) : null;
    const dir = suffixInNext || suffixInToken || prefixDir;

    if (num >= 0 && dir) {
      if (dir === "S" || dir === "W") val = -Math.abs(num);
    }
    if (suffixInNext) i++;

    coords.push(val);
    i++;
  }

  if (coords.length < 2) return null;
  let lat = coords[0], lng = coords[1];
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) { const tmp = lat; lat = lng; lng = tmp; }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

// ── Food Database ──────────────────────────────────────────────────────────────
const FOOD_DB = [
  { keys: ["big mac meal", "bigmac meal"], meal: "McDonalds Big Mac Meal (medium)", calories: 1080, carbs: 133, confidence: "high", notes: "Big Mac + medium fries + medium Coke" },
  { keys: ["big mac", "bigmac"], meal: "McDonalds Big Mac", calories: 550, carbs: 45, confidence: "high" },
  { keys: ["quarter pounder"], meal: "McDonalds Quarter Pounder with Cheese", calories: 530, carbs: 41, confidence: "high" },
  { keys: ["mcchicken"], meal: "McDonalds McChicken", calories: 400, carbs: 40, confidence: "high" },
  { keys: ["mcdouble"], meal: "McDonalds McDouble", calories: 390, carbs: 34, confidence: "high" },
  { keys: ["mcdonald", "mcdonalds"], meal: "McDonalds (generic)", calories: 800, carbs: 90, confidence: "low", notes: "Specify item for accuracy" },
  { keys: ["whopper jr", "whopper junior"], meal: "Burger King Whopper Jr", calories: 310, carbs: 27, confidence: "high" },
  { keys: ["whopper"], meal: "Burger King Whopper", calories: 657, carbs: 49, confidence: "high" },
  { keys: ["baconator"], meal: "Wendys Baconator", calories: 950, carbs: 37, confidence: "high" },
  { keys: ["daves single"], meal: "Wendys Daves Single", calories: 590, carbs: 40, confidence: "high" },
  { keys: ["frosty"], meal: "Wendys Frosty (medium)", calories: 340, carbs: 56, confidence: "high" },
  { keys: ["kfc original", "original recipe"], meal: "KFC Original Recipe 2 pieces", calories: 510, carbs: 16, confidence: "high" },
  { keys: ["famous bowl", "kfc bowl"], meal: "KFC Famous Bowl", calories: 720, carbs: 79, confidence: "high" },
  { keys: ["crunchwrap"], meal: "Taco Bell Crunchwrap Supreme", calories: 530, carbs: 68, confidence: "high" },
  { keys: ["chalupa"], meal: "Taco Bell Chalupa Supreme", calories: 370, carbs: 38, confidence: "high" },
  { keys: ["crunchy taco", "taco bell taco"], meal: "Taco Bell Crunchy Taco", calories: 170, carbs: 13, confidence: "high" },
  { keys: ["burrito bowl", "chipotle bowl"], meal: "Chipotle Burrito Bowl (chicken)", calories: 680, carbs: 65, confidence: "medium", notes: "Rice, beans, salsa, sour cream" },
  { keys: ["chipotle burrito"], meal: "Chipotle Burrito (chicken)", calories: 870, carbs: 90, confidence: "medium" },
  { keys: ["footlong", "foot long subway"], meal: "Subway Footlong Turkey", calories: 500, carbs: 72, confidence: "medium" },
  { keys: ["6 inch subway", "six inch subway"], meal: "Subway 6-inch Turkey", calories: 280, carbs: 37, confidence: "medium" },
  { keys: ["dominos pizza", "domino pizza"], meal: "Dominos Pepperoni (2 slices)", calories: 570, carbs: 66, confidence: "medium" },
  { keys: ["pizza slice", "slice of pizza"], meal: "Pizza slice pepperoni", calories: 285, carbs: 33, confidence: "medium" },
  { keys: ["glazed donut", "krispy kreme", "original glazed"], meal: "Krispy Kreme Original Glazed Donut", calories: 190, carbs: 22, confidence: "high" },
  { keys: ["chick fil a sandwich", "chickfila sandwich"], meal: "Chick-fil-A Chicken Sandwich", calories: 470, carbs: 40, confidence: "high" },
  { keys: ["chick fil a nuggets", "chickfila nuggets"], meal: "Chick-fil-A 8pc Nuggets", calories: 260, carbs: 11, confidence: "high" },
  { keys: ["popeyes sandwich", "popeyes chicken"], meal: "Popeyes Chicken Sandwich", calories: 700, carbs: 50, confidence: "high" },
  { keys: ["five guys burger"], meal: "Five Guys Regular Hamburger", calories: 700, carbs: 40, confidence: "high" },
  { keys: ["shackburger", "shake shack burger"], meal: "Shake Shack ShackBurger", calories: 490, carbs: 29, confidence: "high" },
  { keys: ["large diet coke 7 eleven", "diet coke 7 eleven", "large diet coke from 7"], meal: "7-Eleven Large Diet Coke (44oz)", calories: 0, carbs: 0, confidence: "high", notes: "Zero calorie / zero carb" },
  { keys: ["diet coke", "diet cola", "diet soda"], meal: "Diet Coke (12oz)", calories: 0, carbs: 0, confidence: "high", notes: "Zero calorie / zero carb" },
  { keys: ["large coke", "large regular coke"], meal: "Large Coca-Cola fountain (32oz)", calories: 310, carbs: 86, confidence: "high" },
  { keys: ["coke", "coca cola", "regular coke"], meal: "Coca-Cola (12oz)", calories: 140, carbs: 39, confidence: "high" },
  { keys: ["diet pepsi"], meal: "Diet Pepsi (12oz)", calories: 0, carbs: 0, confidence: "high" },
  { keys: ["pepsi"], meal: "Pepsi (12oz)", calories: 150, carbs: 41, confidence: "high" },
  { keys: ["sprite"], meal: "Sprite (12oz)", calories: 140, carbs: 38, confidence: "high" },
  { keys: ["orange juice", "glass of oj"], meal: "Orange Juice (8oz)", calories: 112, carbs: 26, confidence: "high" },
  { keys: ["apple juice"], meal: "Apple Juice (8oz)", calories: 114, carbs: 28, confidence: "high" },
  { keys: ["whole milk", "glass of milk"], meal: "Whole Milk (8oz)", calories: 150, carbs: 12, confidence: "high" },
  { keys: ["skim milk", "nonfat milk"], meal: "Skim Milk (8oz)", calories: 83, carbs: 12, confidence: "high" },
  { keys: ["black coffee", "plain coffee"], meal: "Black Coffee (8oz)", calories: 2, carbs: 0, confidence: "high" },
  { keys: ["latte", "cafe latte"], meal: "Latte whole milk (16oz)", calories: 190, carbs: 19, confidence: "medium" },
  { keys: ["gatorade"], meal: "Gatorade (20oz)", calories: 140, carbs: 36, confidence: "high" },
  { keys: ["water", "bottle of water"], meal: "Water", calories: 0, carbs: 0, confidence: "high" },
  { keys: ["handful of mixed nuts", "handful mixed nuts", "mixed nuts"], meal: "Mixed Nuts (1oz handful)", calories: 170, carbs: 6, confidence: "high", notes: "About 28g - almonds, cashews, peanuts" },
  { keys: ["handful of almonds", "handful almonds", "almonds"], meal: "Almonds (1oz)", calories: 164, carbs: 6, confidence: "high", notes: "About 23 almonds" },
  { keys: ["handful of peanuts", "handful peanuts", "peanuts"], meal: "Dry Roasted Peanuts (1oz)", calories: 166, carbs: 6, confidence: "high" },
  { keys: ["handful of cashews", "handful cashews", "cashews"], meal: "Cashews (1oz)", calories: 157, carbs: 9, confidence: "high" },
  { keys: ["handful of walnuts", "handful walnuts", "walnuts"], meal: "Walnuts (1oz)", calories: 185, carbs: 4, confidence: "high" },
  { keys: ["granola bar", "nature valley"], meal: "Granola Bar (Nature Valley)", calories: 190, carbs: 29, confidence: "high" },
  { keys: ["clif bar", "cliff bar"], meal: "Clif Bar (chocolate chip)", calories: 250, carbs: 44, confidence: "high" },
  { keys: ["quest bar", "protein bar"], meal: "Quest Protein Bar", calories: 190, carbs: 21, confidence: "medium" },
  { keys: ["apple"], meal: "Medium Apple", calories: 95, carbs: 25, confidence: "high" },
  { keys: ["banana"], meal: "Medium Banana", calories: 105, carbs: 27, confidence: "high" },
  { keys: ["orange"], meal: "Medium Orange", calories: 62, carbs: 15, confidence: "high" },
  { keys: ["grapes", "cup of grapes"], meal: "Grapes (1 cup)", calories: 104, carbs: 27, confidence: "high" },
  { keys: ["strawberries", "cup of strawberries"], meal: "Strawberries (1 cup)", calories: 49, carbs: 12, confidence: "high" },
  { keys: ["blueberries", "cup of blueberries"], meal: "Blueberries (1 cup)", calories: 84, carbs: 21, confidence: "high" },
  { keys: ["potato chips", "chips", "bag of chips", "lays chips"], meal: "Potato Chips (1oz bag)", calories: 160, carbs: 15, confidence: "high" },
  { keys: ["crackers", "wheat thins"], meal: "Crackers Wheat Thins (16 pieces)", calories: 140, carbs: 22, confidence: "high" },
  { keys: ["string cheese", "cheese stick"], meal: "String Cheese (1 stick)", calories: 80, carbs: 1, confidence: "high" },
  { keys: ["greek yogurt", "plain greek yogurt"], meal: "Greek Yogurt plain (6oz)", calories: 100, carbs: 6, confidence: "high" },
  { keys: ["yogurt", "fruit yogurt"], meal: "Yogurt fruit flavored (6oz)", calories: 150, carbs: 28, confidence: "medium" },
  { keys: ["hard boiled egg", "boiled egg"], meal: "Hard Boiled Egg (1 large)", calories: 78, carbs: 1, confidence: "high" },
  { keys: ["peanut butter", "tablespoon peanut butter"], meal: "Peanut Butter (2 tbsp)", calories: 188, carbs: 7, confidence: "high" },
  { keys: ["dark chocolate", "piece of chocolate"], meal: "Dark Chocolate (1oz square)", calories: 170, carbs: 13, confidence: "medium" },
  { keys: ["rice cake"], meal: "Rice Cake plain (1 cake)", calories: 35, carbs: 7, confidence: "high" },
  { keys: ["scrambled eggs", "two scrambled eggs"], meal: "Scrambled Eggs (2 large)", calories: 182, carbs: 2, confidence: "high" },
  { keys: ["fried egg", "fried eggs"], meal: "Fried Egg (1 large)", calories: 90, carbs: 0, confidence: "high" },
  { keys: ["oatmeal", "bowl of oatmeal"], meal: "Oatmeal plain cooked (1 cup)", calories: 166, carbs: 28, confidence: "high" },
  { keys: ["cereal", "bowl of cereal"], meal: "Cereal with milk (1 cup)", calories: 260, carbs: 48, confidence: "medium" },
  { keys: ["toast", "slice of toast"], meal: "Wheat Toast (1 slice)", calories: 70, carbs: 13, confidence: "high" },
  { keys: ["bagel"], meal: "Plain Bagel (medium)", calories: 270, carbs: 53, confidence: "high" },
  { keys: ["pancakes", "stack of pancakes"], meal: "Pancakes (2 medium, no syrup)", calories: 300, carbs: 56, confidence: "medium" },
  { keys: ["waffle", "waffles"], meal: "Waffle (1 large)", calories: 220, carbs: 33, confidence: "medium" },
  { keys: ["grilled chicken salad", "chicken salad"], meal: "Grilled Chicken Salad", calories: 350, carbs: 15, confidence: "medium" },
  { keys: ["caesar salad"], meal: "Caesar Salad (side, no croutons)", calories: 180, carbs: 8, confidence: "medium" },
  { keys: ["grilled chicken breast", "chicken breast"], meal: "Grilled Chicken Breast (6oz)", calories: 185, carbs: 0, confidence: "high" },
  { keys: ["grilled salmon", "salmon"], meal: "Grilled Salmon (6oz)", calories: 280, carbs: 0, confidence: "high" },
  { keys: ["tuna sandwich", "tuna salad sandwich"], meal: "Tuna Salad Sandwich on wheat", calories: 380, carbs: 30, confidence: "medium" },
  { keys: ["turkey sandwich"], meal: "Turkey Sandwich on wheat", calories: 350, carbs: 38, confidence: "medium" },
  { keys: ["peanut butter and jelly", "peanut butter jelly", "pbj"], meal: "Peanut Butter and Jelly Sandwich", calories: 380, carbs: 52, confidence: "high" },
  { keys: ["white rice", "cup of rice", "bowl of rice"], meal: "White Rice (1 cup cooked)", calories: 206, carbs: 45, confidence: "high" },
  { keys: ["brown rice"], meal: "Brown Rice (1 cup cooked)", calories: 216, carbs: 45, confidence: "high" },
  { keys: ["pasta", "spaghetti", "bowl of pasta"], meal: "Pasta with tomato sauce (1 cup)", calories: 280, carbs: 52, confidence: "medium" },
  { keys: ["baked potato", "plain baked potato"], meal: "Baked Potato (medium, plain)", calories: 161, carbs: 37, confidence: "high" },
  { keys: ["mashed potato", "mashed potatoes"], meal: "Mashed Potatoes (1 cup)", calories: 237, carbs: 35, confidence: "medium" },
  { keys: ["french fries", "fries", "medium fries", "large fries"], meal: "French Fries (medium, fast food)", calories: 320, carbs: 43, confidence: "high" },
  { keys: ["sweet potato", "baked sweet potato"], meal: "Baked Sweet Potato (medium)", calories: 103, carbs: 24, confidence: "high" },
  { keys: ["steamed broccoli", "broccoli"], meal: "Steamed Broccoli (1 cup)", calories: 55, carbs: 11, confidence: "high" },
  { keys: ["chicken soup", "chicken noodle soup"], meal: "Chicken Noodle Soup (1 can)", calories: 150, carbs: 20, confidence: "medium" },
  { keys: ["cheeseburger"], meal: "Cheeseburger (fast food)", calories: 450, carbs: 40, confidence: "medium" },
  { keys: ["hamburger"], meal: "Hamburger (fast food)", calories: 350, carbs: 40, confidence: "medium" },
  { keys: ["hot dog", "hotdog"], meal: "Hot Dog with bun", calories: 290, carbs: 24, confidence: "high" },
  { keys: ["beef taco", "chicken taco", "taco"], meal: "Taco (1 standard ground beef)", calories: 210, carbs: 16, confidence: "medium" },
  { keys: ["chicken burrito", "beef burrito", "burrito"], meal: "Burrito (restaurant-style)", calories: 650, carbs: 70, confidence: "medium" },
  { keys: ["california roll", "sushi roll", "sushi"], meal: "California Roll (6 pieces)", calories: 255, carbs: 38, confidence: "medium" },
  { keys: ["grilled steak", "steak", "sirloin"], meal: "Grilled Steak (6oz sirloin)", calories: 300, carbs: 0, confidence: "high" },
];

// ── Canvas Heatmap ─────────────────────────────────────────────────────────────
function createHeatLayer(L) {
  return L.Layer.extend({
    initialize(data) { this._data = data; },
    onAdd(map) {
      this._map = map;
      this._canvas = document.createElement("canvas");
      this._canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;";
      map.getPanes().overlayPane.appendChild(this._canvas);
      map.on("moveend zoomend resize", this._draw, this);
      this._draw();
    },
    onRemove(map) {
      map.getPanes().overlayPane.removeChild(this._canvas);
      map.off("moveend zoomend resize", this._draw, this);
    },
    setData(data) { this._data = data; if (this._map) this._draw(); },
    _draw() {
      if (!this._map) return;
      const map = this._map, sz = map.getSize();
      const c = this._canvas; c.width = sz.x; c.height = sz.y;
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
      const ctx = c.getContext("2d"); ctx.clearRect(0, 0, sz.x, sz.y);
      const r = Math.max(40, Math.min(120, sz.x / 8));
      (this._data || []).forEach(pt => {
        const p = map.latLngToContainerPoint([pt.lat, pt.lng]);
        const t = pt.intensity;
        let ri, g, b;
        if (t < 0.4) { ri = Math.round(63 + (t / 0.4) * 177); g = Math.round(185 - (t / 0.4) * 49); b = 80; }
        else { const u = (t - 0.4) / 0.6; ri = 248; g = Math.round(136 - u * 136); b = Math.round(80 - u * 31); }
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, `rgba(${ri},${g},${b},0.65)`);
        gr.addColorStop(1, `rgba(${ri},${g},${b},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      });
    },
  });
}

// ── Map Component ──────────────────────────────────────────────────────────────
function GlucoseMap({ entries, selectedEntryId, onClearSelected }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const gLayer = useRef(null);
  const ffLayer = useRef(null);
  const hLayer = useRef(null);
  const ffData = useRef([]);
  const [layers, setLayers] = useState({ glucose: true, heatmap: false, fastFood: false });
  const [ffStatus, setFfStatus] = useState("idle");
  const [ffCount, setFfCount] = useState(0);
  const [ready, setReady] = useState(false);

  // Init Leaflet once
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    if (!document.getElementById("lcss")) {
      const lk = document.createElement("link");
      lk.id = "lcss"; lk.rel = "stylesheet";
      lk.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(lk);
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current, { center: [39.5, -98.35], zoom: 4, zoomControl: true, preferCanvas: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      // Force map to recalculate size after render
      setTimeout(() => map.invalidateSize(), 300);
      gLayer.current = L.layerGroup().addTo(map);
      ffLayer.current = L.layerGroup();
      const HL = createHeatLayer(L);
      hLayer.current = new HL([]);
      mapObj.current = map;
      setReady(true);
    };
    document.head.appendChild(s);
  }, []);

  // Draw glucose markers whenever entries or ready changes
  const drawGlucose = useCallback(() => {
    if (!mapObj.current || !window.L || !gLayer.current) return;
    const L = window.L;
    gLayer.current.clearLayers();
    const pts = entries.filter(e => e.lat && e.lng);
    if (!pts.length) return;
    const bounds = [];
    pts.forEach(e => {
      const col = gColor(e.glucose);
      const nearby = ffData.current.filter(f => dist(e.lat, e.lng, f.lat, f.lng) <= 400).length;
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="width:38px;height:38px;border-radius:50%;background:${col};border:3px solid #0d1117;display:flex;align-items:center;justify-content:center;color:#0d1117;font-weight:800;font-size:10px;box-shadow:0 0 14px ${col}99;">
            ${e.glucose || "?"}
            ${nearby > 0 ? `<div style="position:absolute;top:-7px;right:-7px;background:#ff6b35;color:#fff;border-radius:10px;font-size:9px;font-weight:800;padding:1px 5px;border:2px solid #0d1117;">${nearby}</div>` : ""}
          </div>
          <div style="margin-top:2px;background:#0d1117cc;color:#e6edf3;font-size:9px;padding:1px 5px;border-radius:4px;white-space:nowrap;border:1px solid #30363d;">${fmtT(e.timestamp)}</div>
        </div>`,
        iconSize: [38, 54], iconAnchor: [19, 19],
      });
      const popup = `<div style="font-family:monospace;min-width:200px;color:#e6edf3;background:#1c2333;padding:12px;border-radius:8px;">
        <div style="font-weight:700;color:${col};margin-bottom:6px;font-size:13px;">${e.meal || "No meal logged"}</div>
        ${e.glucose ? `<div>Glucose: <b>${e.glucose} mg/dL</b> (${gLabel(e.glucose)})</div>` : ""}
        ${e.calories ? `<div>Calories: ${e.calories} kcal</div>` : ""}
        ${e.carbs ? `<div>Carbs: ${e.carbs}g</div>` : ""}
        ${nearby > 0 ? `<div style="color:#ff6b35;margin-top:4px;">${nearby} fast food within 400m</div>` : ""}
        ${e.notes ? `<div style="margin-top:5px;color:#8b949e;font-size:11px;">${e.notes}</div>` : ""}
        <div style="margin-top:8px;border-top:1px solid #30363d;padding-top:6px;color:#58a6ff;font-size:11px;">
          ${fmtD(e.timestamp)} at ${fmtT(e.timestamp)}
          ${e.glucoseTiming ? ` · ${e.glucoseTiming}` : ""}
          ${e.locationName ? `<br>${e.locationName}` : ""}
        </div>
      </div>`;
      L.marker([e.lat, e.lng], { icon }).bindPopup(popup, { maxWidth: 300, className: "dpop" }).addTo(gLayer.current);
      bounds.push([e.lat, e.lng]);
    });
    try { mapObj.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 }); } catch {}
  }, [entries]);

  // Draw heatmap
  const drawHeat = useCallback(() => {
    if (!hLayer.current) return;
    const pts = entries.filter(e => e.lat && e.lng && e.glucose);
    hLayer.current.setData(pts.map(e => ({ lat: e.lat, lng: e.lng, intensity: Math.max(0, Math.min(1, (e.glucose - 60) / 220)) })));
  }, [entries]);

  useEffect(() => { if (ready) { drawGlucose(); drawHeat(); } }, [ready, entries, drawGlucose, drawHeat]);

  // Zoom to selected entry when arriving from Glucose Chart
  useEffect(() => {
    if (!ready || !selectedEntryId || !mapObj.current) return;
    const e = entries.find(x => x.id === selectedEntryId);
    if (e && e.lat && e.lng) {
      mapObj.current.setView([e.lat, e.lng], 15, { animate: true });
    }
    if (onClearSelected) onClearSelected();
  }, [ready, selectedEntryId]);

  // Layer toggles
  useEffect(() => {
    if (!mapObj.current || !gLayer.current) return;
    if (layers.glucose && !mapObj.current.hasLayer(gLayer.current)) mapObj.current.addLayer(gLayer.current);
    if (!layers.glucose && mapObj.current.hasLayer(gLayer.current)) mapObj.current.removeLayer(gLayer.current);
  }, [layers.glucose, ready]);

  useEffect(() => {
    if (!mapObj.current || !hLayer.current) return;
    if (layers.heatmap && !mapObj.current.hasLayer(hLayer.current)) mapObj.current.addLayer(hLayer.current);
    if (!layers.heatmap && mapObj.current.hasLayer(hLayer.current)) mapObj.current.removeLayer(hLayer.current);
  }, [layers.heatmap, ready]);

  useEffect(() => {
    if (!mapObj.current || !ffLayer.current) return;
    if (layers.fastFood && !mapObj.current.hasLayer(ffLayer.current)) mapObj.current.addLayer(ffLayer.current);
    if (!layers.fastFood && mapObj.current.hasLayer(ffLayer.current)) mapObj.current.removeLayer(ffLayer.current);
  }, [layers.fastFood, ready]);

  // Fetch fast food from Overpass
  const loadFastFood = async () => {
    if (!mapObj.current || !window.L) return;
    const b = mapObj.current.getBounds();
    if (b.getNorth() - b.getSouth() > 1.5) { alert("Please zoom in before loading fast food."); return; }
    const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
    setFfStatus("loading");
    const q = `[out:json][timeout:25];(node["amenity"="fast_food"](${bbox});node["amenity"="restaurant"]["cuisine"~"burger|pizza|chicken|sandwich|taco|mexican"](${bbox});)(if:count_tags()>0);out body;`;
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: q });
      const data = await res.json();
      const places = data.elements.filter(el => el.lat && el.lon).map(el => ({ id: el.id, lat: el.lat, lng: el.lon, name: el.tags?.name || "Fast Food", cuisine: el.tags?.cuisine || "" }));
      ffData.current = places; setFfCount(places.length);
      const L = window.L; ffLayer.current.clearLayers();
      places.forEach(p => {
        const icon = L.divIcon({ className: "", html: `<div style="width:22px;height:22px;border-radius:4px;background:#ff6b35;border:2px solid #0d1117;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 0 8px #ff6b3566;">🍔</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
        L.marker([p.lat, p.lng], { icon }).bindPopup(`<div style="font-family:monospace;background:#1c2333;color:#e6edf3;padding:10px;border-radius:8px;"><b style="color:#ff6b35;">${p.name}</b>${p.cuisine ? `<br><span style="font-size:11px;color:#8b949e;">${p.cuisine}</span>` : ""}</div>`, { maxWidth: 200, className: "dpop" }).addTo(ffLayer.current);
      });
      setFfStatus("loaded"); drawGlucose(); setLayers(l => ({ ...l, fastFood: true }));
    } catch { setFfStatus("error"); }
  };

  // Proximity stats (only when fast food loaded)
  const proxStats = ffData.current.length > 0 ? entries.filter(e => e.lat && e.lng).map(e => ({ ...e, nearby: ffData.current.filter(f => dist(e.lat, e.lng, f.lat, f.lng) <= 400).length })) : [];
  const highNear = proxStats.filter(e => e.glucose > 140 && e.nearby > 0).length;
  const totalHigh = proxStats.filter(e => e.glucose > 140).length;

  const layerBtn = (key, label, color) => (
    <button onClick={() => setLayers(l => ({ ...l, [key]: !l[key] }))} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${layers[key] ? color : COLORS.border}`, background: layers[key] ? color + "22" : "transparent", color: layers[key] ? color : COLORS.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: layers[key] ? color : COLORS.border, display: "inline-block" }} />{label}
    </button>
  );

  const hasPoints = entries.some(e => e.lat && e.lng);

  return (
    <div>
      <style>{`.dpop .leaflet-popup-content-wrapper{background:#1c2333!important;border:1px solid #30363d!important;border-radius:10px!important;padding:0!important;box-shadow:0 8px 32px #000a!important}.dpop .leaflet-popup-tip{background:#1c2333!important}.dpop .leaflet-popup-content{margin:0!important}.leaflet-control-zoom a{background:#1c2333!important;color:#e6edf3!important;border-color:#30363d!important}`}</style>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center", background: COLORS.surface, padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
        <span style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 4 }}>Layers</span>
        {layerBtn("glucose", "Glucose Readings", COLORS.accent)}
        {layerBtn("heatmap", "Glucose Heat Map", COLORS.heat)}
        {layerBtn("fastFood", "Fast Food", COLORS.fastfood)}
        <button onClick={loadFastFood} disabled={ffStatus === "loading"} style={{ marginLeft: 4, padding: "6px 12px", borderRadius: 20, border: `1px solid ${COLORS.fastfood}`, background: COLORS.fastfood, color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, opacity: ffStatus === "loading" ? 0.7 : 1 }}>
          {ffStatus === "loading" ? "Loading..." : ffStatus === "loaded" ? `Reload (${ffCount})` : "Load Fast Food"}
        </button>
        {ffStatus === "error" && <span style={{ fontSize: 11, color: COLORS.danger }}>Failed. Try again.</span>}
      </div>
      {layers.heatmap && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 10, color: COLORS.muted, padding: "6px 10px", background: COLORS.surface, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
          <span style={{ color: COLORS.heat, fontWeight: 700 }}>Heat Map:</span>
          <div style={{ width: 60, height: 10, borderRadius: 5, background: "linear-gradient(to right,#3fb950,#f0883e,#f85149)" }} />
          <span>Low to High glucose intensity</span>
        </div>
      )}
      <div style={{ position: "relative" }}>
        <div ref={mapRef} style={{ width: "100%", height: 480, borderRadius: 12, border: `1px solid ${COLORS.border}`, position: "relative", zIndex: 0 }} />
        {!hasPoints && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0d111788", borderRadius: 12, flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 32 }}>📍</span>
            <span style={{ color: COLORS.muted, fontSize: 14 }}>Log entries with coordinates to see them here</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: COLORS.muted, flexWrap: "wrap" }}>
        <span style={{ color: COLORS.accent }}>● Normal</span><span style={{ color: COLORS.warn }}>● Elevated</span><span style={{ color: COLORS.danger }}>● High/Low</span>
        <span style={{ color: COLORS.fastfood }}>🍔 Fast food · badge = within 400m · time label on each pin</span>
      </div>
      {proxStats.length > 0 && (
        <div style={{ marginTop: 14, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Fast Food Proximity Analysis</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            <div style={{ background: COLORS.surface, borderRadius: 8, padding: "12px", border: `1px solid ${COLORS.fastfood}44` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.fastfood }}>{ffCount}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3, textTransform: "uppercase" }}>Fast Food in Area</div>
            </div>
            <div style={{ background: COLORS.surface, borderRadius: 8, padding: "12px", border: `1px solid ${COLORS.warn}44` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.warn }}>{proxStats.filter(e => e.nearby > 0).length}/{proxStats.length}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3, textTransform: "uppercase" }}>Meals Near FF (400m)</div>
            </div>
            <div style={{ background: COLORS.surface, borderRadius: 8, padding: "12px", border: `1px solid ${COLORS.danger}44` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.danger }}>{totalHigh > 0 ? Math.round(highNear / totalHigh * 100) : 0}%</div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3, textTransform: "uppercase" }}>High Glucose Near FF</div>
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {proxStats.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${COLORS.border}22`, fontSize: 12 }}>
                <div><span style={{ fontWeight: 600 }}>{e.meal || "No meal"}</span><span style={{ color: COLORS.info, marginLeft: 8, fontSize: 10 }}>{fmtT(e.timestamp)}</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {e.glucose && <span style={{ color: gColor(e.glucose), fontWeight: 700 }}>{e.glucose} mg/dL</span>}
                  {e.nearby > 0 ? <span style={{ background: COLORS.fastfood + "22", color: COLORS.fastfood, borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{e.nearby} within 400m</span> : <span style={{ color: COLORS.muted, fontSize: 10 }}>No FF nearby</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini Chart ─────────────────────────────────────────────────────────────────
function MiniChart({ entries }) {
  const pts = entries.filter(e => e.glucose).slice(-14);
  if (pts.length < 2) return <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Log 2+ glucose readings to see your trend</div>;
  const mn = 40, mx = 300, W = 600, H = 140, px = 30, py = 16;
  const xs = pts.map((_, i) => px + (i / (pts.length - 1)) * (W - px * 2));
  const ys = pts.map(e => py + (1 - (e.glucose - mn) / (mx - mn)) * (H - py * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${path} L${xs[xs.length-1]},${H-py} L${xs[0]},${H-py} Z`;
  const ty1 = py + (1 - (140-mn)/(mx-mn))*(H-py*2);
  const ty2 = py + (1 - (70-mn)/(mx-mn))*(H-py*2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      <rect x={px} y={ty1} width={W-px*2} height={ty2-ty1} fill={COLORS.accent} opacity={0.08} rx={2} />
      <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.info} stopOpacity="0.3"/><stop offset="100%" stopColor={COLORS.info} stopOpacity="0"/></linearGradient></defs>
      <path d={area} fill="url(#gg)" />
      <path d={path} fill="none" stroke={COLORS.info} strokeWidth="2.5" strokeLinejoin="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={5} fill={gColor(pts[i].glucose)} stroke={COLORS.bg} strokeWidth={2} />)}
    </svg>
  );
}

// ── Saved Location Pill ────────────────────────────────────────────────────────
function LocPill({ loc, onPick, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", background: hov ? COLORS.surface : COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 20, overflow: "hidden", cursor: "pointer" }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div onClick={() => onPick(loc)} style={{ padding: "6px 12px", fontSize: 12, color: COLORS.info, whiteSpace: "nowrap" }}>
        {loc.lat ? "📍" : "🏷"} {loc.nickname}
        {loc.lat && <span style={{ fontSize: 9, color: COLORS.muted, marginLeft: 4 }}>{Number(loc.lat).toFixed(3)},{Number(loc.lng).toFixed(3)}</span>}
      </div>
      <div onClick={e => { e.stopPropagation(); onDelete(loc.id); }} style={{ padding: "6px 10px 6px 0", fontSize: 16, color: COLORS.muted, lineHeight: 1 }}>×</div>
    </div>
  );
}

// ── Glucose Chart Component ───────────────────────────────────────────────────
function GlucoseChart({ entries, onJumpToMap }) {
  const [chartDays, setChartDays] = useState(30);
  const DAY = 86400000;
  const now = Date.now();
  const cutoff = chartDays === 0 ? 0 : now - chartDays * DAY;

  const pts = entries
    .filter(e => e.glucose && e.timestamp && new Date(e.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const W = 700, H = 240, padX = 48, padY = 20;
  const minG = 40;
  const maxG = pts.length ? Math.max(300, ...pts.map(e => Number(e.glucose) + 20)) : 300;
  const timeSpan = pts.length >= 2
    ? new Date(pts[pts.length - 1].timestamp).getTime() - new Date(pts[0].timestamp).getTime()
    : 1;
  const t0 = pts.length ? new Date(pts[0].timestamp).getTime() : 0;

  const toX = (iso) => padX + ((new Date(iso).getTime() - t0) / Math.max(1, timeSpan)) * (W - padX * 2);
  const toY = (v) => padY + (1 - (Number(v) - minG) / (maxG - minG)) * (H - padY * 2);
  const hasLoc = (e) => e.lat && e.lng;

  const yLines = [70, 140, 180, 250];

  // X-axis date labels: pick up to 6 evenly spaced
  const xLabels = pts.length >= 2 ? (() => {
    const step = Math.max(1, Math.floor(pts.length / 5));
    const idxs = [];
    for (let i = 0; i < pts.length; i += step) idxs.push(i);
    if (idxs[idxs.length - 1] !== pts.length - 1) idxs.push(pts.length - 1);
    return idxs.map(i => pts[i]);
  })() : [];

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Period:</span>
        {[["7 Days", 7], ["14 Days", 14], ["30 Days", 30], ["90 Days", 90], ["All", 0]].map(([label, days]) => (
          <button key={days} onClick={() => setChartDays(days)} style={{
            padding: "5px 14px", borderRadius: 20, fontFamily: "inherit",
            border: `1px solid ${chartDays === days ? COLORS.info : COLORS.border}`,
            background: chartDays === days ? COLORS.info + "22" : "transparent",
            color: chartDays === days ? COLORS.info : COLORS.muted,
            fontSize: 11, cursor: "pointer", fontWeight: chartDays === days ? 700 : 400,
          }}>{label}</button>
        ))}
      </div>

      {pts.length < 2 ? (
        <div style={{ background: "#1c2333", border: "1px solid #30363d", borderRadius: 12, padding: "40px 20px", textAlign: "center", color: COLORS.muted }}>
          Log 2+ glucose readings to see your chart
        </div>
      ) : (
        <div style={{ background: "#1c2333", border: "1px solid #30363d", borderRadius: 12, padding: "16px 12px", overflowX: "auto" }}>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>
            {pts.length} readings · <span style={{ color: COLORS.info }}>📍 dots have a saved location — click to jump to map</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 320, height: H }}>
            {/* Y grid lines */}
            {yLines.map(v => (
              <g key={v}>
                <line x1={padX} y1={toY(v)} x2={W - padX} y2={toY(v)}
                  stroke={COLORS.border}
                  strokeWidth={v === 70 || v === 180 ? 1.5 : 0.7}
                  strokeDasharray={v === 70 || v === 180 ? "5,3" : "2,4"} />
                <text x={padX - 5} y={toY(v) + 4} textAnchor="end" fontSize={9} fill={COLORS.muted}>{v}</text>
              </g>
            ))}
            {/* Normal range band */}
            <rect x={padX} y={toY(180)} width={W - padX * 2} height={toY(70) - toY(180)} fill={COLORS.accent} opacity={0.07} rx={2} />
            {/* Target range label */}
            <text x={W - padX + 2} y={toY(125)} fontSize={8} fill={COLORS.accent} opacity={0.7}>target</text>

            {/* Connecting line */}
            <polyline
              points={pts.map(e => `${toX(e.timestamp).toFixed(1)},${toY(e.glucose).toFixed(1)}`).join(" ")}
              fill="none" stroke={COLORS.info} strokeWidth={1.5} strokeOpacity={0.35} strokeLinejoin="round"
            />

            {/* Data points */}
            {pts.map((e) => {
              const cx = toX(e.timestamp);
              const cy = toY(Number(e.glucose));
              const col = gColor(Number(e.glucose));
              const linked = hasLoc(e);
              return (
                <g key={e.id}
                  style={{ cursor: linked ? "pointer" : "default" }}
                  onClick={() => { if (linked) onJumpToMap(e.id); }}>
                  {linked && <circle cx={cx} cy={cy} r={11} fill={col} opacity={0.18} />}
                  <circle cx={cx} cy={cy} r={linked ? 6 : 4.5} fill={col} stroke="#0d1117" strokeWidth={1.5} />
                  {linked && (
                    <text x={cx} y={cy + 3} textAnchor="middle" fontSize={6} fill="#0d1117" fontWeight="bold">+</text>
                  )}
                  <title>{fmtDT(e.timestamp)} — {e.glucose} mg/dL ({gLabel(Number(e.glucose))}){e.locationName ? " @ " + e.locationName : ""}{linked ? " — click to view on map" : ""}</title>
                </g>
              );
            })}

            {/* X axis date labels */}
            {xLabels.map((e, i) => (
              <text key={i} x={toX(e.timestamp)} y={H - 3} textAnchor="middle" fontSize={8} fill={COLORS.muted}>
                {new Date(e.timestamp).toLocaleDateString([], { month: "numeric", day: "numeric" })}
              </text>
            ))}
          </svg>

          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: COLORS.muted, flexWrap: "wrap" }}>
            <span style={{ color: COLORS.accent }}>● Normal (70–140)</span>
            <span style={{ color: COLORS.warn }}>● Elevated (140–180)</span>
            <span style={{ color: COLORS.danger }}>● High / Low</span>
            <span>📍 glow = has location · click to jump to map</span>
          </div>
        </div>
      )}

      {/* Readings list */}
      <div style={{ background: "#1c2333", border: "1px solid #30363d", borderRadius: 12, padding: "20px 22px", marginTop: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
          All Readings — {chartDays === 0 ? "All Time" : `Last ${chartDays} Days`} ({pts.length})
        </div>
        {!pts.length && <div style={{ color: COLORS.muted, fontSize: 13 }}>No readings in this period.</div>}
        {[...pts].reverse().map(e => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #30363d22" }}>
            <div>
              <span style={{ fontSize: 22, fontWeight: 800, color: gColor(Number(e.glucose)) }}>{e.glucose}</span>
              <span style={{ fontSize: 11, color: gColor(Number(e.glucose)), marginLeft: 6, fontWeight: 600 }}>mg/dL · {gLabel(Number(e.glucose))}</span>
              {e.glucoseTiming && <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: 6 }}>· {e.glucoseTiming}</span>}
              {e.medsTaken && <div style={{ fontSize: 10, color: COLORS.heat, marginTop: 2 }}>💊 {e.medsTaken}</div>}
              {e.meal && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 1 }}>{e.meal}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: COLORS.info }}>{fmtDT(e.timestamp)}</div>
              {e.locationName && (
                <button onClick={() => { if (hasLoc(e)) onJumpToMap(e.id); }}
                  style={{ fontSize: 10, color: hasLoc(e) ? COLORS.info : COLORS.muted, background: "none", border: "none", cursor: hasLoc(e) ? "pointer" : "default", padding: 0, textDecoration: hasLoc(e) ? "underline" : "none", fontFamily: "inherit", marginTop: 2, display: "block" }}>
                  📍 {e.locationName}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
const EKEY = "glucomap-entries-v1";
const TABS = ["Dashboard", "Log Entry", "Glucose", "A1C", "Meds", "Map", "History"];

const blankForm = () => ({
  meal: "", calories: "", carbs: "", glucose: "", glucoseTiming: "pre-meal",
  notes: "", datetime: nowLocal(), locationName: "", lat: null, lng: null,
  medsTaken: "",
});

export default function App() {
  const [entries, setEntries] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(EKEY)) || [];
      // Migration: fix entries where coordinates were stored incorrectly
      // from old Apple Maps format (W longitude stored as positive instead of negative)
      return raw.map(e => {
        if (!e.lat || !e.lng) return e;
        // If locationName contains degree notation, re-parse it to get correct coords
        if (e.locationName && /[NSEW]/.test(e.locationName.toUpperCase())) {
          const fixed = parseCoords(e.locationName);
          if (fixed) return { ...e, lat: fixed.lat, lng: fixed.lng };
        }
        // Heuristic: if entry has a US-range latitude (24-50) but positive longitude
        // (should be negative for Western hemisphere), flip it
        if (e.lat >= 24 && e.lat <= 50 && e.lng > 0 && e.lng > 60) {
          return { ...e, lng: -e.lng };
        }
        return e;
      });
    } catch { return []; }
  });
  const [savedLocs, setSavedLocs] = useState([]);
  const [locsReady, setLocsReady] = useState(false);
  const [tab, setTab] = useState("Dashboard");
  const [form, setForm] = useState(() => blankForm());
  // Location entry state: name + single coords string
  const [locName, setLocName] = useState("");
  const [locCoords, setLocCoords] = useState("");
  const [locConfirmed, setLocConfirmed] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveNick, setSaveNick] = useState("");
  // Food lookup
  const [foodQ, setFoodQ] = useState("");
  const [foodSt, setFoodSt] = useState("idle");
  const [foodRes, setFoodRes] = useState(null);
  const [flash, setFlash] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  // Medications
  const [meds, setMeds] = useState([]);
  const [medsReady, setMedsReady] = useState(false);
  const [medForm, setMedForm] = useState({ name: "", dose: "", unit: "mg", frequency: "daily", notes: "", startDate: new Date().toISOString().slice(0,10) });

  // Persist entries
  useEffect(() => { localStorage.setItem(EKEY, JSON.stringify(entries)); }, [entries]);

  // Load lab A1C records from persistent storage
  const [labA1Cs, setLabA1Cs] = useState([]);
  const [labA1CsReady, setLabA1CsReady] = useState(false);
  const [a1cForm, setA1cForm] = useState({ value: "", date: new Date().toISOString().slice(0,10), notes: "" });

  useEffect(() => {
    (async () => {
      try { const r = await storage.get("gm-lab-a1cs"); if (r?.value) setLabA1Cs(JSON.parse(r.value)); } catch {}
      setLabA1CsReady(true);
    })();
  }, []);
  useEffect(() => {
    if (!labA1CsReady) return;
    (async () => { try { await storage.set("gm-lab-a1cs", JSON.stringify(labA1Cs)); } catch {} })();
  }, [labA1Cs, labA1CsReady]);

  // Load medications from persistent storage
  useEffect(() => {
    (async () => {
      try { const r = await storage.get("gm-meds"); if (r?.value) setMeds(JSON.parse(r.value)); } catch {}
      setMedsReady(true);
    })();
  }, []);
  useEffect(() => {
    if (!medsReady) return;
    (async () => { try { await storage.set("gm-meds", JSON.stringify(meds)); } catch {} })();
  }, [meds, medsReady]);

  // Load saved locations from persistent storage
  useEffect(() => {
    (async () => {
      try { const r = await storage.get("gm-saved-locs"); if (r?.value) setSavedLocs(JSON.parse(r.value)); } catch {}
      setLocsReady(true);
    })();
  }, []);

  // Save locations to persistent storage
  useEffect(() => {
    if (!locsReady) return;
    (async () => { try { await storage.set("gm-saved-locs", JSON.stringify(savedLocs)); } catch {} })();
  }, [savedLocs, locsReady]);

  // Reset location fields when switching to Log Entry
  useEffect(() => {
    if (tab === "Log Entry") {
      setForm(blankForm());
      setLocName(""); setLocCoords(""); setLocConfirmed(false); setShowSave(false); setSaveNick("");
      setFoodQ(""); setFoodSt("idle"); setFoodRes(null);
    }
  }, [tab]);

  // Derived: parsed coords from locCoords string
  const parsedCoords = parseCoords(locCoords);

  // Confirm location — sets it on the form
  const confirmLoc = () => {
    const name = locName.trim();
    const coords = parsedCoords;
    if (!name && !coords) return;
    const finalName = name || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    setForm(f => ({ ...f, locationName: finalName, lat: coords ? coords.lat : null, lng: coords ? coords.lng : null }));
    setLocConfirmed(true);
    setSaveNick(finalName);
    setShowSave(true);
  };

  const clearLoc = () => {
    setLocName(""); setLocCoords(""); setLocConfirmed(false); setShowSave(false); setSaveNick("");
    setForm(f => ({ ...f, locationName: "", lat: null, lng: null }));
  };

  const pickSaved = (loc) => {
    setLocName(loc.nickname);
    setLocCoords(loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "");
    setForm(f => ({ ...f, locationName: loc.nickname, lat: loc.lat || null, lng: loc.lng || null }));
    setLocConfirmed(true); setShowSave(false);
  };

  const saveLoc = async () => {
    const nick = saveNick.trim() || form.locationName;
    if (!nick) return;
    if (!savedLocs.find(l => l.nickname.toLowerCase() === nick.toLowerCase())) {
      setSavedLocs(prev => [...prev, { id: Date.now(), nickname: nick, lat: form.lat || null, lng: form.lng || null }]);
    }
    setShowSave(false); setSaveNick("");
  };

  const deleteSaved = (id) => setSavedLocs(prev => prev.filter(l => l.id !== id));

  // Food lookup
  const lookupFood = () => {
    if (!foodQ.trim()) return;
    setFoodSt("loading"); setFoodRes(null);
    const q = foodQ.toLowerCase().trim();
    let best = null, bestScore = 0;
    for (const item of FOOD_DB) {
      for (const key of item.keys) {
        if (q.includes(key) || key.includes(q)) {
          if (key.length > bestScore) { bestScore = key.length; best = item; }
        }
      }
    }
    setTimeout(() => {
      if (best) { setFoodRes({ ...best }); setFoodSt("done"); return; }
      // Fuzzy word match
      const words = q.split(" ").filter(w => w.length > 2);
      let fb = null, fbScore = 0;
      for (const item of FOOD_DB) {
        for (const key of item.keys) {
          const kw = key.split(" ").filter(w => w.length > 2);
          const mc = kw.filter(k => words.some(w => w.includes(k) || k.includes(w))).length;
          if (mc > 0 && mc >= kw.length * 0.6 && mc > fbScore) { fbScore = mc; fb = item; }
        }
      }
      if (fb) { setFoodRes({ ...fb, confidence: "low", notes: (fb.notes ? fb.notes + " - " : "") + "Partial match, verify values" }); setFoodSt("done"); }
      else setFoodSt("notfound");
    }, 350);
  };

  const applyFood = () => {
    if (!foodRes) return;
    setForm(f => ({ ...f, meal: foodRes.meal || f.meal, calories: foodRes.calories !== undefined ? String(foodRes.calories) : f.calories, carbs: foodRes.carbs !== undefined ? String(foodRes.carbs) : f.carbs }));
    setFoodQ(""); setFoodSt("idle"); setFoodRes(null);
  };

  // Submit entry
  const handleSubmit = () => {
    if (!form.meal && !form.glucose) return;
    const ts = form.datetime ? new Date(form.datetime).toISOString() : new Date().toISOString();
    const entry = {
      ...form,
      id: Date.now(),
      timestamp: ts,
      glucose: form.glucose ? Number(form.glucose) : null,
      calories: form.calories ? Number(form.calories) : null,
      carbs: form.carbs ? Number(form.carbs) : null,
    };
    setEntries(prev => [entry, ...prev]);
    // Reset all entry state
    setForm(blankForm());
    setLocName(""); setLocCoords(""); setLocConfirmed(false); setShowSave(false); setSaveNick("");
    setFoodQ(""); setFoodSt("idle"); setFoodRes(null);
    setTab("Dashboard");
    setFlash(true); setTimeout(() => setFlash(false), 2500);
  };

  // Stats
  const gReadings = entries.filter(e => e.glucose);
  const avgG = gReadings.length ? Math.round(gReadings.reduce((s, e) => s + e.glucose, 0) / gReadings.length) : null;
  const lastG = gReadings[0]?.glucose || null;
  const avgCal = entries.length ? Math.round(entries.reduce((s, e) => s + (e.calories || 0), 0) / entries.length) : 0;
  const ccol = (c) => c === "high" ? COLORS.accent : c === "medium" ? COLORS.warn : COLORS.danger;

  const S = {
    app: { minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'IBM Plex Mono','Fira Code',monospace", paddingBottom: 40 },
    hdr: { background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    nav: { display: "flex", gap: 4, padding: "12px 20px", background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" },
    nb: (a) => ({ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: a ? 700 : 500, background: a ? COLORS.accentDim : "transparent", color: a ? "#fff" : COLORS.muted }),
    body: { maxWidth: 900, margin: "0 auto", padding: "24px 20px" },
    card: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "20px 22px", marginBottom: 16 },
    lbl: { fontSize: 11, color: COLORS.muted, marginBottom: 5, display: "block", letterSpacing: "0.06em", textTransform: "uppercase" },
    inp: { width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none" },
    g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
    g4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
    sc: (c) => ({ background: COLORS.card, border: `1px solid ${c}44`, borderRadius: 12, padding: "16px 18px" }),
    sv: (c) => ({ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1.1 }),
    sl: { fontSize: 10, color: COLORS.muted, marginTop: 4, letterSpacing: "0.07em", textTransform: "uppercase" },
    btn: (c = COLORS.accentDim) => ({ background: c, border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }),
    bsm: (c = COLORS.accentDim) => ({ background: c, border: "none", borderRadius: 6, padding: "6px 14px", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 11, cursor: "pointer" }),
    tag: (c) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: c + "22", color: c, fontSize: 10, fontWeight: 700 }),
  };

  return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');*{box-sizing:border-box}input:focus,textarea:focus,select:focus{border-color:${COLORS.info}!important}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${COLORS.bg}}::-webkit-scrollbar-thumb{background:${COLORS.border};border-radius:3px}input[type="datetime-local"]::-webkit-calendar-picker-indicator{filter:invert(0.6)}`}</style>

      <div style={S.hdr}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.accent, letterSpacing: "0.04em" }}>GLUCOMAP</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Diabetic Health and Spatial Tracker</div>
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "right" }}>
          <div>{entries.length} entries · {savedLocs.length} saved places</div>
          {flash && <div style={{ color: COLORS.accent, fontWeight: 700 }}>Saved!</div>}
        </div>
      </div>

      <div style={S.nav}>{TABS.map(t => <button key={t} style={S.nb(tab === t)} onClick={() => setTab(t)}>{t}</button>)}</div>

      <div style={S.body}>

        {/* ── DASHBOARD ── */}
        {tab === "Dashboard" && <>
          <div style={S.g4}>
            <div style={S.sc(gColor(lastG))}>
              <div style={S.sv(gColor(lastG))}>{lastG ?? "---"}</div>
              <div style={S.sl}>Last Glucose mg/dL</div>
              {lastG && <div style={{ ...S.tag(gColor(lastG)), marginTop: 6 }}>{gLabel(lastG)}</div>}
            </div>
            <div style={S.sc(COLORS.info)}>
              <div style={S.sv(COLORS.info)}>{avgG ?? "---"}</div>
              <div style={S.sl}>Avg Glucose</div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>Est A1C: {avgG ? ((avgG + 46.7) / 28.7).toFixed(1) : "---"}%</div>
            </div>
            <div style={S.sc(COLORS.warn)}>
              <div style={S.sv(COLORS.warn)}>{avgCal || "---"}</div>
              <div style={S.sl}>Avg Cal/Entry</div>
            </div>
            <div style={S.sc(COLORS.accent)}>
              <div style={S.sv(COLORS.accent)}>{entries.filter(e => e.lat).length}</div>
              <div style={S.sl}>Mapped Locations</div>
            </div>
          </div>
          <div style={{ ...S.card, marginTop: 18 }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Glucose Trend (last 14)</div>
            <MiniChart entries={entries} />
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10 }}>
              <span style={{ color: COLORS.accent }}>Normal 70-140</span>
              <span style={{ color: COLORS.warn }}>Elevated 140-180</span>
              <span style={{ color: COLORS.danger }}>High or Low</span>
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent Entries</div>
            {!entries.length && <div style={{ color: COLORS.muted, fontSize: 13 }}>No entries yet. Go to Log Entry to start.</div>}
            {entries.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}33` }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{e.meal || <span style={{ color: COLORS.muted }}>No meal</span>}</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    <span style={{ color: COLORS.info }}>{fmtDT(e.timestamp)}</span>
                    {e.locationName ? <span style={{ color: COLORS.muted }}> · {e.locationName}</span> : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {e.calories && <div style={{ fontSize: 12, color: COLORS.warn }}>{e.calories} kcal</div>}
                  {e.glucose && <div style={S.tag(gColor(e.glucose))}>{e.glucose} mg/dL</div>}
                </div>
              </div>
            ))}
            {entries.length > 5 && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8, cursor: "pointer", textDecoration: "underline" }} onClick={() => setTab("History")}>View all {entries.length} entries</div>}
          </div>
        </>}

        {/* ── LOG ENTRY ── */}
        {tab === "Log Entry" && (
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: COLORS.accent }}>+ New Log Entry</div>

            {/* Date/Time */}
            <div style={{ ...S.card, background: COLORS.surface, marginBottom: 18, padding: "14px 16px", border: `1px solid ${COLORS.info}44` }}>
              <label style={{ ...S.lbl, color: COLORS.info }}>Date and Time</label>
              <input type="datetime-local" style={{ ...S.inp, fontSize: 14, fontWeight: 700, color: COLORS.info, background: COLORS.bg }} value={form.datetime} onChange={e => setForm(f => ({ ...f, datetime: e.target.value }))} />
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 5 }}>Auto-set to now · adjust for retroactive entries</div>
            </div>

            {/* Food Lookup */}
            <div style={{ ...S.card, background: COLORS.surface, marginBottom: 18, padding: "14px 16px", border: `1px solid ${COLORS.accent}44` }}>
              <label style={{ ...S.lbl, color: COLORS.accent, marginBottom: 8 }}>Food Lookup — Auto-fill Nutrition</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...S.inp, flex: 1 }} placeholder="e.g. handful of mixed nuts, large Diet Coke, Big Mac..." value={foodQ} onChange={e => setFoodQ(e.target.value)} onKeyDown={e => e.key === "Enter" && lookupFood()} />
                <button style={S.btn(COLORS.accent)} onClick={lookupFood} disabled={foodSt === "loading"}>{foodSt === "loading" ? "..." : "Look Up"}</button>
              </div>
              {foodSt === "notfound" && <div style={{ fontSize: 12, color: COLORS.warn }}>Not found. Try rephrasing, e.g. "handful almonds" or "McChicken".</div>}
              {foodSt === "done" && foodRes && (
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.accent}55`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 10 }}>Found — review and apply:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ background: COLORS.surface, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>Meal</div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{foodRes.meal}</div>
                    </div>
                    <div style={{ background: COLORS.surface, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>Calories</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.warn, marginTop: 2 }}>{foodRes.calories}</div>
                    </div>
                    <div style={{ background: COLORS.surface, borderRadius: 6, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>Carbs</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.info, marginTop: 2 }}>{foodRes.carbs}g</div>
                    </div>
                  </div>
                  {foodRes.notes && <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic", marginBottom: 10 }}>{foodRes.notes}</div>}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button style={S.btn()} onClick={applyFood}>Apply to Form</button>
                    <button style={S.btn("#30363d")} onClick={() => { setFoodRes(null); setFoodSt("idle"); }}>Discard</button>
                    <span style={{ fontSize: 10, color: COLORS.muted }}>Confidence: <span style={{ color: ccol(foodRes.confidence), fontWeight: 700 }}>{foodRes.confidence}</span></span>
                  </div>
                </div>
              )}
              {foodSt === "idle" && <div style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic" }}>Describe any food or drink in plain language — fast food, snacks, home meals.</div>}
            </div>

            {/* Meal */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Meal / Food Description</label>
              <input style={S.inp} placeholder="e.g. Grilled chicken salad, wheat bread..." value={form.meal} onChange={e => setForm(f => ({ ...f, meal: e.target.value }))} />
            </div>

            {/* Blood Glucose — prominent, first data field */}
            <div style={{ ...S.card, background: COLORS.surface, marginBottom: 18, padding: "14px 16px", border: `1px solid ${gColor(Number(form.glucose))}44` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ ...S.lbl, margin: 0, color: gColor(Number(form.glucose)) || COLORS.muted }}>Blood Glucose Reading (mg/dL)</label>
                {form.glucose && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: gColor(Number(form.glucose)) }}>{form.glucose}</span>
                    <span style={{ ...S.tag(gColor(Number(form.glucose))), fontSize: 12, padding: "3px 10px" }}>{gLabel(Number(form.glucose))}</span>
                  </div>
                )}
              </div>
              <input
                style={{ ...S.inp, fontSize: 20, fontWeight: 700, color: gColor(Number(form.glucose)) || COLORS.text, textAlign: "center", letterSpacing: "0.05em" }}
                type="number" placeholder="Enter mg/dL  e.g. 112"
                value={form.glucose}
                onChange={e => setForm(f => ({ ...f, glucose: e.target.value }))}
              />
              <div style={{ ...S.g2, marginTop: 10 }}>
                <div>
                  <label style={S.lbl}>Glucose Timing</label>
                  <select style={S.inp} value={form.glucoseTiming} onChange={e => setForm(f => ({ ...f, glucoseTiming: e.target.value }))}>
                    <option value="fasting">Fasting</option>
                    <option value="pre-meal">Pre-Meal</option>
                    <option value="1hr-post">1hr Post-Meal</option>
                    <option value="2hr-post">2hr Post-Meal</option>
                    <option value="bedtime">Bedtime</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 20 }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.7 }}>
                    <span style={{ color: COLORS.accent }}>70–140</span> Normal<br />
                    <span style={{ color: COLORS.warn }}>140–180</span> Elevated<br />
                    <span style={{ color: COLORS.danger }}>&lt;70 or &gt;180</span> Out of range
                  </div>
                </div>
              </div>
            </div>

            {/* Calories + Carbs */}
            <div style={{ ...S.g2, marginBottom: 14 }}>
              <div><label style={S.lbl}>Calories (kcal)</label><input style={S.inp} type="number" placeholder="450" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} /></div>
              <div><label style={S.lbl}>Carbohydrates (g)</label><input style={S.inp} type="number" placeholder="60" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} /></div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Notes</label>
              <textarea style={{ ...S.inp, minHeight: 64, resize: "vertical" }} placeholder="Stress level, activity, how you felt..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Medications taken */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.lbl}>Medications Taken (optional)</label>
              <input style={S.inp} placeholder="e.g. Metformin 500mg, Insulin 10 units..." value={form.medsTaken} onChange={e => setForm(f => ({ ...f, medsTaken: e.target.value }))} />
              {meds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                  {meds.map(m => (
                    <button key={m.id} onClick={() => setForm(f => ({ ...f, medsTaken: f.medsTaken ? f.medsTaken + ", " + m.name + " " + m.dose + m.unit : m.name + " " + m.dose + m.unit }))}
                      style={{ background: COLORS.heat + "22", border: `1px solid ${COLORS.heat}44`, color: COLORS.heat, borderRadius: 14, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                      + {m.name} {m.dose}{m.unit}
                    </button>
                  ))}
                </div>
              )}
              {meds.length === 0 && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>Add medications in the Meds tab to get quick-add buttons here.</div>}
            </div>

            {/* ── LOCATION ── */}
            <div style={{ ...S.card, background: COLORS.surface, marginBottom: 14 }}>
              <label style={{ ...S.lbl, marginBottom: 10 }}>Location</label>

              {/* Saved places */}
              {savedLocs.length > 0 && !locConfirmed && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 7, textTransform: "uppercase" }}>Saved Places — tap to use</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {savedLocs.map(loc => <LocPill key={loc.id} loc={loc} onPick={pickSaved} onDelete={deleteSaved} />)}
                  </div>
                  <div style={{ borderBottom: `1px solid ${COLORS.border}`, margin: "12px 0 10px" }} />
                </div>
              )}

              {locConfirmed ? (
                /* Confirmed state */
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.accentDim + "22", border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: "10px 14px", marginBottom: showSave ? 10 : 0 }}>
                    <div>
                      <div style={{ fontSize: 13, color: COLORS.accent, fontWeight: 700 }}>{form.locationName}</div>
                      {form.lat && form.lng
                        ? <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}</div>
                        : <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Label only — no map pin</div>}
                    </div>
                    <button style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 22 }} onClick={clearLoc}>×</button>
                  </div>
                  {showSave && (
                    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>Save for next time?</div>
                      <input style={{ ...S.inp, flex: 1, minWidth: 120, padding: "6px 10px", fontSize: 12 }} placeholder="Nickname: Home, Work, Chipotle..." value={saveNick} onChange={e => setSaveNick(e.target.value)} onKeyDown={e => e.key === "Enter" && saveLoc()} />
                      <button style={S.bsm(COLORS.accent)} onClick={saveLoc}>Save</button>
                      <button style={S.bsm("#30363d")} onClick={() => setShowSave(false)}>Skip</button>
                    </div>
                  )}
                </>
              ) : (
                /* Entry state */
                <>
                  {/* Place name */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.lbl}>Place Name</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={{ ...S.inp, flex: 1 }} placeholder="Home, Work, McDonalds, CVS..." value={locName} onChange={e => setLocName(e.target.value)} />
                      {locName.trim() && !locCoords.trim() && (
                        <button style={S.btn(COLORS.warn)} onClick={() => {
                          setForm(f => ({ ...f, locationName: locName.trim(), lat: null, lng: null }));
                          setLocConfirmed(true); setShowSave(true); setSaveNick(locName.trim());
                        }}>Label Only</button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 4 }}>Type a name — use Label Only to save without a map pin, or paste coordinates below for a pin.</div>
                  </div>

                  {/* Single coords field */}
                  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "14px 16px" }}>
                    <label style={{ ...S.lbl, color: COLORS.info }}>Coordinates (for map pin)</label>
                    <input
                      style={{ ...S.inp, fontFamily: "monospace", fontSize: 14 }}
                      placeholder="e.g.  33.76773° N, 116.93049° W  or  33.76773, -116.93049"
                      value={locCoords}
                      onChange={e => setLocCoords(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && locName.trim() && parsedCoords && confirmLoc()}
                    />
                    {/* Live parse feedback */}
                    {locCoords.trim().length > 3 && (
                      parsedCoords
                        ? <div style={{ fontSize: 11, color: COLORS.accent, marginTop: 5, fontWeight: 700 }}>Lat: {parsedCoords.lat.toFixed(5)} · Lng: {parsedCoords.lng.toFixed(5)}</div>
                        : <div style={{ fontSize: 11, color: COLORS.warn, marginTop: 5 }}>Cannot parse — expected format: 39.7392, -104.9903</div>
                    )}
                    {/* Confirm button: show when name + valid coords */}
                    {locName.trim() && parsedCoords && (
                      <button style={{ ...S.btn(COLORS.accent), marginTop: 12, width: "100%" }} onClick={confirmLoc}>
                        Confirm Location with Pin
                      </button>
                    )}
                    {/* Coords-only confirm (no name yet) */}
                    {!locName.trim() && parsedCoords && (
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>Enter a place name above to confirm.</div>
                    )}
                    <div style={{ marginTop: 14, fontSize: 11, color: COLORS.muted, lineHeight: 1.8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                      <span style={{ color: COLORS.info, fontWeight: 700 }}>Get coordinates from Google Maps:</span>
                      <br />1. Open Google Maps · find your location or a place
                      <br />2. Long-press on the spot until a red pin appears
                      <br />3. The coordinates appear at the bottom of the screen
                      <br />4. Tap them · tap Copy · paste in the field above
                      <br /><span style={{ color: COLORS.muted, fontStyle: "italic" }}>Or: tap the blue dot, expand the card, tap the coords at the top</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btn()} onClick={handleSubmit}>Save Entry</button>
              <button style={S.btn("#30363d")} onClick={() => { setForm(blankForm()); setLocName(""); setLocCoords(""); setLocConfirmed(false); setShowSave(false); setFoodQ(""); setFoodSt("idle"); setFoodRes(null); }}>Clear</button>
            </div>
          </div>
        )}

        {/* ── GLUCOSE CHART ── */}
        {tab === "Glucose" && (
          <GlucoseChart
            entries={entries}
            onJumpToMap={(id) => { setSelectedEntryId(id); setTab("Map"); }}
          />
        )}

        {/* ── MEDICATIONS ── */}
        {tab === "Meds" && (
          <div>
            {/* Add medication form */}
            <div style={S.card}>
              <div style={{ fontSize: 12, color: COLORS.heat, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>💊 Add Medication</div>
              <div style={{ ...S.g2, marginBottom: 12 }}>
                <div>
                  <label style={S.lbl}>Medication Name</label>
                  <input style={S.inp} placeholder="e.g. Metformin, Insulin, Januvia..." value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={S.lbl}>Start Date</label>
                  <input style={S.inp} type="date" value={medForm.startDate} onChange={e => setMedForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
              </div>
              <div style={{ ...S.g2, marginBottom: 12 }}>
                <div>
                  <label style={S.lbl}>Dose</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={{ ...S.inp, flex: 1 }} type="number" placeholder="500" value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} />
                    <select style={{ ...S.inp, width: 80 }} value={medForm.unit} onChange={e => setMedForm(f => ({ ...f, unit: e.target.value }))}>
                      <option value="mg">mg</option>
                      <option value="mcg">mcg</option>
                      <option value="units">units</option>
                      <option value="mL">mL</option>
                      <option value="g">g</option>
                      <option value="IU">IU</option>
                      <option value="tablet">tablet</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={S.lbl}>Frequency</label>
                  <select style={S.inp} value={medForm.frequency} onChange={e => setMedForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="as needed">As Needed</option>
                    <option value="once daily">Once Daily</option>
                    <option value="twice daily">Twice Daily</option>
                    <option value="3x daily">3x Daily</option>
                    <option value="with meals">With Meals</option>
                    <option value="before meals">Before Meals</option>
                    <option value="at bedtime">At Bedtime</option>
                    <option value="weekly">Weekly</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.lbl}>Notes (prescriber, instructions, side effects...)</label>
                <input style={S.inp} placeholder="e.g. Take with food. Dr. Smith. Refill by Jan 1." value={medForm.notes} onChange={e => setMedForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button style={S.btn(COLORS.heat)} onClick={() => {
                if (!medForm.name.trim()) return;
                setMeds(prev => [...prev, { ...medForm, id: Date.now(), active: true }]);
                setMedForm({ name: "", dose: "", unit: "mg", frequency: "daily", notes: "", startDate: new Date().toISOString().slice(0,10) });
              }}>+ Add Medication</button>
            </div>

            {/* Medication list */}
            {!meds.length ? (
              <div style={{ ...S.card, textAlign: "center", color: COLORS.muted, padding: "30px 20px" }}>
                No medications logged yet. Add yours above.
              </div>
            ) : (
              <div style={S.card}>
                <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>Current Medications ({meds.length})</div>
                {meds.map(m => (
                  <div key={m.id} style={{ borderBottom: `1px solid ${COLORS.border}44`, padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.heat }}>💊 {m.name}</span>
                        <span style={{ ...S.tag(COLORS.heat), fontSize: 11 }}>{m.dose}{m.unit}</span>
                        <span style={{ ...S.tag(COLORS.info), fontSize: 11 }}>{m.frequency}</span>
                      </div>
                      {m.startDate && <div style={{ fontSize: 10, color: COLORS.muted }}>Started: {new Date(m.startDate).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</div>}
                      {m.notes && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, fontStyle: "italic" }}>{m.notes}</div>}
                      {/* How many entries logged with this med */}
                      {(() => {
                        const count = entries.filter(e => e.medsTaken && e.medsTaken.toLowerCase().includes(m.name.toLowerCase())).length;
                        return count > 0 ? <div style={{ fontSize: 10, color: COLORS.accent, marginTop: 4 }}>{count} log {count === 1 ? "entry" : "entries"} recorded with this medication</div> : null;
                      })()}
                    </div>
                    <button style={{ background: "none", border: `1px solid ${COLORS.danger}44`, color: COLORS.danger, borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                      onClick={() => { if (window.confirm("Remove " + m.name + "?")) setMeds(prev => prev.filter(x => x.id !== m.id)); }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic", padding: "10px 14px", background: COLORS.surface, borderRadius: 8, border: `1px solid ${COLORS.border}`, lineHeight: 1.7 }}>
              This medication log is for personal tracking only. Always follow your doctor or pharmacist instructions. Never adjust dosages without consulting your healthcare provider.
            </div>
          </div>
        )}

        {/* ── A1C TRACKER ── */}
        {tab === "A1C" && (() => {
          // ADA/ADAG formula: eAG = 28.7 * A1C - 46.7  =>  A1C = (eAG + 46.7) / 28.7
          const estA1C = (avg) => avg ? ((avg + 46.7) / 28.7) : null;
          const estEAG = (a1c) => (28.7 * a1c - 46.7).toFixed(0);

          // Weighted A1C: last 30 days count 3x more than days 31-90
          const now = Date.now();
          const DAY = 86400000;
          const readings = entries.filter(e => e.glucose && e.timestamp);
          const recent = readings.filter(e => now - new Date(e.timestamp).getTime() <= 30 * DAY);
          const older  = readings.filter(e => {
            const age = now - new Date(e.timestamp).getTime();
            return age > 30 * DAY && age <= 90 * DAY;
          });
          const weightedAvg = (() => {
            const rSum = recent.reduce((s,e) => s + e.glucose, 0) * 3;
            const oSum = older.reduce((s,e) => s + e.glucose, 0);
            const rN = recent.length * 3;
            const oN = older.length;
            return rN + oN > 0 ? (rSum + oSum) / (rN + oN) : null;
          })();
          const simpleAvg = readings.length ? readings.reduce((s,e) => s+e.glucose,0)/readings.length : null;
          const estA1CWeighted = estA1C(weightedAvg);
          const estA1CSimple   = estA1C(simpleAvg);

          // Time in range
          const tir = readings.length ? {
            low:  Math.round(readings.filter(e => e.glucose < 70).length  / readings.length * 100),
            norm: Math.round(readings.filter(e => e.glucose >= 70 && e.glucose <= 180).length / readings.length * 100),
            high: Math.round(readings.filter(e => e.glucose > 180).length / readings.length * 100),
          } : null;

          // A1C risk color
          const a1cColor = (v) => {
            if (!v) return COLORS.muted;
            if (v < 5.7) return COLORS.accent;
            if (v < 6.5) return COLORS.warn;
            if (v < 7.0) return "#f0a830";
            return COLORS.danger;
          };
          const a1cLabel = (v) => {
            if (!v) return "";
            if (v < 5.7) return "Normal";
            if (v < 6.5) return "Prediabetes range";
            if (v < 7.0) return "At target (ADA <7%)";
            if (v < 8.0) return "Above target";
            return "High — consult doctor";
          };

          // 30-day rolling chart data
          const chartDays = 30;
          const dailyAvgs = [];
          for (let d = chartDays - 1; d >= 0; d--) {
            const start = now - (d+1) * DAY;
            const end   = now - d * DAY;
            const dayPts = readings.filter(e => {
              const t = new Date(e.timestamp).getTime();
              return t >= start && t < end;
            });
            const date = new Date(now - d * DAY);
            dailyAvgs.push({
              label: date.toLocaleDateString([], { month:"numeric", day:"numeric" }),
              avg: dayPts.length ? Math.round(dayPts.reduce((s,e) => s+e.glucose,0)/dayPts.length) : null,
              count: dayPts.length,
            });
          }
          const chartPts = dailyAvgs.filter(d => d.avg !== null);

          return (
            <div>
              {/* Estimated A1C cards */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                <div style={{ ...S.sc(a1cColor(estA1CWeighted)), padding:"20px 22px" }}>
                  <div style={{ fontSize:11, color:COLORS.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Estimated A1C (Weighted)</div>
                  <div style={{ fontSize:48, fontWeight:800, color:a1cColor(estA1CWeighted), lineHeight:1 }}>
                    {estA1CWeighted ? estA1CWeighted.toFixed(1) + "%" : "---"}
                  </div>
                  {estA1CWeighted && <div style={{ fontSize:12, color:a1cColor(estA1CWeighted), marginTop:6, fontWeight:700 }}>{a1cLabel(estA1CWeighted)}</div>}
                  <div style={{ fontSize:10, color:COLORS.muted, marginTop:8, lineHeight:1.6 }}>
                    Based on {recent.length} readings (last 30 days, 3x weight) + {older.length} readings (30–90 days)
                    <br />eAG: {weightedAvg ? Math.round(weightedAvg) + " mg/dL" : "---"}
                  </div>
                </div>
                <div style={{ ...S.sc(COLORS.info), padding:"20px 22px" }}>
                  <div style={{ fontSize:11, color:COLORS.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Simple Average A1C</div>
                  <div style={{ fontSize:48, fontWeight:800, color:COLORS.info, lineHeight:1 }}>
                    {estA1CSimple ? estA1CSimple.toFixed(1) + "%" : "---"}
                  </div>
                  {estA1CSimple && <div style={{ fontSize:11, color:COLORS.muted, marginTop:6 }}>eAG: {simpleAvg ? Math.round(simpleAvg) + " mg/dL" : "---"}</div>}
                  <div style={{ fontSize:10, color:COLORS.muted, marginTop:8, lineHeight:1.6 }}>
                    Simple mean of all {readings.length} glucose readings
                    <br />Formula: (avg + 46.7) / 28.7 — ADA/ADAG 2008
                  </div>
                </div>
              </div>

              {/* ADA targets reference */}
              <div style={{ ...S.card, padding:"14px 18px", marginBottom:16 }}>
                <div style={{ fontSize:11, color:COLORS.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>ADA Target Reference</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, fontSize:11 }}>
                  {[
                    { range:"< 5.7%", label:"Normal", eag:"< 117", color:COLORS.accent },
                    { range:"5.7–6.4%", label:"Prediabetes", eag:"117–137", color:COLORS.warn },
                    { range:"< 7.0%", label:"ADA Target", eag:"< 154", color:"#f0a830" },
                    { range:"> 8.0%", label:"High Risk", eag:"> 183", color:COLORS.danger },
                  ].map(r => (
                    <div key={r.label} style={{ background:COLORS.surface, borderRadius:8, padding:"10px 12px", border:`1px solid ${r.color}44` }}>
                      <div style={{ fontSize:14, fontWeight:800, color:r.color }}>{r.range}</div>
                      <div style={{ fontSize:10, color:COLORS.muted, marginTop:2 }}>{r.label}</div>
                      <div style={{ fontSize:10, color:COLORS.muted }}>eAG: {r.eag} mg/dL</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time in Range */}
              {tir && (
                <div style={{ ...S.card, marginBottom:16 }}>
                  <div style={{ fontSize:11, color:COLORS.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>Time in Range — All Readings</div>
                  <div style={{ display:"flex", borderRadius:8, overflow:"hidden", height:28, marginBottom:10 }}>
                    {tir.low  > 0 && <div style={{ width:`${tir.low}%`,  background:COLORS.danger, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:700 }}>{tir.low}%</div>}
                    {tir.norm > 0 && <div style={{ width:`${tir.norm}%`, background:COLORS.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#0d1117", fontWeight:700 }}>{tir.norm}%</div>}
                    {tir.high > 0 && <div style={{ width:`${tir.high}%`, background:COLORS.warn,   display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:700 }}>{tir.high}%</div>}
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:10, color:COLORS.muted }}>
                    <span style={{ color:COLORS.danger }}>▪ Low &lt;70 mg/dL: {tir.low}%</span>
                    <span style={{ color:COLORS.accent }}>▪ In range 70–180: {tir.norm}%</span>
                    <span style={{ color:COLORS.warn   }}>▪ High &gt;180 mg/dL: {tir.high}%</span>
                  </div>
                  <div style={{ fontSize:10, color:COLORS.muted, marginTop:8, fontStyle:"italic" }}>ADA recommends &gt;70% time in range (70–180 mg/dL)</div>
                </div>
              )}

              {/* 30-day rolling average chart */}
              {chartPts.length >= 2 && (
                <div style={{ ...S.card, marginBottom:16 }}>
                  <div style={{ fontSize:11, color:COLORS.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>30-Day Daily Average Glucose</div>
                  <svg viewBox="0 0 600 120" style={{ width:"100%", height:120 }}>
                    {/* Target range band 70–180 */}
                    {(() => {
                      const mn=40, mx=280, W=600, H=120, px=8, py=12;
                      const toY = v => py + (1-(v-mn)/(mx-mn))*(H-py*2);
                      const allDays = dailyAvgs;
                      const step = (W-px*2)/(allDays.length-1);
                      const xs = allDays.map((_,i) => px + i*step);
                      const pts = allDays.map((d,i) => d.avg !== null ? { x:xs[i], y:toY(d.avg), v:d.avg, d } : null);
                      const validPts = pts.filter(Boolean);
                      if (validPts.length < 2) return null;
                      const path = validPts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
                      return (<>
                        <rect x={px} y={toY(180)} width={W-px*2} height={toY(70)-toY(180)} fill={COLORS.accent} opacity={0.07} />
                        <path d={path} fill="none" stroke={COLORS.info} strokeWidth="2" strokeLinejoin="round" />
                        {validPts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={gColor(p.v)} stroke={COLORS.bg} strokeWidth={1.5} />)}
                      </>);
                    })()}
                  </svg>
                  <div style={{ fontSize:10, color:COLORS.muted, marginTop:4 }}>Each dot = daily average glucose. Green band = target range (70–180 mg/dL).</div>
                </div>
              )}

              {/* Lab A1C log */}
              <div style={S.card}>
                <div style={{ fontSize:11, color:COLORS.muted, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:14 }}>Lab A1C Results — Log Actual Test Results</div>
                <div style={{ ...S.card, background:COLORS.surface, padding:"14px 16px", marginBottom:14 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", gap:10, marginBottom:10 }}>
                    <div>
                      <label style={S.lbl}>A1C Result (%)</label>
                      <input style={S.inp} type="number" step="0.1" min="4" max="16" placeholder="6.8" value={a1cForm.value} onChange={e => setA1cForm(f => ({...f, value: e.target.value}))} />
                    </div>
                    <div>
                      <label style={S.lbl}>Test Date</label>
                      <input style={S.inp} type="date" value={a1cForm.date} onChange={e => setA1cForm(f => ({...f, date: e.target.value}))} />
                    </div>
                    <div>
                      <label style={S.lbl}>Notes (optional)</label>
                      <input style={S.inp} placeholder="Lab name, doctor, context..." value={a1cForm.notes} onChange={e => setA1cForm(f => ({...f, notes: e.target.value}))} />
                    </div>
                  </div>
                  <button style={S.btn(COLORS.accentDim)} onClick={() => {
                    if (!a1cForm.value || !a1cForm.date) return;
                    setLabA1Cs(prev => [{ id:Date.now(), value:Number(a1cForm.value), date:a1cForm.date, notes:a1cForm.notes }, ...prev].sort((a,b) => b.date.localeCompare(a.date)));
                    setA1cForm(f => ({...f, value:"", notes:""}));
                  }}>Add Lab Result</button>
                </div>
                {!labA1Cs.length && <div style={{ color:COLORS.muted, fontSize:13 }}>No lab results logged yet. Add your actual A1C test results from the doctor above to track them over time and compare with the app estimate.</div>}
                {labA1Cs.map(r => (
                  <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${COLORS.border}33` }}>
                    <div>
                      <span style={{ fontSize:22, fontWeight:800, color:a1cColor(r.value) }}>{r.value.toFixed(1)}%</span>
                      <span style={{ fontSize:11, color:a1cColor(r.value), marginLeft:8, fontWeight:700 }}>{a1cLabel(r.value)}</span>
                      {r.notes && <div style={{ fontSize:11, color:COLORS.muted, marginTop:2, fontStyle:"italic" }}>{r.notes}</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, color:COLORS.muted }}>{new Date(r.date).toLocaleDateString([], { year:"numeric", month:"short", day:"numeric" })}</div>
                      <div style={{ fontSize:10, color:COLORS.muted }}>eAG: ~{estEAG(r.value)} mg/dL</div>
                      {estA1CWeighted && <div style={{ fontSize:10, color:COLORS.info, marginTop:2 }}>App est: {estA1CWeighted.toFixed(1)}%</div>}
                      <button style={{ marginTop:4, background:"none", border:`1px solid ${COLORS.danger}44`, color:COLORS.danger, borderRadius:6, padding:"2px 8px", fontSize:10, cursor:"pointer", fontFamily:"inherit" }} onClick={() => setLabA1Cs(prev => prev.filter(x => x.id !== r.id))}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div style={{ fontSize:11, color:COLORS.muted, fontStyle:"italic", padding:"10px 14px", background:COLORS.surface, borderRadius:8, border:`1px solid ${COLORS.border}`, lineHeight:1.7 }}>
                The estimated A1C uses the ADA/ADAG formula (Nathan et al., Diabetes Care 2008): A1C = (average glucose + 46.7) / 28.7.
                The weighted estimate gives 3x more weight to the last 30 days, matching how A1C naturally reflects recent glucose more heavily.
                This is an estimate only — always use your actual lab A1C for medical decisions. Individual results vary based on red blood cell lifespan, anemia, and other factors.
                The ADA recommends A1C testing at least twice a year when at target, or more frequently when not at goal.
              </div>
            </div>
          );
        })()}

        {/* ── MAP ── */}
        {tab === "Map" && (
          <div style={S.card} ref={el => { if (el && window.L) setTimeout(() => { const maps = document.querySelectorAll('.leaflet-container'); maps.forEach(m => m._leaflet_map && m._leaflet_map.invalidateSize()); }, 100); }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>Spatial Analysis Map</div>
            <GlucoseMap entries={entries} selectedEntryId={selectedEntryId} onClearSelected={() => setSelectedEntryId(null)} />
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "History" && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>All Entries ({entries.length})</div>
              {entries.length > 0 && <button style={S.btn(COLORS.danger)} onClick={() => { if (window.confirm("Delete all entries?")) setEntries([]); }}>Clear All</button>}
            </div>
            {!entries.length && <div style={{ color: COLORS.muted, fontSize: 13 }}>No entries yet.</div>}
            {entries.map(e => (
              <div key={e.id} style={{ borderBottom: `1px solid ${COLORS.border}44`, padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{e.meal || <span style={{ color: COLORS.muted }}>No meal</span>}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {e.glucose && <span style={S.tag(gColor(e.glucose))}>{e.glucose} mg/dL · {gLabel(e.glucose)}</span>}
                    {e.calories && <span style={S.tag(COLORS.warn)}>{e.calories} kcal</span>}
                    {e.carbs && <span style={S.tag(COLORS.info)}>{e.carbs}g carbs</span>}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: COLORS.info, marginTop: 4 }}>
                  {fmtDT(e.timestamp)}{e.glucoseTiming && ` · ${e.glucoseTiming}`}{e.locationName && ` · ${e.locationName}`}
                  {e.lat && e.lng && <span style={{ color: COLORS.muted }}> · {Number(e.lat).toFixed(4)}, {Number(e.lng).toFixed(4)}</span>}
                </div>
                {e.medsTaken && <div style={{ fontSize: 11, color: COLORS.heat, marginTop: 3 }}>💊 {e.medsTaken}</div>}
                {e.notes && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, fontStyle: "italic" }}>{e.notes}</div>}
                <button style={{ marginTop: 6, background: "none", border: `1px solid ${COLORS.danger}44`, color: COLORS.danger, borderRadius: 6, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setEntries(prev => prev.filter(x => x.id !== e.id))}>Delete</button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
