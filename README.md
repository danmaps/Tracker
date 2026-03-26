# GlucoMap — Diabetic Health & Spatial Tracker

> A personal health tracking application for people with diabetes that combines blood glucose monitoring, dietary logging, medication tracking, and geospatial analysis into a single research-grade tool.

---

## Overview

GlucoMap was built around a central research hypothesis: **where you eat matters as much as what you eat.** Most diabetes tracking apps collect glucose and dietary data but discard the spatial dimension — the location where food was consumed. GlucoMap captures that missing variable, enabling patterns that traditional tracking cannot reveal:

- Do glucose levels spike more at certain locations?
- How many fast food restaurants are within 400 meters of your typical eating spots?
- Do commute corridors with high fast food density correlate with elevated glucose events?
- Does your glucose control differ between home, work, and travel?

These questions have real clinical value. By combining individual longitudinal tracking with geospatial analysis, GlucoMap bridges the gap between personal health monitoring and the kind of built-environment research that public health epidemiologists conduct at the population level — but applied to a single patient's own data.

---

## Screenshots

> _Coming soon — contributions welcome_

---

## Features

### Dashboard
- Last glucose reading with color-coded status (Normal / Elevated / High / Low)
- Average glucose and estimated A1C percentage
- Average calories per entry
- Count of geographically mapped locations
- 14-reading glucose trend sparkline

### Log Entry
- **Date and time** — auto-set to now, adjustable for retroactive entries
- **Food Lookup** — built-in nutrition database covering 90+ common foods and fast food items; type a natural language description (e.g. "handful of mixed nuts", "large Diet Coke from 7-Eleven", "Big Mac meal") and auto-fill calories and carbs with one click
- **Blood glucose** — large prominent input with live color indicator and range label; choose timing context (Fasting, Pre-Meal, 1hr Post, 2hr Post, Bedtime)
- **Calories and carbohydrates**
- **Medications taken** — freehand or quick-add from your saved medication list
- **Notes** — stress level, activity, how you felt
- **Location** — enter any place name as a label, or paste coordinates from Apple Maps, Google Maps, or any mapping app for a full map pin

### Glucose Chart Tab
- SVG chart of all readings over selectable time periods (7 / 14 / 30 / 90 days / All)
- Color-coded dots with target range band overlay
- Readings that have a saved location show a glowing ring — **clicking jumps directly to that location on the map**
- Full sortable readings list below the chart with location links, meal info, and medications

### A1C Tracker Tab
- **Weighted estimated A1C** — applies 3× weight to the last 30 days of readings vs. days 31–90, matching how actual HbA1c is physiologically weighted
- **Simple average A1C** — plain mean of all readings using the ADA/ADAG formula
- Formula: `A1C = (average glucose + 46.7) / 28.7` (Nathan et al., *Diabetes Care* 2008)
- ADA target reference table (Normal / Prediabetes / At Target / High Risk)
- Time in Range bar — percentage of readings Low / In Range (70–180) / High
- 30-day rolling daily average chart
- **Lab A1C log** — record your actual doctor's test results with date and notes; compare lab values against the app estimate over time

### Medications Tab
- Add any medication with name, dose, unit (mg / mcg / units / mL / g / IU / tablet), frequency, start date, and notes
- Each medication shows how many log entries were recorded while taking it
- Quick-add buttons appear in Log Entry so you can log medications without retyping

### Spatial Analysis Map Tab
- **Three independent togglable layers:**
  - 🩸 **Glucose Readings** — color-coded pins (green/orange/red) with time labels and fast food proximity badges
  - 🌡 **Glucose Heat Map** — canvas-rendered radial heatmap using glucose values as intensity; green → orange → red
  - 🍔 **Fast Food** — live query of OpenStreetMap via Overpass API for fast food restaurants in the current map view
- **Fast Food Proximity Analysis panel:**
  - Count of fast food locations in the loaded area
  - How many of your meals were logged within 400 meters of fast food
  - What percentage of elevated glucose events occurred near fast food
  - Per-entry proximity breakdown table
- Clicking a dot opens a popup with full entry details
- Arriving from the Glucose Chart automatically zooms the map to the selected reading's location

### History Tab
- Full scrollable list of all entries
- Each entry shows glucose, calories, carbs, timing, location, medications, and notes
- Individual entry delete
- Clear all with confirmation

---

## Coordinate Input

GlucoMap accepts coordinates in all popular formats:

| Format | Example |
|--------|---------|
| Apple Maps | `33.76773° N, 116.93049° W` |
| Google Maps | `33.7677° N 116.9305° W` |
| Plain decimal | `33.76773, -116.93049` |
| Prefix style | `N33.76773 W116.93049` |
| Suffix no space | `33.76773N 116.93049W` |
| With parentheses | `(33.76773, -116.93049)` |
| Southern/Eastern | `33.8688° S, 151.2093° E` |

