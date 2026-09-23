# FridgeChef 🍳

A recipe chatbot that suggests meals based on the ingredients you have at home, powered by AI (Claude).

## What it does

You enter the ingredients you have at home, pick your preferences (meal type, time, restrictions, cuisine), and the app generates 3 possible recipes — each showing which ingredients you already have, which ones are missing, possible substitutes, and the preparation steps.

## Project structure

```
fridgechef/
├── server.js           # Express server, calls the Anthropic API
├── package.json
├── .env.example         # template for environment variables
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## Installation

1. You'll need [Node.js](https://nodejs.org/) version 18 or newer (for native `fetch`).
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   You can get a key from [Claude Platform / Console](https://console.anthropic.com/).
5. Start the server:
   ```bash
   npm start
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser.

> ⚠️ The `.env` file is ignored by Git (see `.gitignore`) — never push your API key to GitHub.

## Features — MVP

- Free-form ingredient input, added as tags
- Preferences: meal type, maximum prep time, cuisine type, dietary restrictions
- Generates 3 AI-powered recipes, each with:
  - available vs. missing ingredients (visually distinguished)
  - possible substitutes for missing ingredients
  - preparation steps
  - estimated time and difficulty level

## Features — Extensions (already included, simple version)

- **Favorites** — save recipes with one click (stored in `localStorage`)
- **Shopping list** — automatically built from the missing ingredients of your favorite recipes, grouped by recipe
- **History** — your last 20 searches, with the option to regenerate the same ingredient + preference combination
- **Filters** — prep time, cuisine type, dietary restrictions

## Ideas for next steps (not included yet)

- Ingredient autocomplete / suggestions for common items while typing
- Export the shopping list as a PDF or send it by email
- Authentication + database storage (instead of `localStorage`, which is local per browser)
- Filter favorite recipes by cuisine/difficulty
- Support for uploading a fridge photo + ingredient recognition from the image

## Pushing to GitHub

```bash
cd fridgechef
git init
git add .
git commit -m "Initial commit: FridgeChef MVP"
git branch -M main
git remote add origin <your_github_repo_url>
git push -u origin main
```

`.env` won't be pushed (it's in `.gitignore`) — that's correct, your key stays local only.
