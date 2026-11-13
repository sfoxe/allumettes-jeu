const TOTAL_MATCHES = 21;
const HISTORY_KEY = 'jeu-allumettes-historique';
const DIFFICULTIES = {
  easy: { label: 'Facile' },
  medium: { label: 'Moyen' },
  hard: { label: 'Difficile' }
};

const views = {
  home: document.querySelector('#home-view'),
  history: document.querySelector('#history-view')
};
const tabs = [...document.querySelectorAll('.tab')];
const setupCard = document.querySelector('#setup-card');
const gameCard = document.querySelector('#game-card');
const matchPile = document.querySelector('#match-pile');
const countLabel = document.querySelector('#remaining-count');
const turnMessage = document.querySelector('#turn-message');
const moveButtons = [...document.querySelectorAll('.move-button')];
const historyList = document.querySelector('#history-list');
const emptyHistory = document.querySelector('#empty-history');
const historySummary = document.querySelector('#history-summary');
const historyCount = document.querySelector('#history-count');
const clearHistoryButton = document.querySelector('#clear-history-button');
const storageMessage = document.querySelector('#storage-message');

let remaining = TOTAL_MATCHES;
let currentDifficulty = 'medium';
let gameActive = false;
let aiTimer;
let turnMessageTimer;
let history = loadHistory();

function loadHistory() {
  const saved = localStorage.getItem(HISTORY_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new TypeError('Le format de l’historique est invalide.');
    return parsed.filter((game) =>
      game &&
      (game.result === 'win' || game.result === 'loss') &&
      Object.hasOwn(DIFFICULTIES, game.difficulty) &&
      typeof game.date === 'string' &&
      Number.isFinite(Date.parse(game.date))
    );
  } catch (error) {
    console.error('Impossible de lire l’historique des parties.', error);
    storageMessage.hidden = false;
    storageMessage.textContent = 'L’historique enregistré est illisible. Il sera remplacé lors de la prochaine partie.';
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    storageMessage.hidden = true;
  } catch (error) {
    console.error('Impossible d’enregistrer l’historique des parties.', error);
    storageMessage.hidden = false;
    storageMessage.textContent = 'La partie est terminée, mais son résultat n’a pas pu être enregistré dans cet appareil.';
  }
}

