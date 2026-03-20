const cardGrid = document.getElementById("cardGrid");
const statusElement = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const pokerOpenBtn = document.getElementById("pokerOpenBtn");
const cardTemplate = document.getElementById("cardTemplate");

const duelCatA = document.getElementById("duelCatA");
const duelCatB = document.getElementById("duelCatB");
const duelBtn = document.getElementById("duelBtn");
const duelResult = document.getElementById("duelResult");

const passportModal = document.getElementById("passportModal");
const passportClose = document.getElementById("passportClose");
const passportName = document.getElementById("passportName");
const passportTitle = document.getElementById("passportTitle");
const passportOrigin = document.getElementById("passportOrigin");
const passportRarity = document.getElementById("passportRarity");
const passportIssue = document.getElementById("passportIssue");

const pokerModal = document.getElementById("pokerModal");
const pokerClose = document.getElementById("pokerClose");
const pokerRound = document.getElementById("pokerRound");
const pokerStatus = document.getElementById("pokerStatus");
const dealerHandElement = document.getElementById("dealerHand");
const communityHandElement = document.getElementById("communityHand");
const playerHandElement = document.getElementById("playerHand");
const dealerRank = document.getElementById("dealerRank");
const playerRank = document.getElementById("playerRank");
const pokerDealBtn = document.getElementById("pokerDealBtn");
const pokerCheckBtn = document.getElementById("pokerCheckBtn");
const pokerRaiseBtn = document.getElementById("pokerRaiseBtn");
const pokerFoldBtn = document.getElementById("pokerFoldBtn");
const pokerNewBtn = document.getElementById("pokerNewBtn");
const pokerBank = document.getElementById("pokerBank");
const pokerBet = document.getElementById("pokerBet");
const pokerCatBetInfo = document.getElementById("pokerCatBetInfo");
const pokerCatBetSelect = document.getElementById("pokerCatBetSelect");
const pokerBetMinus = document.getElementById("pokerBetMinus");
const pokerBetPlus = document.getElementById("pokerBetPlus");
const pokerAllInBtn = document.getElementById("pokerAllInBtn");
const pokerRiggedBtn = document.getElementById("pokerRiggedBtn");

const CARD_LIMIT = 12;
const POKER_START_BANKROLL = 100;
const POKER_RIGGED_EDGE_CHANCE = 0.45;
const CAT_BET_VALUES = {
  Common: 15,
  Epic: 35,
  Mythic: 45
};

let currentCatRecords = [];
let pokerState = null;
let pokerBankroll = POKER_START_BANKROLL;
let pokerCurrentBet = 10;
let pokerRiggedMode = false;

const ESTIMATED_ORIGINS = [
  "Mediterranean Coast",
  "Nordic Highlands",
  "Andean Valleys",
  "Japanese Port Cities",
  "Anatolian Plains",
  "British Countryside",
  "Canadian Forest Belt",
  "Desert Trade Routes",
  "Baltic Harbor Towns",
  "Sicilian Hills",
  "Iberian Seaside Villages",
  "Patagonian Wind Plains",
  "Mekong River Settlements"
];

const ESTIMATED_TEMPERAMENTS = [
  "Friendly, curious, and dramatic at dinner time",
  "Calm, observant, and secretly playful",
  "Talkative, clever, and highly snack-motivated",
  "Independent, dignified, but affectionate at night",
  "Bold, energetic, and always investigating",
  "Gentle, social, and loves window watching",
  "Confident, goofy, and attention-seeking",
  "Relaxed, patient, and quietly mischievous"
];

const FALLBACK_DESCRIPTIONS = [
  "This mystery cat looks like a professional nap champion with excellent cuddle skills.",
  "No official breed notes yet, but this cat clearly has main-character energy.",
  "A graceful little explorer with bright eyes and a very confident pose.",
  "This cat has a calm, cozy vibe and probably claims the warmest spot at home.",
  "Elegant whiskers, curious expression, and a face built for dramatic close-ups.",
  "No profile details available, but the charm level is objectively very high.",
  "This fluffy superstar seems equal parts mischief, affection, and style.",
  "A picture-perfect cat with strong lounge-and-observe-from-afar instincts.",
  "Unknown background, unforgettable look, and undeniable cuteness."
];

const CAT_FORTUNES = [
  "Today you will conquer the sofa kingdom.",
  "An unexpected snack opportunity is approaching.",
  "A sunbeam will choose you as its favorite companion.",
  "Your dramatic stare will win every argument.",
  "A mysterious box will appear and become your throne.",
  "You will discover a new strategic nap location.",
  "Someone will admire your elegant whisker choreography.",
  "Your curiosity will open a delightful new adventure.",
  "You will inspire at least one human to cancel plans.",
  "A tiny act of chaos will bring great joy.",
  "Your majestic entrance will stop all conversations.",
  "The treat economy will shift in your favor."
];

const HOVER_CAT_IMAGES = [
  "cats/adopt.png",
  "cats/arrogant.png",
  "cats/neko.png",
  "cats/stretch.png",
  "cats/yawn.png"
];

