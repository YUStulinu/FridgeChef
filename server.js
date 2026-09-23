require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(ANTHROPIC_API_KEY) });
});

// ---- Generate recipes ----
app.post('/api/recipes', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'Missing ANTHROPIC_API_KEY. Add it to your .env file (see .env.example).'
      });
    }

    const { ingredients, preferences } = req.body;

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Please send at least one ingredient.' });
    }

    const prefs = preferences || {};
    const mealType = prefs.mealType || 'any';
    const maxTime = prefs.maxTime || 'no limit';
    const restrictions = Array.isArray(prefs.restrictions) && prefs.restrictions.length
      ? prefs.restrictions.join(', ')
      : 'none';
    const cuisine = prefs.cuisine || 'any';

    const systemPrompt = `You are a chef who suggests recipes based on ingredients available at home.
Respond STRICTLY with valid JSON (no extra text, no backticks, no markdown), matching exactly this structure:

{
  "recipes": [
    {
      "name": "string",
      "description": "short 1-2 sentence description",
      "timeMinutes": number,
      "difficulty": "easy" | "medium" | "hard",
      "cuisine": "short string",
      "ingredientsHave": ["ingredient from the user's list used in the recipe"],
      "ingredientsMissing": ["ingredient needed but NOT in the user's list"],
      "substitutions": [{"missing": "missing ingredient", "suggestion": "possible substitute"}],
      "steps": ["step 1", "step 2", "..."]
    }
  ]
}

Generate 3 different, realistic recipes, staying as close as possible to the given ingredients. Rely mostly on the ingredients in the list. Do not invent exotic, hard-to-find substitutes.`;

    const userPrompt = `Available ingredients: ${ingredients.join(', ')}.
Preferred meal type: ${mealType}.
Maximum prep time: ${maxTime} minutes.
Dietary restrictions: ${restrictions}.
Preferred cuisine: ${cuisine}.`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(502).json({ error: 'Error calling the Anthropic API.', details: errText });
    }

    const data = await apiRes.json();
    const textBlock = (data.content || []).find((c) => c.type === 'text');
    const rawText = textBlock ? textBlock.text : '';

    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', rawText);
      return res.status(502).json({ error: 'Could not parse the AI response as JSON.', raw: rawText });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`FridgeChef is running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
});