function showView(name) {
  Object.entries(views).forEach(([viewName, element]) => {
    element.hidden = viewName !== name;
  });
  tabs.forEach((tab) => {
    const active = tab.dataset.view === name;
    tab.classList.toggle('is-active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
}

function renderPile() {
  countLabel.textContent = String(remaining);
  matchPile.setAttribute('aria-label', `${remaining} ${remaining === 1 ? 'allumette restante' : 'allumettes restantes'}`);
  matchPile.replaceChildren();

  for (let index = 0; index < remaining; index += 1) {
    const stick = document.createElement('span');
    stick.className = 'match-stick';
    stick.setAttribute('aria-hidden', 'true');
    matchPile.append(stick);
  }

  moveButtons.forEach((button) => {
    button.disabled = !gameActive || Number(button.dataset.take) > remaining;
  });
}

function renderHistory() {
  historyList.replaceChildren();
  historyCount.textContent = String(history.length);
  clearHistoryButton.hidden = history.length === 0;
  emptyHistory.hidden = history.length > 0;
  historySummary.textContent = history.length === 0
    ? 'Aucune partie jouée pour le moment.'
    : `${history.length} partie${history.length > 1 ? 's' : ''} jouée${history.length > 1 ? 's' : ''}`;

  history.forEach((game) => {
    const entry = document.createElement('article');
    entry.className = 'history-entry';

    const result = document.createElement('div');
    result.className = 'entry-result';
    const dot = document.createElement('span');
    dot.className = `result-dot${game.result === 'loss' ? ' loss' : ''}`;
    dot.setAttribute('aria-hidden', 'true');
    const resultText = document.createElement('span');
    resultText.textContent = game.result === 'win' ? 'Victoire' : 'Défaite';
    result.append(dot, resultText);

    const date = document.createElement('time');
    date.className = 'entry-date';
    date.dateTime = game.date;
    date.textContent = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(game.date));

    const difficulty = document.createElement('span');
    difficulty.className = 'entry-difficulty';
    difficulty.textContent = DIFFICULTIES[game.difficulty].label;
    entry.append(result, date, difficulty);
    historyList.append(entry);
  });
}

function startGame() {
  clearTimeout(aiTimer);
  clearTimeout(turnMessageTimer);
  currentDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
  remaining = TOTAL_MATCHES;
  gameActive = true;
  setupCard.hidden = true;
  gameCard.hidden = false;
  document.querySelector('#game-difficulty').textContent = DIFFICULTIES[currentDifficulty].label;
  turnMessage.classList.remove('is-result');
  turnMessage.textContent = 'Choisissez combien d’allumettes prendre.';
  renderPile();
}

function finishGame(result) {
  gameActive = false;
  clearTimeout(aiTimer);
  clearTimeout(turnMessageTimer);
  turnMessage.classList.add('is-result');
  turnMessage.textContent = result === 'win'
    ? 'L’ordinateur a pris la dernière allumette. Bravo, vous gagnez !'
    : 'Vous avez pris la dernière allumette. Vous perdez cette partie.';
  history.unshift({ result, difficulty: currentDifficulty, date: new Date().toISOString() });
  history = history.slice(0, 50);
  saveHistory();
  renderHistory();
  renderPile();
}

function returnToSetup() {
  clearTimeout(aiTimer);
  clearTimeout(turnMessageTimer);
  gameActive = false;
  remaining = TOTAL_MATCHES;
  setupCard.hidden = false;
  gameCard.hidden = true;
  turnMessage.classList.remove('is-result');
  turnMessage.textContent = 'Choisissez combien d’allumettes prendre.';
  renderPile();
  showView('home');
}

function chooseAiMove() {
  const maximum = Math.min(3, remaining);
  if (currentDifficulty === 'easy') {
    return Math.floor(Math.random() * maximum) + 1;
  }

  const remainder = (remaining - 1) % 4;
  const strategicMove = remainder === 0 ? 1 : remainder;
  if (currentDifficulty === 'hard') {
    return Math.min(strategicMove, maximum);
  }
  if (Math.random() < 0.65) return Math.min(strategicMove, maximum);
  return Math.floor(Math.random() * maximum) + 1;
}

function takeMatches(amount) {
  if (!gameActive || amount > remaining) return;

  remaining -= amount;
  turnMessage.classList.remove('is-result');
  turnMessage.textContent = `Vous prenez ${amount} ${amount === 1 ? 'allumette' : 'allumettes'}.`;
  renderPile();

  if (remaining === 0) {
    finishGame('loss');
    return;
  }

  gameActive = false;
  renderPile();
  turnMessage.textContent = 'L’ordinateur réfléchit…';
  aiTimer = window.setTimeout(() => {
    const aiMove = chooseAiMove();
    remaining -= aiMove;
    turnMessage.textContent = `L’ordinateur prend ${aiMove} ${aiMove === 1 ? 'allumette' : 'allumettes'}.`;
    renderPile();

    if (remaining === 0) {
      finishGame('win');
      return;
    }

    gameActive = true;
    renderPile();
    turnMessageTimer = window.setTimeout(() => {
      if (gameActive) turnMessage.textContent = 'À vous de jouer : combien en prenez-vous ?';
    }, 750);
  }, 650);
}

tabs.forEach((tab) => tab.addEventListener('click', () => {
  if (tab.dataset.view === 'home') returnToSetup();
  else showView(tab.dataset.view);
}));
document.querySelectorAll('[data-view="home"]:not(.tab)').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    returnToSetup();
  });
});
document.querySelector('#start-button').addEventListener('click', startGame);
document.querySelector('#new-game-button').addEventListener('click', returnToSetup);
moveButtons.forEach((button) => {
  button.addEventListener('click', () => takeMatches(Number(button.dataset.take)));
});
clearHistoryButton.addEventListener('click', () => {
  history = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Impossible d’effacer l’historique des parties.', error);
    storageMessage.hidden = false;
    storageMessage.textContent = 'L’historique n’a pas pu être effacé de cet appareil.';
  }
  renderHistory();
});

renderHistory();