const CAT_TITLES = [
  "Grand Sofa Admiral",
  "Window Realm Ambassador",
  "Keeper of the Midnight Zoomies",
  "Supreme Blanket Inspector",
  "Chief Sunbeam Cartographer",
  "Minister of Snack Negotiations"
];

const RARITY_CLASSES = [
  { label: "Common", cssClass: "rarity-common", threshold: 57 },
  { label: "Epic", cssClass: "rarity-epic", threshold: 85 },
  { label: "Mythic", cssClass: "rarity-mythic", threshold: 98 },
  { label: "Cosmic Loaf", cssClass: "rarity-cosmic", threshold: 99 },
  { label: "Unknown", cssClass: "rarity-unknown", threshold: 100 }
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getCatSeed(cat, index = 0) {
  return hashText(`${cat.id || `cat-${index}`}-${cat.url || ""}`);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme";
  }
}

function initializeTheme() {
  const storedTheme = localStorage.getItem("cat-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(storedTheme || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("cat-theme", nextTheme);
}

function parseAverageLifeSpan(rawLifeSpan) {
  if (!rawLifeSpan) {
    return null;
  }

  const values = rawLifeSpan
    .split(/[^0-9]+/)
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function estimateOrigin(cat, seed) {
  const ratio = cat.width && cat.height ? cat.width / cat.height : 1;
  const bias = Math.round(ratio * 10);
  const idx = (seed + bias) % ESTIMATED_ORIGINS.length;
  return ESTIMATED_ORIGINS[idx];
}

function estimateTemperament(seed) {
  return ESTIMATED_TEMPERAMENTS[seed % ESTIMATED_TEMPERAMENTS.length];
}

function estimateAverageLifeSpan(breed, seed) {
  const base = parseAverageLifeSpan(breed?.life_span) ?? 14;
  const variation = ((seed % 5) - 2) * 0.6;
  const value = Math.max(8, Math.min(20, base + variation));
  return `${value.toFixed(1)} years on average`;
}

function buildSyntheticProfile(cat, breed) {
  const seed = getCatSeed(cat);
  return {
    origin: estimateOrigin(cat, seed),
    lifeSpan: estimateAverageLifeSpan(breed, seed),
    temperament: estimateTemperament(seed)
  };
}

function pickFallbackDescription(cat, index) {
  const seed = hashText(`${cat.id || index}-${cat.url || "image"}`);
  return FALLBACK_DESCRIPTIONS[seed % FALLBACK_DESCRIPTIONS.length];
}

function getDayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function pickDailyFortune(cat, index) {
  const seed = hashText(`${cat.id || index}-${getDayKey()}`);
  return CAT_FORTUNES[seed % CAT_FORTUNES.length];
}

function getRarity(seed) {
  const score = seed % 100;
  for (const rarity of RARITY_CLASSES) {
    if (score < rarity.threshold) {
      return rarity;
    }
  }
  return RARITY_CLASSES[0];
}

function pickHoverCatImage(seed) {
  if (!HOVER_CAT_IMAGES.length) {
    return "";
  }

  const idx = Math.abs(seed) % HOVER_CAT_IMAGES.length;
  return HOVER_CAT_IMAGES[idx];
}

function createMetaList(profile) {
  const items = [
    { label: "Origin Detector", value: profile.origin },
    { label: "Average Life Span", value: profile.lifeSpan },
    { label: "Temperament", value: profile.temperament }
  ];

  return items.map(({ label, value }) => `<li><span>${label}:</span> ${value}</li>`).join("");
}

function buildPassportIssueStamp(seed) {
  const minYear = 2016;
  const maxYear = 2026;
  const year = minYear + (seed % (maxYear - minYear + 1));
  const month = ((seed >>> 8) % 12) + 1;
  const dayCount = new Date(year, month, 0).getDate();
  const day = ((seed >>> 16) % dayCount) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function openPassport(record) {
  passportName.textContent = record.name;
  passportTitle.textContent = CAT_TITLES[record.seed % CAT_TITLES.length];
  passportOrigin.textContent = record.profile.origin;
  passportRarity.textContent = record.rarity.label;
  passportIssue.textContent = `${buildPassportIssueStamp(record.seed)} / ID-${String(record.seed % 10000).padStart(4, "0")}`;
  passportModal.classList.add("open");
  passportModal.setAttribute("aria-hidden", "false");
}

function closePassport() {
  passportModal.classList.remove("open");
  passportModal.setAttribute("aria-hidden", "true");
}

function buildCatRecord(cat, index) {
  const breed = cat.breeds?.[0];
  const profile = buildSyntheticProfile(cat, breed);
  const seed = getCatSeed(cat, index);
  const rarity = getRarity(seed);
  const name = breed?.name || `Cat #${index + 1}`;
  return { id: cat.id || `cat-${index}`, index, cat, breed, profile, seed, rarity, name };
}

function buildCard(record) {
  const clone = cardTemplate.content.cloneNode(true);
  const image = clone.querySelector(".cat-image");
  const title = clone.querySelector(".cat-title");
  const rarityBadge = clone.querySelector(".rarity-badge");
  const description = clone.querySelector(".cat-description");
  const fortune = clone.querySelector(".cat-fortune");
  const passportBtn = clone.querySelector(".passport-btn");
  const meta = clone.querySelector(".cat-meta");
  const card = clone.querySelector(".cat-card");
  card.dataset.catId = record.id;

  image.src = record.cat.url;
  image.alt = record.breed?.name ? `${record.breed.name} cat` : "Cat image";
  image.dataset.originalSrc = record.cat.url;
  image.dataset.originalAlt = image.alt;

  const activateHoverSwap = () => {
    const hoverSrc = pickHoverCatImage(record.seed + Math.floor(Date.now() / 1000));
    if (!hoverSrc) {
      return;
    }

    image.dataset.hoverActive = "1";
    image.classList.add("is-hover-swap");
    image.src = hoverSrc;
    image.alt = `${record.name} hover image`;
  };

  const deactivateHoverSwap = () => {
    image.dataset.hoverActive = "0";
    image.classList.remove("is-hover-swap");
    image.src = image.dataset.originalSrc || record.cat.url;
    image.alt = image.dataset.originalAlt || (record.breed?.name ? `${record.breed.name} cat` : "Cat image");
  };

  card.addEventListener("mouseenter", activateHoverSwap);
  card.addEventListener("mouseleave", deactivateHoverSwap);

  image.addEventListener("error", () => {
    if (image.dataset.hoverActive === "1") {
      deactivateHoverSwap();
    }
  });

  title.textContent = record.name;
  rarityBadge.textContent = record.rarity.label;
  rarityBadge.classList.add(record.rarity.cssClass);
  description.textContent = record.breed?.description || pickFallbackDescription(record.cat, record.index);
  fortune.textContent = `Daily Fortune: ${pickDailyFortune(record.cat, record.index)}`;
  meta.innerHTML = createMetaList(record.profile);

  if (record.rarity.label === "Common") {
    card.classList.add("card-common");
  }
  if (record.rarity.label === "Epic") {
    card.classList.add("card-epic");
  }
  if (record.rarity.label === "Mythic") {
    card.classList.add("card-mythic");
  }
  if (record.rarity.label === "Cosmic Loaf") {
    card.classList.add("card-cosmic");
  }
  if (record.rarity.label === "Unknown") {
    card.classList.add("card-unknown");
  }

  card.style.animationDelay = `${Math.min(record.index * 70, 500)}ms`;
  passportBtn.addEventListener("click", () => openPassport(record));

  return clone;
}

function calculateDuelStats(record) {
  const t = (record.profile.temperament || "").toLowerCase();
  const stats = { affection: 5, energy: 5, curiosity: 5, confidence: 5, chaos: 5 };

  const rules = [
    { key: "affection", match: /(friendly|gentle|social|affectionate)/, delta: 2 },
    { key: "energy", match: /(energetic|playful|bold|zoomies)/, delta: 2 },
    { key: "curiosity", match: /(curious|investigating|clever|observant)/, delta: 2 },
    { key: "confidence", match: /(confident|dignified|independent|talkative)/, delta: 2 },
    { key: "chaos", match: /(mischievous|dramatic|goofy)/, delta: 2 }
  ];

  rules.forEach((rule) => {
    if (rule.match.test(t)) {
      stats[rule.key] += rule.delta;
    }
  });

  const rarityBonus = { Common: 0, Epic: 1, Mythic: 2, "Cosmic Loaf": 3 };
  stats.confidence += rarityBonus[record.rarity.label] || 0;
  stats.chaos += record.seed % 2;

  return Object.values(stats).reduce((sum, v) => sum + v, 0);
}

function populateDuelOptions(records) {
  const markup = records
    .map((record) => `<option value="${record.id}">${record.name} (${record.rarity.label})</option>`)
    .join("");

  duelCatA.innerHTML = markup;
  duelCatB.innerHTML = markup;

  if (records.length > 1) {
    duelCatA.value = records[0].id;
    duelCatB.value = records[1].id;
  }
}

function getCatBetValue(rarityLabel) {
  return CAT_BET_VALUES[rarityLabel] || 20;
}

function populatePokerCatBetSelect(records) {
  if (!pokerCatBetSelect) {
    return;
  }

  const visibleIds = new Set(
    Array.from(cardGrid.querySelectorAll(".cat-card[data-cat-id]"))
      .map((element) => element.dataset.catId)
      .filter(Boolean)
  );

  const visibleRecords = records.filter((record) => visibleIds.has(record.id));

  const options = visibleRecords
    .map((record) => {
      const value = getCatBetValue(record.rarity.label);
      return `<option value="${record.id}">${record.name} - ${record.rarity.label} (+${value})</option>`;
    })
    .join("");

  pokerCatBetSelect.innerHTML = options;
}

function clearPokerCatBetSelect() {
  if (pokerCatBetSelect) {
    pokerCatBetSelect.innerHTML = "";
  }
  if (pokerCatBetInfo) {
    pokerCatBetInfo.textContent = "None";
  }
}

function runPersonalityDuel() {
  const firstId = duelCatA.value;
  const secondId = duelCatB.value;

  if (!firstId || !secondId) {
    duelResult.textContent = "Load cats first, then pick two contenders.";
    return;
  }

  if (firstId === secondId) {
    duelResult.textContent = "Pick two different cats for a proper duel.";
    return;
  }

  const first = currentCatRecords.find((r) => r.id === firstId);
  const second = currentCatRecords.find((r) => r.id === secondId);

  if (!first || !second) {
    duelResult.textContent = "One contender is missing. Reload cats and try again.";
    return;
  }

  const firstScore = calculateDuelStats(first);
  const secondScore = calculateDuelStats(second);

  if (firstScore === secondScore) {
    duelResult.textContent = `${first.name} and ${second.name} are evenly matched. The crowd wants a rematch.`;
    return;
  }

  const winner = firstScore > secondScore ? first : second;
  const loser = winner.id === first.id ? second : first;
  duelResult.textContent = `${winner.name} defeats ${loser.name} in this temperament showdown.`;
}

async function getCatsFromLocalApi(limit) {
  const response = await fetch(`/api/cats?limit=${limit}`, { cache: "no-store" });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.detail ? ` ${payload.detail}` : "";
    } catch (_error) {
      // Keep fallback text.
    }
    throw new Error(`The cat service is currently unavailable.${detail}`.trim());
  }

  return response.json();
}

async function getCatsFromExternalApi(limit) {
  const response = await fetch(`https://api.thecatapi.com/v1/images/search?limit=${limit}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`External fallback failed with HTTP ${response.status}.`);
  }

  return response.json();
}

async function loadCats(limit) {
  const attempts = [
    () => getCatsFromLocalApi(limit),
    async () => {
      await wait(450);
      return getCatsFromLocalApi(limit);
    },
    () => getCatsFromExternalApi(limit)
  ];

  let lastError;

  for (const attempt of attempts) {
    try {
      const cats = await attempt();
      if (Array.isArray(cats) && cats.length > 0) {
        return cats.slice(0, limit);
      }
      lastError = new Error("No cats were returned by the API.");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to load cats.");
}

async function fetchCats() {
  statusElement.textContent = "Loading cats...";
  refreshBtn.disabled = true;
  cardGrid.innerHTML = "";
  clearPokerCatBetSelect();

  try {
    const cats = await loadCats(CARD_LIMIT);

    if (!Array.isArray(cats) || cats.length === 0) {
      statusElement.textContent = "No cats found right now. Please try again.";
      return;
    }

    currentCatRecords = cats.map((cat, index) => buildCatRecord(cat, index));
    populateDuelOptions(currentCatRecords);

    currentCatRecords.forEach((record) => {
      cardGrid.appendChild(buildCard(record));
    });

    populatePokerCatBetSelect(currentCatRecords);

    statusElement.textContent = `Showing ${cats.length} cats.`;
  } catch (error) {
    if (error.message === "Failed to fetch") {
      statusElement.textContent =
        "Cannot reach the local server. Start it with 'node server.js' (or 'npm.cmd start') and refresh.";
    } else {
      statusElement.textContent = error.message || "Failed to load cats.";
    }
  } finally {
    refreshBtn.disabled = false;
  }
}

function savePokerBankroll() {
  localStorage.setItem("cat-poker-bankroll", String(pokerBankroll));
}

function loadPokerBankroll() {
  const raw = localStorage.getItem("cat-poker-bankroll");
  const parsed = Number.parseInt(raw || String(POKER_START_BANKROLL), 10);
  pokerBankroll = Number.isFinite(parsed) && parsed >= 0 ? parsed : POKER_START_BANKROLL;
}

function saveRiggedMode() {
  localStorage.setItem("cat-poker-rigged", pokerRiggedMode ? "1" : "0");
}

function loadRiggedMode() {
  pokerRiggedMode = localStorage.getItem("cat-poker-rigged") === "1";
}

function refreshRiggedButtonUi() {
  if (!pokerRiggedBtn) {
    return;
  }

  pokerRiggedBtn.textContent = pokerRiggedMode ? "Rigged Game: ON" : "Rigged Game: OFF";
  pokerRiggedBtn.classList.toggle("is-on", pokerRiggedMode);
}

function toggleRiggedMode() {
  pokerRiggedMode = !pokerRiggedMode;
  saveRiggedMode();
  refreshRiggedButtonUi();

  if (pokerStatus) {
    pokerStatus.textContent = pokerRiggedMode
      ? "Rigged mode enabled: dealer has a higher chance to steal close wins."
      : "Rigged mode disabled: normal fair odds restored.";
  }
}

function clampPokerBet(value) {
  if (pokerBankroll <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(value, pokerBankroll));
}

function refreshPokerBankUi() {
  if (!pokerBank || !pokerBet) {
    return;
  }

  pokerBank.textContent = String(pokerBankroll);
  pokerBet.textContent = String(pokerCurrentBet);

  const disabled = pokerBankroll <= 0;
  if (pokerDealBtn) pokerDealBtn.disabled = disabled;
  if (pokerNewBtn) pokerNewBtn.disabled = disabled;
  if (pokerBetMinus) pokerBetMinus.disabled = disabled;
  if (pokerBetPlus) pokerBetPlus.disabled = disabled;
  if (pokerAllInBtn) pokerAllInBtn.disabled = disabled;

  if (pokerCatBetSelect) {
    pokerCatBetSelect.disabled = disabled || currentCatRecords.length === 0;
  }
}

function updatePokerBet(nextBet) {
  pokerCurrentBet = clampPokerBet(nextBet);
  refreshPokerBankUi();
}

function resetBankrollForNewGame() {
  pokerBankroll = POKER_START_BANKROLL;
  pokerCurrentBet = 10;
  pokerState = { phase: "ready", round: 1, playerHole: [], dealerHole: [], community: [] };
  savePokerBankroll();
  refreshPokerBankUi();
  renderPoker();
}

function autoRestartWhenGameOver(lastResultText = "") {
  if (pokerBankroll > 0) {
    return;
  }

  resetBankrollForNewGame();
  if (pokerStatus) {
    const prefix = lastResultText ? `${lastResultText} ` : "";
    pokerStatus.textContent = `${prefix}Bankroll hit 0, so a new game started with 100 chips.`;
  }
}

function createDeck() {
  const suits = ["S", "H", "D", "C"];
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck = [];

  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({ suit, rank });
    });
  });

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function drawCard(deck) {
  return deck.pop();
}

function rankLabel(rank) {
  if (rank <= 10) return String(rank);
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return "A";
}

function suitLabel(suit) {
  return { S: "♠", H: "♥", D: "♦", C: "♣" }[suit];
}

function cardText(card) {
  return `${rankLabel(card.rank)}${suitLabel(card.suit)}`;
}

function evaluateHand(hand) {
  const ranks = hand.map((c) => c.rank).sort((a, b) => a - b);
  const counts = {};
  ranks.forEach((rank) => {
    counts[rank] = (counts[rank] || 0) + 1;
  });

  const groups = Object.entries(counts)
    .map(([rank, count]) => ({ rank: Number(rank), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = hand.every((c) => c.suit === hand[0].suit);
  let isStraight = ranks.every((rank, i) => i === 0 || rank === ranks[i - 1] + 1);
  let straightHigh = ranks[ranks.length - 1];

  if (!isStraight && JSON.stringify(ranks) === JSON.stringify([2, 3, 4, 5, 14])) {
    isStraight = true;
    straightHigh = 5;
  }

  if (isFlush && isStraight && straightHigh === 14) return { score: 9, label: "Royal Flush", tiebreak: [14] };
  if (isFlush && isStraight) return { score: 8, label: "Straight Flush", tiebreak: [straightHigh] };
  if (groups[0].count === 4) return { score: 7, label: "Four of a Kind", tiebreak: [groups[0].rank, groups[1].rank] };
  if (groups[0].count === 3 && groups[1].count === 2) return { score: 6, label: "Full House", tiebreak: [groups[0].rank, groups[1].rank] };
  if (isFlush) return { score: 5, label: "Flush", tiebreak: [...ranks].reverse() };
  if (isStraight) return { score: 4, label: "Straight", tiebreak: [straightHigh] };

  if (groups[0].count === 3) {
    const kickers = groups.filter((g) => g.count === 1).map((g) => g.rank).sort((a, b) => b - a);
    return { score: 3, label: "Three of a Kind", tiebreak: [groups[0].rank, ...kickers] };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = groups.filter((g) => g.count === 2).map((g) => g.rank).sort((a, b) => b - a);
    const kicker = groups.find((g) => g.count === 1).rank;
    return { score: 2, label: "Two Pair", tiebreak: [...pairs, kicker] };
  }

  if (groups[0].count === 2) {
    const kickers = groups.filter((g) => g.count === 1).map((g) => g.rank).sort((a, b) => b - a);
    return { score: 1, label: "Pair", tiebreak: [groups[0].rank, ...kickers] };
  }

  return { score: 0, label: "High Card", tiebreak: [...ranks].reverse() };
}

function compareEvaluations(a, b) {
  if (a.score !== b.score) {
    return a.score - b.score;
  }

  const size = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < size; i += 1) {
    const av = a.tiebreak[i] || 0;
    const bv = b.tiebreak[i] || 0;
    if (av !== bv) {
      return av - bv;
    }
  }

  return 0;
}

function combinationsOfFive(cards) {
  const combos = [];
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }
  return combos;
}

function evaluateBestHand(cards) {
  const combos = combinationsOfFive(cards);
  if (combos.length === 0) {
    return { score: 0, label: "High Card", tiebreak: [0] };
  }

  let best = evaluateHand(combos[0]);
  for (let i = 1; i < combos.length; i += 1) {
    const next = evaluateHand(combos[i]);
    if (compareEvaluations(next, best) > 0) {
      best = next;
    }
  }
  return best;
}

function maybeRigDealerHand(playerEval, dealerEval) {
  if (!pokerRiggedMode) {
    return { dealerEval, rigApplied: false };
  }

  if (compareEvaluations(playerEval, dealerEval) <= 0) {
    return { dealerEval, rigApplied: false };
  }

  if (Math.random() >= POKER_RIGGED_EDGE_CHANCE) {
    return { dealerEval, rigApplied: false };
  }

  const remainingCards = Array.isArray(pokerState?.deck) ? [...pokerState.deck] : [];
  if (remainingCards.length === 0 || !pokerState?.dealerHole || pokerState.dealerHole.length < 2) {
    return { dealerEval, rigApplied: false };
  }

  const dealerBase = [...pokerState.dealerHole];
  let bestEval = dealerEval;
  let bestHole = dealerBase;
  let improved = false;

  for (let slot = 0; slot < 2; slot += 1) {
    for (const candidate of remainingCards) {
      const trialHole = [...dealerBase];
      trialHole[slot] = candidate;
      const trialEval = evaluateBestHand([...trialHole, ...pokerState.community]);
      if (compareEvaluations(trialEval, bestEval) > 0) {
        bestEval = trialEval;
        bestHole = trialHole;
        improved = true;
      }
    }
  }

  if (!improved) {
    return { dealerEval, rigApplied: false };
  }

  if (compareEvaluations(playerEval, bestEval) <= 0) {
    pokerState.dealerHole = bestHole;
    return { dealerEval: bestEval, rigApplied: true };
  }

  return { dealerEval, rigApplied: false };
}

function renderHand(element, cards, { hide = false, slotCount = cards.length } = {}) {
  element.innerHTML = "";

  for (let i = 0; i < slotCount; i += 1) {
    const card = cards[i];
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "poker-card-slot";

    if (!card) {
      slot.textContent = "-";
      slot.disabled = true;
    } else if (hide) {
      slot.classList.add("back");
      slot.textContent = "?";
      slot.disabled = true;
    } else {
      slot.textContent = cardText(card);
      slot.disabled = true;
    }

    element.appendChild(slot);
  }
}

function getDealerOpenBet(roundNumber, raisePressure = 0) {
  const multiplier = [0.9, 1.1, 1.35][roundNumber - 1] || 1;
  const candidate = Math.max(5, Math.floor(pokerCurrentBet * multiplier) + raisePressure);
  return Math.min(candidate, pokerBankroll);
}

function dealerCallsRaise() {
  const dealerCards = [...pokerState.dealerHole, ...pokerState.community];

  if (dealerCards.length < 5) {
    const holeRanks = pokerState.dealerHole.map((c) => c.rank).sort((a, b) => b - a);
    const isPair = holeRanks[0] === holeRanks[1];
    if (isPair) {
      return true;
    }
    return holeRanks[0] >= 11 || Math.random() < 0.45;
  }

  const evalResult = evaluateBestHand(dealerCards);
  if (evalResult.score >= 2) return true;
  if (evalResult.score === 1) return Math.random() < 0.7;
  return Math.random() < 0.4;
}

function advanceCommunity(roundNumber) {
  if (roundNumber === 2) {
    pokerState.community.push(drawCard(pokerState.deck), drawCard(pokerState.deck), drawCard(pokerState.deck));
  } else if (roundNumber === 3) {
    pokerState.community.push(drawCard(pokerState.deck), drawCard(pokerState.deck));
  }
}

function revealAllCommunityCards() {
  while (pokerState.community.length < 5) {
    pokerState.community.push(drawCard(pokerState.deck));
  }
}

function triggerAllInShowdown() {
  revealAllCommunityCards();
  pokerState.phase = "finished";
  pokerStatus.textContent = "All-in called. Revealing all cards for immediate showdown.";
  showdown();
}

function finalizeRoundStatus(text) {
  pokerState.phase = "finished";
  pokerStatus.textContent = text;
  savePokerBankroll();
  pokerCurrentBet = clampPokerBet(pokerCurrentBet);
  refreshPokerBankUi();
  renderPoker();
  autoRestartWhenGameOver(text);
}

function updateCatBetInfoText() {
  if (!pokerCatBetInfo) {
    return;
  }

  if (!pokerState || !pokerState.catBet) {
    pokerCatBetInfo.textContent = "None";
    return;
  }

  const { name, rarity, amount } = pokerState.catBet;
  pokerCatBetInfo.textContent = `${name} (${rarity}) +${amount}`;
}

function showdown() {
  const playerEval = evaluateBestHand([...pokerState.playerHole, ...pokerState.community]);
  let dealerEval = evaluateBestHand([...pokerState.dealerHole, ...pokerState.community]);
  const rigResult = maybeRigDealerHand(playerEval, dealerEval);
  dealerEval = rigResult.dealerEval;
  const result = compareEvaluations(playerEval, dealerEval);
  const stake = pokerState.stake;
  const rigNote = rigResult.rigApplied ? " House edge activated." : "";

  playerRank.textContent = `Your best hand: ${playerEval.label}`;
  dealerRank.textContent = `Dealer best hand: ${dealerEval.label}`;

  if (result > 0) {
    pokerBankroll += stake * 2;
    finalizeRoundStatus(
      `You win: ${playerEval.label} beats dealer's ${dealerEval.label}. Payout: +${stake} chips net.${rigNote}`
    );
    return;
  }

  if (result < 0) {
    finalizeRoundStatus(
      `Dealer wins: ${dealerEval.label} beats your ${playerEval.label}. You lost ${stake} chips.${rigNote}`
    );
    return;
  }

  pokerBankroll += stake;
  finalizeRoundStatus(
    `Tie: both sides made ${playerEval.label}. Your full stake was returned.${rigNote}`
  );
}