**How to get coordinates from Google Maps:**
1. Open Google Maps and find your location
2. Long-press on the spot until a red pin drops
3. The coordinates appear at the bottom of the screen — tap them
4. Tap Copy, then paste into GlucoMap

**From Apple Maps:**
Coordinates appear in the format `33.76773° N, 116.93049° W` — paste directly, GlucoMap handles the conversion automatically.

---

## Food Lookup Database

The built-in food database covers:

- **Major fast food chains** — McDonald's, Burger King, Wendy's, KFC, Taco Bell, Chipotle, Subway, Chick-fil-A, Popeyes, Five Guys, Shake Shack, Domino's, Pizza Hut, Krispy Kreme
- **Drinks** — sodas (regular and diet), juices, milk, coffee, sports drinks
- **Snacks** — nuts, granola bars, protein bars, fruit, chips, crackers, cheese, yogurt, eggs
- **Meals** — grilled proteins, salads, rice, pasta, potato dishes, soups, tacos, burritos, sushi, sandwiches, breakfast items
- **Branded items** — 7-Eleven fountain drinks, specific chain menu items

Lookup uses exact key matching first, then a fuzzy word-match fallback. Each result includes a confidence rating (High / Medium / Low) and notes on serving size assumptions.

---

## A1C Calculation

GlucoMap uses the validated ADA/ADAG formula established by Nathan et al. in the landmark ADAG study (*Diabetes Care*, August 2008):

```
eAG (mg/dL) = 28.7 × A1C(%) − 46.7
A1C(%)      = (average glucose + 46.7) / 28.7
```

The **weighted estimate** applies 3× weight to readings from the last 30 days compared to readings from days 31–90, reflecting the physiological reality that recent glucose levels contribute more to the HbA1c value than older ones (red blood cell lifespan is approximately 120 days, with a recency bias).

> **Important:** App-based estimates are for informational and trend-monitoring purposes only. Always use your actual laboratory A1C result for medical decisions. Individual results may vary based on red blood cell lifespan, anemia, hemoglobin variants, and other factors. The ADA recommends A1C testing at least twice a year when at target, more frequently when not at goal.

---

## Research Vision

GlucoMap was designed with a longer-term clinical research application in mind. The spatial analytics layer — currently used for individual self-monitoring — is intended to eventually support:

### Food Environment Analysis
Overlaying patient eating locations against food desert maps, fast food density corridors, grocery store access, and neighborhood income data to understand how the built environment influences dietary choices.

### Demographic and Geographic Correlation
Connecting glucose outcomes to census tract data (income, ethnicity, urban/rural classification) to examine whether where someone lives predicts glucose control independent of individual choices.

### Behavioral Pattern Detection
Identifying patterns like "glucose spikes are consistently higher at work locations vs. home" or "weekend eating locations correlate with better control" — patterns a patient would never notice but a physician could identify in aggregate.

### Commute Corridor Analysis
A patient's regular driving routes expose them to fast food opportunities passively. Mapping the fast food density along typical commute paths and correlating it with stop frequency and subsequent glucose events could quantify passive environmental exposure as a risk factor.

### Clinical Utility
A physician reviewing a patient's GlucoMap before an appointment would have a fundamentally different conversation than the standard "what have you been eating?" The spatial layer makes abstract longitudinal data concrete and actionable.

### Future Integration Targets
- FHIR-compatible health data export for EHR integration
- USDA Food Environment Atlas overlay (freely available dataset)
- CGM (Continuous Glucose Monitor) API integration — Dexcom, FreeStyle Libre
- Census Bureau demographic data layers
- Aggregate anonymized population-level analysis for research publication

---

## Technical Architecture

GlucoMap is a single-file React application (`diabetic-tracker.jsx`).

### Stack
- **React 18** — functional components, hooks
- **Leaflet 1.9** — interactive mapping via CDN
- **OpenStreetMap / CARTO** — tile basemap
- **Overpass API** — live fast food location queries from OpenStreetMap data
- **Claude.ai Artifact Storage API** — persistent cross-session storage for saved locations, medications, and lab A1C records
- **localStorage** — entry persistence within the browser
- **SVG** — all charts rendered natively, no charting library dependency

### Data Storage
| Data | Storage |
|------|---------|
| Log entries | `localStorage` (key: `glucomap-entries-v1`) |
| Saved locations | Artifact persistent storage (key: `gm-saved-locs`) |
| Medications | Artifact persistent storage (key: `gm-meds`) |
| Lab A1C records | Artifact persistent storage (key: `gm-lab-a1cs`) |

