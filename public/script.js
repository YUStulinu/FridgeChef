(function () {
  'use strict';

  // ---------- STATE ----------
  let ingredients = [];
  let currentRecipes = [];

  const STORAGE_KEYS = {
    favorites: 'fridgechef_favorites',
    history: 'fridgechef_history'
  };

  // ---------- STORAGE HELPERS ----------
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  function getFavorites() { return loadJSON(STORAGE_KEYS.favorites, []); }
  function setFavorites(list) { saveJSON(STORAGE_KEYS.favorites, list); }
  function getHistory() { return loadJSON(STORAGE_KEYS.history, []); }
  function setHistory(list) { saveJSON(STORAGE_KEYS.history, list); }

  function recipeId(recipe) {
    return (recipe.name || '') + '::' + (recipe.ingredientsHave || []).join(',');
  }

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ingredientInput = $('#ingredientInput');
  const addIngredientBtn = $('#addIngredientBtn');
  const ingredientTags = $('#ingredientTags');
  const generateBtn = $('#generateBtn');
  const formError = $('#formError');
  const loadingState = $('#loadingState');
  const emptyState = $('#emptyState');
  const recipeResults = $('#recipeResults');

  // ---------- TABS ----------
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('is-active'));
      $$('.tab-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      $('#tab-' + btn.dataset.tab).classList.add('is-active');
      if (btn.dataset.tab === 'favorites') renderFavorites();
      if (btn.dataset.tab === 'shopping') renderShoppingList();
      if (btn.dataset.tab === 'history') renderHistory();
    });
  });

  // ---------- INGREDIENT TAGS ----------
  function renderIngredientTags() {
    ingredientTags.innerHTML = '';
    ingredients.forEach((ing, idx) => {
      const tag = document.createElement('span');
      tag.className = 'ingredient-tag';
      tag.innerHTML = `${escapeHtml(ing)} <button type="button" aria-label="Remove ${escapeHtml(ing)}">&times;</button>`;
      tag.querySelector('button').addEventListener('click', () => {
        ingredients.splice(idx, 1);
        renderIngredientTags();
      });
      ingredientTags.appendChild(tag);
    });
  }

  function addIngredientFromInput() {
    const raw = ingredientInput.value;
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => {
      const normalized = p.toLowerCase();
      if (!ingredients.some((i) => i.toLowerCase() === normalized)) {
        ingredients.push(p);
      }
    });
    ingredientInput.value = '';
    renderIngredientTags();
  }

  addIngredientBtn.addEventListener('click', addIngredientFromInput);
  ingredientInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addIngredientFromInput();
    }
  });

  // ---------- GENERATE ----------
  generateBtn.addEventListener('click', () => generateRecipes());

  async function generateRecipes(overridePreferences) {
    formError.hidden = true;

    if (ingredients.length === 0) {
      formError.textContent = 'Add at least one ingredient before generating recipes.';
      formError.hidden = false;
      return;
    }

    const preferences = overridePreferences || {
      mealType: $('#mealType').value,
      maxTime: $('#maxTime').value,
      cuisine: $('#cuisine').value,
      restrictions: $$('.restriction-cb:checked').map((cb) => cb.value)
    };

    emptyState.hidden = true;
    recipeResults.innerHTML = '';
    loadingState.hidden = false;
    generateBtn.disabled = true;

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, preferences })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unknown error while generating recipes.');
      }

      currentRecipes = data.recipes || [];
      renderRecipes(currentRecipes, recipeResults, { showFavorite: true });

      addToHistory(ingredients.slice(), preferences);
    } catch (err) {
      console.error(err);
      formError.textContent = 'Could not generate recipes: ' + err.message;
      formError.hidden = false;
      emptyState.hidden = false;
    } finally {
      loadingState.hidden = true;
      generateBtn.disabled = false;
    }
  }

  // ---------- RENDER RECIPE CARDS ----------
  function renderRecipes(recipes, container, opts) {
    container.innerHTML = '';
    if (!recipes.length) {
      container.innerHTML = '<p class="hint">No recipes to display.</p>';
      return;
    }

    const favorites = getFavorites();

    recipes.forEach((recipe) => {
      const isFav = favorites.some((f) => recipeId(f) === recipeId(recipe));
      const card = document.createElement('article');
      card.className = 'recipe-card';

      const matchPct = computeMatch(recipe);

      const haveItems = (recipe.ingredientsHave || [])
        .map((i) => `<li class="have">${escapeHtml(i)}</li>`).join('');
      const missingItems = (recipe.ingredientsMissing || [])
        .map((i) => `<li class="missing">${escapeHtml(i)}</li>`).join('');

      const subs = (recipe.substitutions || []);
      const subsHtml = subs.length
        ? `<div class="substitutions"><strong>Substitutes:</strong> ${subs.map((s) => `${escapeHtml(s.missing)} → ${escapeHtml(s.suggestion)}`).join('; ')}</div>`
        : '';

      const steps = (recipe.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');

      card.innerHTML = `
        <span class="stamp">${matchPct}% match</span>
        <h3>${escapeHtml(recipe.name || 'Recipe')}</h3>
        <p class="desc">${escapeHtml(recipe.description || '')}</p>
        <div class="recipe-meta">
          <span>⏱ ${escapeHtml(String(recipe.timeMinutes || '?'))} min</span>
          <span>⚙ ${escapeHtml(recipe.difficulty || '—')}</span>
          <span>🍽 ${escapeHtml(recipe.cuisine || '—')}</span>
        </div>
        <ul class="ingredient-list">${haveItems}${missingItems}</ul>
        ${subsHtml}
        <details class="steps">
          <summary>Preparation steps</summary>
          <ol>${steps}</ol>
        </details>
        <div class="card-actions">
          <button type="button" class="btn-fav ${isFav ? 'is-favorited' : ''}">${isFav ? '★ Saved' : '☆ Save'}</button>
          ${opts && opts.showRemove ? '<button type="button" class="btn-remove">Remove</button>' : ''}
        </div>
      `;

      card.querySelector('.btn-fav').addEventListener('click', (e) => {
        toggleFavorite(recipe);
        const btn = e.currentTarget;
        const nowFav = getFavorites().some((f) => recipeId(f) === recipeId(recipe));
        btn.classList.toggle('is-favorited', nowFav);
        btn.textContent = nowFav ? '★ Saved' : '☆ Save';
        if ($('#tab-favorites').classList.contains('is-active')) renderFavorites();
      });

      const removeBtn = card.querySelector('.btn-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const favs = getFavorites().filter((f) => recipeId(f) !== recipeId(recipe));
          setFavorites(favs);
          renderFavorites();
        });
      }

      container.appendChild(card);
    });
  }

  function computeMatch(recipe) {
    const have = (recipe.ingredientsHave || []).length;
    const missing = (recipe.ingredientsMissing || []).length;
    const total = have + missing;
    if (total === 0) return 100;
    return Math.round((have / total) * 100);
  }

  // ---------- FAVORITES ----------
  function toggleFavorite(recipe) {
    const favs = getFavorites();
    const exists = favs.some((f) => recipeId(f) === recipeId(recipe));
    if (exists) {
      setFavorites(favs.filter((f) => recipeId(f) !== recipeId(recipe)));
    } else {
      favs.push(recipe);
      setFavorites(favs);
    }
    updateCounts();
  }

  function renderFavorites() {
    const favs = getFavorites();
    const grid = $('#favoritesGrid');
    const empty = $('#favoritesEmpty');
    if (!favs.length) {
      empty.hidden = false;
      grid.innerHTML = '';
      return;
    }
    empty.hidden = true;
    renderRecipes(favs, grid, { showFavorite: true, showRemove: true });
  }

  // ---------- SHOPPING LIST ----------
  function renderShoppingList() {
    const favs = getFavorites();
    const list = $('#shoppingList');
    const empty = $('#shoppingEmpty');
    list.innerHTML = '';

    const items = new Map(); // ingredient -> [recipe names]
    favs.forEach((r) => {
      (r.ingredientsMissing || []).forEach((ing) => {
        const key = ing.toLowerCase();
        if (!items.has(key)) items.set(key, { label: ing, recipes: [] });
        items.get(key).recipes.push(r.name);
      });
    });

    if (items.size === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    Array.from(items.values()).forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="checkbox" />
        <span>${escapeHtml(item.label)}</span>
        <span class="src">for: ${escapeHtml(item.recipes.join(', '))}</span>
      `;
      list.appendChild(li);
    });
  }

  // ---------- HISTORY ----------
  function addToHistory(ingredientList, preferences) {
    const history = getHistory();
    history.unshift({
      ingredients: ingredientList,
      preferences,
      date: new Date().toISOString()
    });
    setHistory(history.slice(0, 20));
  }

  function renderHistory() {
    const history = getHistory();
    const list = $('#historyList');
    const empty = $('#historyEmpty');
    list.innerHTML = '';

    if (!history.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    history.forEach((entry) => {
      const li = document.createElement('li');
      const date = new Date(entry.date);
      const dateStr = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `
        <div>
          <div>${escapeHtml(entry.ingredients.join(', '))}</div>
          <div class="history-date">${dateStr}</div>
        </div>
        <button type="button" class="history-redo">Regenerate</button>
      `;
      li.querySelector('.history-redo').addEventListener('click', () => {
        ingredients = entry.ingredients.slice();
        renderIngredientTags();
        if (entry.preferences) {
          $('#mealType').value = entry.preferences.mealType || 'any';
          $('#maxTime').value = entry.preferences.maxTime || 'no limit';
          $('#cuisine').value = entry.preferences.cuisine || 'any';
          $$('.restriction-cb').forEach((cb) => {
            cb.checked = (entry.preferences.restrictions || []).includes(cb.value);
          });
        }
        $$('.tab-btn').forEach((b) => b.classList.remove('is-active'));
        $$('.tab-panel').forEach((p) => p.classList.remove('is-active'));
        document.querySelector('[data-tab="generate"]').classList.add('is-active');
        $('#tab-generate').classList.add('is-active');
        generateRecipes(entry.preferences);
      });
      list.appendChild(li);
    });
  }

  // ---------- COUNTS ----------
  function updateCounts() {
    const favs = getFavorites();
    $('#favCount').textContent = favs.length ? `(${favs.length})` : '';
    const shoppingSet = new Set();
    favs.forEach((r) => (r.ingredientsMissing || []).forEach((i) => shoppingSet.add(i.toLowerCase())));
    $('#shopCount').textContent = shoppingSet.size ? `(${shoppingSet.size})` : '';
  }

  // ---------- UTIL ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- INIT ----------
  updateCounts();
})();