function moveToNextBettingRound() {
  if (pokerState.round >= 3) {
    showdown();
    return;
  }

  pokerState.round += 1;
  advanceCommunity(pokerState.round);
  pokerState.actionAmount = getDealerOpenBet(pokerState.round, pokerState.raisePressure || 0);
  pokerState.phase = "await-action";
  playerRank.textContent = "";
  dealerRank.textContent = "Dealer hole cards remain hidden.";
  pokerStatus.textContent =
    `Round ${pokerState.round}: Dealer opens ${pokerState.actionAmount} chips. Choose Check, Raise, or Fold.`;
  renderPoker();
}

function renderPoker() {
  if (!pokerState || !dealerHandElement || !playerHandElement || !communityHandElement || !pokerRound) {
    return;
  }

  renderHand(dealerHandElement, pokerState.dealerHole, {
    hide: pokerState.phase !== "finished",
    slotCount: 2
  });

  renderHand(playerHandElement, pokerState.playerHole, {
    slotCount: 2
  });

  renderHand(communityHandElement, pokerState.community, {
    slotCount: 5
  });

  pokerRound.textContent = `Round ${Math.min(pokerState.round || 1, 3)} of 3`;

  if (pokerState.phase === "ready") {
    dealerRank.textContent = "";
    playerRank.textContent = "";
    pokerRound.textContent = "Round 1 of 3";
    pokerStatus.textContent = `Press Deal to start a round. Current bet: ${pokerCurrentBet} chips.`;
  }

  updateCatBetInfoText();

  const awaitingAction = pokerState.phase === "await-action";
  const actionAmount = pokerState.actionAmount || 0;
  pokerCheckBtn.disabled = !(awaitingAction && pokerBankroll >= actionAmount);
  pokerRaiseBtn.disabled = !(awaitingAction && pokerBankroll >= actionAmount + pokerCurrentBet);
  pokerFoldBtn.disabled = !awaitingAction;
}