### Key Algorithms
- **Haversine formula** — great-circle distance in meters between two lat/lng points (used for fast food proximity analysis)
- **Weighted A1C** — 3:1 weighting of last-30-day vs. 31–90-day readings
- **Multi-format coordinate parser** — tokenizer handling degree symbols, N/S/E/W suffixes and prefixes, plain decimal, parenthesized formats
- **Canvas heatmap renderer** — custom Leaflet layer using HTML5 Canvas with radial gradient blobs, color-mapped to glucose intensity

---

## Getting Started

### Running in Claude.ai (current)
The app runs as a React artifact inside Claude.ai. Open the artifact and all features are immediately available — no installation required.

### Running Locally (for development)

```bash
# Clone the repository
git clone https://github.com/yourusername/glucomap.git
cd glucomap

# Install dependencies
npm install

# Start development server
npm run dev
```

You will need to adapt the storage layer — replace `window.storage` calls with `localStorage` or a backend of your choice, as the Claude artifact storage API is only available inside Claude.ai.

### Prerequisites
- Node.js 18+
- A React project scaffold (Vite recommended)

```bash
# Create a new Vite + React project and drop in the component
npm create vite@latest glucomap -- --template react
cd glucomap
npm install
# Replace src/App.jsx with diabetic-tracker.jsx
npm run dev
```

---

## Roadmap

### Near Term
- [ ] CSV / JSON data export
- [ ] Data import from previous sessions
- [ ] Offline-first PWA with native GPS access (removes coordinate paste requirement)
- [ ] Photo attachment for meals
- [ ] Insulin dose tracking and carb-to-insulin ratio calculator

### Medium Term
- [ ] Backend API + user accounts for multi-device sync
- [ ] Physician access portal — read-only view of patient data
- [ ] CGM integration (Dexcom API, FreeStyle Libre)
- [ ] USDA Food Environment Atlas overlay layer
- [ ] Census demographic data integration

### Long Term
- [ ] FHIR export for EHR compatibility
- [ ] Anonymized aggregate research dataset with patient consent
- [ ] Pattern detection and clinical insight generation
- [ ] Population-level food environment correlation studies

---

## Contributing

Contributions are welcome, particularly from:

- **Clinicians and endocrinologists** — validation of medical logic, A1C calculation accuracy, clinical workflow integration
- **GIS specialists and spatial analysts** — additional map layers, food environment datasets, demographic overlays
- **Diabetic patients and caregivers** — UX feedback, feature requests, real-world usability testing
- **Public health researchers** — epidemiological methodology, study design for population-level analysis
- **Frontend developers** — React optimization, mobile PWA conversion, accessibility improvements

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Test thoroughly — particularly the coordinate parser, A1C formula, and map rendering
5. Open a pull request with a clear description of what you changed and why

### Reporting Issues
Please open a GitHub Issue with:
- What you were doing when the problem occurred
- What you expected to happen
- What actually happened
- Your browser and device

---

## Medical Disclaimer

GlucoMap is a personal health tracking and research tool. It is **not a medical device** and is **not intended to diagnose, treat, cure, or prevent any disease**.

- All glucose estimates, A1C calculations, and nutritional data are approximations
- Always consult your physician, endocrinologist, or certified diabetes educator for medical decisions
- Never adjust medications or insulin dosages based solely on data from this app
- The ADA A1C formula provides population-level estimates; individual variation exists
- Nutritional data in the food database is sourced from standard databases and may not reflect actual portion sizes or preparation methods

---

## References

- Nathan DM, Kuenen J, Borg R, et al. *Translating the A1C assay into estimated average glucose values.* Diabetes Care. 2008;31(8):1473–1478. [PubMed](https://pubmed.ncbi.nlm.nih.gov/18540046/)
- American Diabetes Association. *eAG/A1C Conversion Calculator.* [professional.diabetes.org](https://professional.diabetes.org/glucose_calc)
- NGSP. *HbA1c and Estimated Average Glucose (eAG).* [ngsp.org](https://ngsp.org/A1ceAG.asp)
- USDA Economic Research Service. *Food Environment Atlas.* [ers.usda.gov](https://www.ers.usda.gov/data-products/food-environment-atlas/)
- OpenStreetMap contributors. Map data available under the [Open Database License](https://opendatacommons.org/licenses/odbl/)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute. Attribution appreciated but not required.

---

## Author

Built by Adrian with Claude (Anthropic) as an AI-assisted development project, March 2026.

The research vision — connecting individual diabetic health data with geospatial food environment analysis — emerged from the observation that most health tracking discards the "where" entirely, despite strong epidemiological evidence that built environment significantly influences dietary outcomes and metabolic health.

---

*If you are a clinician, researcher, or institution interested in collaborating on a formal study using GlucoMap's approach, please open a GitHub issue or reach out directly.*
