# Food Tracker

A very simple calorie, macronutrient and micronutrient tracker. No accounts, no AI, no server — just a food log.

## What it does

- **Log** what you eat per day, in grams or servings.
- **Totals** for calories, protein, carbs and fat, plus fiber, sugar, saturated fat, sodium, potassium, calcium, iron, vitamin C and vitamin D, compared with your daily targets.
- **Foods**: a personal food library. Add foods by copying values from the nutrition label (per 100 g or per serving). Comes with ~30 common foods (approximate USDA averages) that you can edit or delete.
- **Targets**: set your own daily goals (defaults are the US Daily Values for a 2,000 kcal diet).
- **Backup**: export / import all data as a JSON file.

All data stays in your browser (`localStorage`). Log entries keep a copy of the food's values, so editing a food later never changes past days.

## Running it

It's plain HTML/CSS/JavaScript with no build step or dependencies.

- Open `index.html` directly in a browser, or
- Serve the folder (needed for offline/install support):

  ```sh
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

Hosted on any static host (e.g. GitHub Pages), it can be installed to a phone's home screen and works offline.