function startPokerRound() {
  if (pokerBankroll <= 0) {
    pokerStatus.textContent = "No chips left. Reload the page to reset bankroll.";
    return;
  }

  pokerCurrentBet = clampPokerBet(pokerCurrentBet);
  pokerBankroll -= pokerCurrentBet;
  savePokerBankroll();

  const deck = createDeck();
  pokerState = {
    deck,
    playerHole: [drawCard(deck), drawCard(deck)],
    dealerHole: [drawCard(deck), drawCard(deck)],
    community: [],
    phase: "await-action",
    round: 1,
    stake: pokerCurrentBet,
    actionAmount: getDealerOpenBet(1, 0),
    raisePressure: 0,
    catBet: null
  };

  dealerRank.textContent = "Dealer hole cards are hidden.";
  playerRank.textContent = "Waiting for your action.";
  pokerStatus.textContent = `Dealer opens with ${pokerState.actionAmount} chips. Choose Check, Raise, or Fold.`;
  refreshPokerBankUi();
  if (pokerBankroll === 0) {
    triggerAllInShowdown();
    return;
  }

  renderPoker();
}

function pokerCheck() {
  if (!pokerState || pokerState.phase !== "await-action") {
    return;
  }

  const amount = pokerState.actionAmount || 0;
  if (pokerBankroll < amount) {
    pokerStatus.textContent = "Not enough chips to check this bet.";
    return;
  }

  pokerBankroll -= amount;
  pokerState.stake += amount;
  savePokerBankroll();
  refreshPokerBankUi();
  pokerStatus.textContent = `You checked for ${amount} chips.`;
  moveToNextBettingRound();
}

