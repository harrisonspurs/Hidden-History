
const modeOptions = document.querySelectorAll(".mode-option");
const timeOptions = document.querySelectorAll(".time-option");
const homeScreen = document.querySelector("#home-screen");
const resultScreen = document.querySelector("#result-screen");
const storyScreen = document.querySelector("#story-screen");
const mysteryDestination = document.querySelector("#mystery-destination");
const destinationHint = document.querySelector("#destination-hint");
const walkTime = document.querySelector("#walk-time");
const walkDistance = document.querySelector("#walk-distance");
const storyButton = document.querySelector("#story-button");
const discoveryList = document.querySelector("#discovery-list");
const markDiscoveredButton = document.querySelector("#mark-discovered-button");
const simulateArrivalButton = document.querySelector("#simulate-arrival");

let selectedMinutes = 30;
let selectedMode = "walking";
let currentPlace = null;
let isStoryUnlocked = false;

const discoveryStorageKey = "hidden-history-discoveries";

const places = {
  walking: {
    15: [
      {
        name: "Castlefield Viaduct",
        description: "An old railway structure given a new lease of life as an elevated green space.",
        distance: "0.7 km",
        hint: "A quiet route through old industrial arches and a hidden green walkway.",
        story: "Castlefield Viaduct is a historic railway structure in Manchester. Its transformation into an elevated urban green space offers a new way to experience industrial heritage."
      },
      {
        name: "The Secret Garden of Chapel Street",
        description: "A tucked-away green courtyard that feels like a small urban escape.",
        distance: "0.9 km",
        hint: "A short route to a place hidden behind the city’s busiest streets.",
        story: "This small garden sits in the middle of a dense commercial area, reminding us how overlooked pockets of the city can hold surprising stories of care and reuse."
      }
    ],
    30: [
      {
        name: "Ordsall Hall",
        description: "A historic manor house with centuries of stories connected to Salford.",
        distance: "1.4 km",
        hint: "The path leads toward a grand old house with a story stretching back centuries.",
        story: "Ordsall Hall is a historic manor house in Salford, with parts dating back several centuries. It offers a glimpse into how people lived in the area in the past."
      },
      {
        name: "The Irwell Steps",
        description: "A route through the city’s industrial legacy and waterway history.",
        distance: "1.7 km",
        hint: "A riverside route with traces of the city’s old trade and movement.",
        story: "The Irwell has shaped the growth of Manchester and Salford for generations. This route traces how waterways once drove trade, industry and daily life."
      }
    ],
    60: [
      {
        name: "Peel Park",
        description: "A historic public park close to the River Irwell and the University of Salford.",
        distance: "2.2 km",
        hint: "A longer route through green space with strong ties to the city’s social history.",
        story: "Peel Park opened in 1846 and is widely recognised as one of the earliest public parks created in a major industrial town. It connects the city's social history with its green spaces."
      },
      {
        name: "The Old Road to Salford",
        description: "A historic lane carrying the story of movement, labour and neighbourhood change.",
        distance: "2.8 km",
        hint: "The route winds through streets that once carried people, trade and everyday life.",
        story: "This historic route reveals how local streets were shaped by workers, industry and migration. The journey tells the story of how everyday movement helped build the neighbourhood."
      }
    ],
    90: [
      {
        name: "The Manchester Line",
        description: "A longer route tracing the city’s industrial footprint and quieter corners.",
        distance: "3.8 km",
        hint: "A broad route for a deeper look at the city’s hidden industrial story.",
        story: "The Manchester Line reveals how transport, trade and labour shaped this city. Longer walks uncover the layered history tucked between major streets and rail corridors."
      },
      {
        name: "The Riverside Loop",
        description: "A wider route connecting old trade routes, green spaces and urban memory.",
        distance: "4.3 km",
        hint: "A longer journey through the city’s edges, water and forgotten landmarks.",
        story: "This route traces the relationship between the city and its river, showing how water once powered industry and shaped the neighbourhoods around it."
      }
    ]
  },
  cycling: {
    15: [
      {
        name: "The Old Goods Line",
        description: "A hidden route shaped by freight movement and city expansion.",
        distance: "1.6 km",
        hint: "A short but fast ride through a route once used for moving goods.",
        story: "This former goods route reveals how the city’s freight infrastructure shaped its edges, turning everyday movement into a story of trade and industry."
      },
      {
        name: "The Hidden Courtyard Loop",
        description: "A compact circuit that reveals the city’s quieter urban pockets.",
        distance: "1.9 km",
        hint: "The ride cuts through spaces that feel hidden from the main flow of the city.",
        story: "This loop takes you through small courtyards and overlooked streets, showing how urban life often thrives in the margins of bigger developments."
      }
    ],
    30: [
      {
        name: "The Deansgate Story",
        description: "A route through one of the city’s most important commercial streets.",
        distance: "3.4 km",
        hint: "A more energetic ride revealing how commerce and change shaped the city centre.",
        story: "Deansgate has long linked commerce, transport and urban ambition. This ride shows how a single street can hold the memory of multiple eras." 
      },
      {
        name: "The Canal Circuit",
        description: "A route through old canal edges and industrial transformation.",
        distance: "3.7 km",
        hint: "Follow the waterline and discover how industrial routes became part of daily life.",
        story: "Manchester’s canal network was once central to movement and trade. Today, the paths by the water offer evidence of the city’s industrial past and its reinvention."
      }
    ],
    60: [
      {
        name: "The Green Ring",
        description: "A longer cycle that links the city’s heritage parks and overlooked public spaces.",
        distance: "6.1 km",
        hint: "A big route through parks, bridges and the edges of old neighbourhoods.",
        story: "This green ring connects public spaces that once served very different purposes, from leisure to daily movement, revealing how city life grows around shared spaces."
      },
      {
        name: "The Industrial Arc",
        description: "A route tracing transport infrastructure and the city’s working history.",
        distance: "6.8 km",
        hint: "The ride follows the path of industry, movement and urban expansion.",
        story: "The Industrial Arc reveals how rail, road and labour shaped the city’s growth. It turns a ride into a layered exploration of work, power and urban change."
      }
    ],
    90: [
      {
        name: "The Greater Loop",
        description: "A longer cycle uncovering the wider city and its hidden historical edges.",
        distance: "9.5 km",
        hint: "A ride designed for discovery across the city’s broader story.",
        story: "This longer loop reveals how a city’s history spreads far beyond its centre. It brings together trade routes, parks and neighbourhoods to show how the urban story is layered and interconnected."
      },
      {
        name: "The River and Rail Route",
        description: "A deeper, wider journey through the city’s transport and water heritage.",
        distance: "10.4 km",
        hint: "Bigger distances uncover the hidden threads connecting water, rail and industry.",
        story: "The route traces the close relationship between the river and the railway, showing how they shaped settlement, labour and the everyday rhythm of city life."
      }
    ]
  }
};

