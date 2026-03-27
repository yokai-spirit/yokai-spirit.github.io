let dataCache = null;
let favorites = JSON.parse(localStorage.getItem('sw-favorites') || '{}');
let currentCategory = 'all';
let currentSearch = '';

async function fetchData() {
  document.getElementById('spinner').style.display = 'block';
  // Try remote API first
  let data;
  try {
    const res = await fetch('https://starwars-databank.vercel.app/api/all');
    if (!res.ok) throw new Error('API fetch failed');
    data = await res.json();
  } catch (e) {
    // Fallback to local JSON if API fails
    const res = await fetch('starwars-sample.json');
    if (!res.ok) throw new Error('Failed to fetch data');
    data = await res.json();
  }
  document.getElementById('spinner').style.display = 'none';
  return data;
}

function createCard(item, category, favorites) {
  const isFav = favorites && favorites[category] && favorites[category][item.name];
  // Try akabab/starwars-api CDN first
  let imgSrc = '';
  if (item.name) {
    // Format name for akabab API (spaces to hyphens, lowercase, remove special chars)
    const apiName = item.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-');
    imgSrc = `https://akabab.github.io/starwars-api/api/all.json`;
    // But akabab provides a direct image link, so try to use their pattern
    // e.g. https://akabab.github.io/starwars-api/api/id/1.json (has .image field)
    // We'll use a static mapping for main characters for now
    const akababImages = {
      'luke skywalker': 'https://akabab.github.io/starwars-api/api/images/original/1.jpg',
      'darth vader': 'https://akabab.github.io/starwars-api/api/images/original/4.jpg',
      'leia organa': 'https://akabab.github.io/starwars-api/api/images/original/5.jpg',
      'han solo': 'https://akabab.github.io/starwars-api/api/images/original/14.jpg',
      'obi-wan kenobi': 'https://akabab.github.io/starwars-api/api/images/original/10.jpg',
      'yoda': 'https://akabab.github.io/starwars-api/api/images/original/20.jpg',
      'emperor palpatine': 'https://akabab.github.io/starwars-api/api/images/original/21.jpg',
      'chewbacca': 'https://akabab.github.io/starwars-api/api/images/original/13.jpg',
      'r2-d2': 'https://akabab.github.io/starwars-api/api/images/original/3.jpg',
      'c-3po': 'https://akabab.github.io/starwars-api/api/images/original/2.jpg',
      'bb-8': 'https://akabab.github.io/starwars-api/api/images/original/87.jpg',
      'k-2so': 'https://akabab.github.io/starwars-api/api/images/original/76.jpg',
      'ig-88': 'https://akabab.github.io/starwars-api/api/images/original/77.jpg'
    };
    if (akababImages[item.name.toLowerCase()]) {
      imgSrc = akababImages[item.name.toLowerCase()];
    } else if (item.image) {
      imgSrc = item.image;
    } else {
      // Wikimedia Commons fallback (example: R2-D2)
      const commonsImages = {
        'r2-d2': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/R2-D2_Droid.png',
        'darth vader': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Darth_Vader_2011.jpg',
        'chewbacca': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Chewbacca_Fan_Expo_2015.jpg',
        'yoda': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Yoda_SWSB.png'
      };
      imgSrc = commonsImages[item.name.toLowerCase()] || 'https://placehold.co/220x180/23272a/ffe81f?text=No+Image';
    }
  } else {
    imgSrc = 'https://placehold.co/220x180/23272a/ffe81f?text=No+Image';
  }
  const imgHtml = `<img class="card-img" src="${imgSrc}" alt="${item.name}" onerror="this.onerror=null;this.src='https://placehold.co/220x180/23272a/ffe81f?text=No+Image';" />`;
  return `
    <div class="card">
      ${imgHtml}
      <div class="card-info">
        <h3>${item.name}
          <button class="favorite${isFav ? ' active' : ''}" data-name="${encodeURIComponent(item.name)}" data-category="${encodeURIComponent(category)}" title="Favorite">★</button>
        </h3>
        <p>${item.description || ''}</p>
        <button class="info-btn" data-name="${encodeURIComponent(item.name)}" data-category="${encodeURIComponent(category)}">Info</button>
      </div>
    </div>
  `;
}