function pokerRaise() {
  if (!pokerState || pokerState.phase !== "await-action") {
    return;
  }

  const callAmount = pokerState.actionAmount || 0;
  const raiseAmount = pokerCurrentBet;
  const total = callAmount + raiseAmount;
  const isAllInRaise = pokerBankroll === total;

  if (pokerBankroll < total) {
    pokerStatus.textContent = "Not enough chips to raise.";
    return;
  }

  pokerBankroll -= total;
  pokerState.stake += total;
  savePokerBankroll();

  if (isAllInRaise) {
    triggerAllInShowdown();
    return;
  }

  if (!dealerCallsRaise()) {
    playerRank.textContent = "Your hand: Raise pressure";
    dealerRank.textContent = "Dealer hand: Folded";
    pokerBankroll += pokerState.stake * 2;
    finalizeRoundStatus(
      `You win because dealer folded to your raise. Net gain: +${pokerState.stake} chips.`
    );
    return;
  }

  pokerState.raisePressure = (pokerState.raisePressure || 0) + raiseAmount;
  pokerStatus.textContent =
    `Dealer called your raise of ${raiseAmount}. Future rounds will have higher dealer opens.`;
  refreshPokerBankUi();
  moveToNextBettingRound();
}

function pokerFold() {
  if (!pokerState || pokerState.phase !== "await-action") {
    return;
  }

  dealerRank.textContent = "Dealer hand: Win by fold";
  playerRank.textContent = "Your hand: Folded";
  finalizeRoundStatus(`Dealer wins because you folded. You lost ${pokerState.stake} chips.`);
}