function getRandomPlace() {
  const candidatePlaces = places[selectedMode][selectedMinutes] || places[selectedMode][30];
  const randomIndex = Math.floor(Math.random() * candidatePlaces.length);
  return candidatePlaces[randomIndex];
}

function updateDiscoveryMap() {
  const discoveredPlaces = JSON.parse(localStorage.getItem(discoveryStorageKey) || "[]");

  if (!discoveredPlaces.length) {
    discoveryList.innerHTML = '<li class="empty-state">No discoveries yet. Your first hidden story is waiting.</li>';
    return;
  }

  discoveryList.innerHTML = discoveredPlaces
    .map(place => `
      <li>
        <span class="dot"></span>
        <div>
          <strong>${place.name}</strong>
          <small>${place.mode} · ${place.minutes} min</small>
        </div>
      </li>
    `)
    .join("");
}

function markPlaceAsDiscovered() {
  const discoveredPlaces = JSON.parse(localStorage.getItem(discoveryStorageKey) || "[]");
  const placeAlreadySaved = discoveredPlaces.some(place => place.name === currentPlace.name);

  if (!placeAlreadySaved && currentPlace) {
    discoveredPlaces.push({
      name: currentPlace.name,
      mode: selectedMode,
      minutes: selectedMinutes
    });
    localStorage.setItem(discoveryStorageKey, JSON.stringify(discoveredPlaces));
  }

  updateDiscoveryMap();
}

function setSelectedMode(mode) {
  selectedMode = mode;
  modeOptions.forEach(option => {
    option.classList.toggle("selected", option.dataset.mode === mode);
  });
}

function setSelectedMinutes(minutes) {
  selectedMinutes = minutes;
  timeOptions.forEach(option => {
    option.classList.toggle("selected", Number(option.dataset.minutes) === minutes);
  });
}

function lockStoryButton() {
  isStoryUnlocked = false;
  storyButton.disabled = true;
  storyButton.textContent = "Story locked until arrival";
  storyButton.classList.add("locked");
}

function unlockStoryButton() {
  isStoryUnlocked = true;
  storyButton.disabled = false;
  storyButton.textContent = "Discover the story →";
  storyButton.classList.remove("locked");
}

function showMysteryScreen(place) {
  currentPlace = place;
  mysteryDestination.textContent = "Hidden destination";
  destinationHint.textContent = place.hint;
  walkTime.textContent = `◷ ${selectedMinutes} min`;
  walkDistance.textContent = `↗ ${place.distance}`;
  document.querySelector("#story-title").textContent = place.name;
  document.querySelector("#story-text").textContent = place.story;
  lockStoryButton();

  homeScreen.hidden = true;
  resultScreen.hidden = false;
  storyScreen.hidden = true;
}

modeOptions.forEach(option => {
  option.addEventListener("click", () => {
    setSelectedMode(option.dataset.mode);
  });
});

timeOptions.forEach(option => {
  option.addEventListener("click", () => {
    setSelectedMinutes(Number(option.dataset.minutes));
  });
});

document.querySelector("#discover-button").addEventListener("click", () => {
  const place = getRandomPlace();
  showMysteryScreen(place);
});

simulateArrivalButton.addEventListener("click", () => {
  unlockStoryButton();
  mysteryDestination.textContent = currentPlace.name;
  destinationHint.textContent = currentPlace.description;
});

storyButton.addEventListener("click", () => {
  if (!isStoryUnlocked) {
    return;
  }

  resultScreen.hidden = true;
  storyScreen.hidden = false;
});

document.querySelector("#back-button").addEventListener("click", () => {
  resultScreen.hidden = true;
  homeScreen.hidden = false;
});

document.querySelector("#story-back").addEventListener("click", () => {
  storyScreen.hidden = true;
  resultScreen.hidden = false;
});

markDiscoveredButton.addEventListener("click", () => {
  markPlaceAsDiscovered();
  markDiscoveredButton.textContent = "Saved to your map";
  markDiscoveredButton.disabled = true;
});

document.querySelector("#restart-button").addEventListener("click", () => {
  storyScreen.hidden = true;
  homeScreen.hidden = false;
  lockStoryButton();
  markDiscoveredButton.textContent = "Mark as discovered";
  markDiscoveredButton.disabled = false;
});

setSelectedMode(selectedMode);
setSelectedMinutes(selectedMinutes);
updateDiscoveryMap();