function renderCategories(data) {
  const categoriesDiv = document.getElementById('categories');
  categoriesDiv.innerHTML = '';
  let filtered = {};
  Object.entries(data).forEach(([category, items]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    if (currentCategory !== 'all' && category !== currentCategory) return;
    filtered[category] = items.filter(item =>
      item.name.toLowerCase().includes(currentSearch)
    );
    if (filtered[category].length === 0) return;
    const cards = filtered[category].map(item => createCard(item, category, favorites)).join('');
    const section = document.createElement('section');
    section.className = 'category';
    section.innerHTML = `
      <div class="category-title">${category}</div>
      <div class="cards">${cards}</div>
    `;
    categoriesDiv.appendChild(section);
  });
  // Add event listeners for info buttons
  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = decodeURIComponent(btn.getAttribute('data-name'));
      const category = decodeURIComponent(btn.getAttribute('data-category'));
      showInfoModal(name, category);
    });
  });
  // Add event listeners for favorite buttons
  document.querySelectorAll('.favorite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = decodeURIComponent(btn.getAttribute('data-name'));
      const category = decodeURIComponent(btn.getAttribute('data-category'));
      if (!favorites[category]) favorites[category] = {};
      favorites[category][name] = !favorites[category][name];
      if (!favorites[category][name]) delete favorites[category][name];
      localStorage.setItem('sw-favorites', JSON.stringify(favorites));
      renderCategories(dataCache);
    });
  });
}
// Fun facts/statistics for demo (expand as needed)
const funFacts = {
  droids: {
    'R2-D2': 'Fun Fact: R2-D2 never had his memory wiped and has saved the galaxy many times.',
    'C-3PO': 'Fun Fact: C-3PO is fluent in over six million forms of communication.',
    'BB-8': 'Fun Fact: BB-8 is known for his loyalty and rolling design.',
    'K-2SO': 'Fun Fact: K-2SO was reprogrammed by Cassian Andor and has a sarcastic personality.',
    'IG-88': 'Fun Fact: IG-88 is one of the galaxy’s most feared assassin droids.'
  },
  characters: {
    'Luke Skywalker': 'Fun Fact: Luke is one of the only Jedi to redeem a Sith (his father, Anakin).',
    'Darth Vader': 'Fun Fact: Darth Vader’s suit is a life-support system and a weapon.',
    'Leia Organa': 'Fun Fact: Leia is Force-sensitive and trained as a Jedi in the sequels.',
    'Han Solo': 'Fun Fact: Han shot first! (in the original cut)',
    'Obi-Wan Kenobi': 'Fun Fact: Obi-Wan defeated both Darth Maul and Anakin Skywalker.',
    'Yoda': 'Fun Fact: Yoda is over 900 years old.',
    'Emperor Palpatine': 'Fun Fact: Palpatine manipulated both sides of the Clone Wars.',
    'Chewbacca': 'Fun Fact: Chewbacca is over 200 years old.'
  },
  planets: {
    'Tatooine': 'Fun Fact: Tatooine has two suns.',
    'Alderaan': 'Fun Fact: Alderaan was destroyed by the Death Star.',
    'Hoth': 'Fun Fact: Hoth is home to the wampa and tauntaun.',
    'Endor': 'Fun Fact: Ewoks live on Endor’s forest moon.',
    'Naboo': 'Fun Fact: Naboo has a core of water and plasma.',
    'Coruscant': 'Fun Fact: Coruscant is a city-covered planet.',
    'Dagobah': 'Fun Fact: Yoda lived in exile on Dagobah.',
    'Mustafar': 'Fun Fact: Mustafar is a volcanic planet.',
    'Jakku': 'Fun Fact: Rey grew up on Jakku.',
    'Kamino': 'Fun Fact: Kaminoans are expert cloners.'
  },
  starships: {
    'Millennium Falcon': 'Fun Fact: The Falcon made the Kessel Run in less than 12 parsecs.',
    'X-wing': 'Fun Fact: X-wings are the main starfighter of the Rebel Alliance.',
    'TIE Fighter': 'Fun Fact: TIE stands for Twin Ion Engine.',
    'Star Destroyer': 'Fun Fact: Star Destroyers can carry thousands of troops.',
    'Slave I': 'Fun Fact: Slave I is Boba Fett’s ship.',
    'Imperial Shuttle': 'Fun Fact: Lambda-class shuttles are used for transport.',
    'A-wing': 'Fun Fact: A-wings are the fastest Rebel ships.',
    'B-wing': 'Fun Fact: B-wings are heavy assault fighters.',
    'Y-wing': 'Fun Fact: Y-wings are bombers.',
    'Executor': 'Fun Fact: The Executor is a Super Star Destroyer.'
  },
  creatures: {
    'Bantha': 'Fun Fact: Banthas are used as pack animals by Tusken Raiders.',
    'Tauntaun': 'Fun Fact: Tauntauns are native to Hoth.',
    'Rancor': 'Fun Fact: The Rancor was kept by Jabba the Hutt.',
    'Wampa': 'Fun Fact: Wampas are carnivores from Hoth.',
    'Sarlacc': 'Fun Fact: Victims are digested in the Sarlacc for over a thousand years.',
    'Dewback': 'Fun Fact: Dewbacks are used by stormtroopers on Tatooine.',
    'Porg': 'Fun Fact: Porgs are native to Ahch-To.',
    'Ewok': 'Fun Fact: Ewoks helped defeat the Empire on Endor.',
    'Womp Rat': 'Fun Fact: Womp rats are a common pest on Tatooine.',
    'Nexu': 'Fun Fact: Nexu are agile predators from Cholganna.'
  }
};

function showInfoModal(name, category) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const fact = (funFacts[category] && funFacts[category][name]) ? funFacts[category][name] : 'No fun fact available.';
  modalBody.innerHTML = `<h2>${name}</h2><p>${fact}</p>`;
  modal.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal');
  const closeModal = document.getElementById('close-modal');
  if (closeModal) {
    closeModal.onclick = () => { modal.style.display = 'none'; };
  }
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };



fetchData()
  .then(data => {
    dataCache = data;
    renderCategories(data);
    // Search bar
    document.getElementById('search-bar').addEventListener('input', e => {
      currentSearch = e.target.value.toLowerCase();
      renderCategories(dataCache);
    });
    // Category filter
    document.getElementById('category-filter').addEventListener('change', e => {
      currentCategory = e.target.value;
      renderCategories(dataCache);
    });
    // Dark/light mode
    const toggleBtn = document.getElementById('toggle-mode');
    let isLight = false;
    toggleBtn.addEventListener('click', () => {
      isLight = !isLight;
      document.body.classList.toggle('light', isLight);
      toggleBtn.textContent = isLight ? '☀️' : '🌙';
      toggleBtn.classList.toggle('light', isLight);
    });
  })
  .catch(err => {
    document.getElementById('categories').innerHTML = '<p>Failed to load data.</p>';
    document.getElementById('spinner').style.display = 'none';
    console.error(err);
  });
});