function addCatCardBet() {
  if (!pokerState || pokerState.phase !== "await-action") {
    return;
  }

  if (pokerState.catBet) {
    return;
  }

  const selectedId = pokerCatBetSelect?.value;
  if (!selectedId) {
    pokerStatus.textContent = "Select a cat card first.";
    return;
  }

  const record = currentCatRecords.find((cat) => cat.id === selectedId);
  if (!record) {
    pokerStatus.textContent = "Selected cat card is unavailable.";
    return;
  }

  const amount = getCatBetValue(record.rarity.label);
  if (pokerBankroll < amount) {
    pokerStatus.textContent = `Not enough chips for ${record.rarity.label} cat bet (+${amount}).`;
    return;
  }

  pokerBankroll -= amount;
  pokerState.stake += amount;
  pokerState.catBet = {
    id: record.id,
    name: record.name,
    rarity: record.rarity.label,
    amount
  };

  savePokerBankroll();
  refreshPokerBankUi();
  updateCatBetInfoText();
  pokerStatus.textContent =
    `Cat card bet added: ${record.name} (${record.rarity.label}) +${amount} chips. Total stake now ${pokerState.stake}.`;

  if (pokerBankroll === 0) {
    triggerAllInShowdown();
    return;
  }

  renderPoker();
}

function onCatBetSelectionChange() {
  const selectedId = pokerCatBetSelect?.value;
  if (!selectedId) {
    return;
  }

  const record = currentCatRecords.find((cat) => cat.id === selectedId);
  if (!record) {
    return;
  }

  const amount = getCatBetValue(record.rarity.label);

  if (pokerState?.catBet && pokerState.catBet.id === selectedId) {
    return;
  }

  if (pokerState && pokerState.phase === "await-action" && !pokerState.catBet) {
    addCatCardBet();
    return;
  }

  if (pokerCatBetInfo && (!pokerState || !pokerState.catBet)) {
    pokerCatBetInfo.textContent = `${record.name} (${record.rarity.label}) +${amount} selected`;
  }

  if (pokerStatus) {
    pokerStatus.textContent =
      `Selected cat card bet: ${record.name} (${record.rarity.label}) +${amount}. It will apply when a round is waiting for action.`;
  }
}

function openPoker() {
  if (!pokerState) {
    pokerState = { phase: "ready", round: 1, playerHole: [], dealerHole: [], community: [] };
  }

  pokerModal.classList.add("open");
  pokerModal.setAttribute("aria-hidden", "false");
  pokerCurrentBet = clampPokerBet(pokerCurrentBet);
  refreshPokerBankUi();
  renderPoker();
}

function closePoker() {
  pokerModal.classList.remove("open");
  pokerModal.setAttribute("aria-hidden", "true");
  resetBankrollForNewGame();
}

refreshBtn?.addEventListener("click", fetchCats);
themeToggleBtn?.addEventListener("click", toggleTheme);

duelBtn?.addEventListener("click", runPersonalityDuel);

passportClose?.addEventListener("click", closePassport);
passportModal?.addEventListener("click", (event) => {
  if (event.target === passportModal) {
    closePassport();
  }
});

pokerOpenBtn?.addEventListener("click", openPoker);
pokerClose?.addEventListener("click", closePoker);
pokerDealBtn?.addEventListener("click", startPokerRound);
pokerCheckBtn?.addEventListener("click", pokerCheck);
pokerRaiseBtn?.addEventListener("click", pokerRaise);
pokerFoldBtn?.addEventListener("click", pokerFold);
pokerNewBtn?.addEventListener("click", startPokerRound);
pokerCatBetSelect?.addEventListener("change", onCatBetSelectionChange);
pokerBetMinus?.addEventListener("click", () => updatePokerBet(pokerCurrentBet - 5));
pokerBetPlus?.addEventListener("click", () => updatePokerBet(pokerCurrentBet + 5));
pokerAllInBtn?.addEventListener("click", () => updatePokerBet(pokerBankroll));
pokerRiggedBtn?.addEventListener("click", toggleRiggedMode);
pokerModal?.addEventListener("click", (event) => {
  if (event.target === pokerModal) {
    closePoker();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  loadPokerBankroll();
  loadRiggedMode();
  refreshRiggedButtonUi();
  pokerCurrentBet = clampPokerBet(pokerCurrentBet || 10);
  refreshPokerBankUi();
  if (!pokerState) {
    pokerState = { phase: "ready", round: 1, playerHole: [], dealerHole: [], community: [] };
  }
  renderPoker();
  fetchCats();
});
