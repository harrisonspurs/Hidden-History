// ---------- Settings ----------

// Roughly how many metres you cover in a minute
const speeds = {
  walking: 80,
  cycling: 250
};

// How close you need to be to unlock the story (metres)
const arriveDistance = 50;

// If we can't get your location, pretend you're in Manchester city centre
const defaultLocation = { lat: 53.4780, lng: -2.2430 };


// ---------- Variables ----------

let mode = "walking";
let minutes = 30;
let user = null;      // { lat, lng }
let target = null;    // the place we're sending you to

let map = null;
let userMarker = null;
let targetMarker = null;
let watchId = null;


// ---------- Get the HTML elements ----------

const homeScreen = document.getElementById("home-screen");
const mapScreen = document.getElementById("map-screen");
const storyScreen = document.getElementById("story-screen");
const statusText = document.getElementById("status");
const distanceText = document.getElementById("distance");
const foundList = document.getElementById("found-list");
const directionsLink = document.getElementById("directions-link");


// ---------- Helper functions ----------

// Distance between two points in metres (haversine formula)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radius of the earth in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showScreen(screen) {
  homeScreen.hidden = true;
  mapScreen.hidden = true;
  storyScreen.hidden = true;
  screen.hidden = false;
}

function getFoundPlaces() {
  return JSON.parse(localStorage.getItem("foundPlaces")) || [];
}

function saveFoundPlace(name) {
  const found = getFoundPlaces();
  if (!found.includes(name)) {
    found.push(name);
    localStorage.setItem("foundPlaces", JSON.stringify(found));
  }
}

function showFoundList() {
  const found = getFoundPlaces();
  foundList.innerHTML = "";

  if (found.length === 0) {
    foundList.innerHTML = "<li class='small'>Nothing yet.</li>";
    return;
  }

  for (const name of found) {
    const li = document.createElement("li");
    li.textContent = name;
    foundList.appendChild(li);
  }
}


// ---------- Picking a place ----------

function pickPlace() {
  // You need to get there AND back, so only use half the time
  const maxDistance = speeds[mode] * minutes / 2;
  const found = getFoundPlaces();

  // Work out how far away every place is
  const options = places.map(place => {
    return {
      ...place,
      distance: getDistance(user.lat, user.lng, place.lat, place.lng)
    };
  });

  // Places you haven't found yet
  let notFound = options.filter(place => !found.includes(place.name));
  if (notFound.length === 0) {
    notFound = options; // found them all, so start again
  }

  // Places that are close enough
  const inRange = notFound.filter(place => place.distance <= maxDistance);

  if (inRange.length > 0) {
    // Pick a random one
    return inRange[Math.floor(Math.random() * inRange.length)];
  }

  // Nothing in range, so just pick the closest one
  notFound.sort((a, b) => a.distance - b.distance);
  return notFound[0];
}


// ---------- The map ----------

function showMap() {
  showScreen(mapScreen);

  // Only create the map once
  if (map === null) {
    map = L.map("map");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    userMarker = L.circleMarker([user.lat, user.lng], {
      radius: 8,
      color: "#1f3d2f",
      fillOpacity: 1
    }).addTo(map);

    targetMarker = L.marker([target.lat, target.lng]).addTo(map);
  }

  // The map was hidden, so tell Leaflet to resize it
  map.invalidateSize();

  userMarker.setLatLng([user.lat, user.lng]);
  targetMarker.setLatLng([target.lat, target.lng]);
  map.fitBounds([[user.lat, user.lng], [target.lat, target.lng]], { padding: [40, 40] });

  directionsLink.href =
    "https://www.google.com/maps/dir/?api=1&travelmode=" + mode +
    "&destination=" + target.lat + "," + target.lng;

  updateDistance();
  startTracking();
}

function updateDistance() {
  const metres = getDistance(user.lat, user.lng, target.lat, target.lng);

  if (metres < 1000) {
    distanceText.textContent = Math.round(metres) + " m away";
  } else {
    distanceText.textContent = (metres / 1000).toFixed(1) + " km away";
  }

  if (metres <= arriveDistance) {
    arrive();
  }
}

// Keep checking where you are while you walk
function startTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(position => {
    user.lat = position.coords.latitude;
    user.lng = position.coords.longitude;
    userMarker.setLatLng([user.lat, user.lng]);
    updateDistance();
  });
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}


// ---------- Arriving ----------

function arrive() {
  stopTracking();
  saveFoundPlace(target.name);

  document.getElementById("place-name").textContent = target.name;
  document.getElementById("place-story").textContent = "Loading the story...";
  document.getElementById("place-image").hidden = true;
  document.getElementById("place-source").href = "https://en.wikipedia.org/wiki/" + target.wiki;
  showScreen(storyScreen);

  loadStory(target.wiki);
}

// Get the story from Wikipedia's free summary API (no key needed)
async function loadStory(wikiTitle) {
  const storyText = document.getElementById("place-story");
  const image = document.getElementById("place-image");

  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wikiTitle);
    const response = await fetch(url);
    const data = await response.json();

    storyText.textContent = data.extract;

    if (data.thumbnail) {
      image.src = data.thumbnail.source;
      image.hidden = false;
    }
  } catch (error) {
    storyText.textContent = "Couldn't load the story right now. Tap the source link below to read it.";
  }
}


// ---------- Starting a trip ----------

function startTrip() {
  target = pickPlace();
  showMap();
}

function findSomewhere() {
  statusText.textContent = "Finding your location...";

  if (!navigator.geolocation) {
    user = { ...defaultLocation };
    statusText.textContent = "";
    startTrip();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      user = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      statusText.textContent = "";
      startTrip();
    },
    () => {
      // Location blocked or failed - use the city centre instead
      user = { ...defaultLocation };
      statusText.textContent = "Couldn't get your location, so starting from the city centre.";
      startTrip();
    }
  );
}


// ---------- Buttons ----------

document.querySelectorAll(".mode-option").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".mode-option").forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");
  });
});

document.querySelectorAll(".time-option").forEach(button => {
  button.addEventListener("click", () => {
    minutes = Number(button.dataset.minutes);
    document.querySelectorAll(".time-option").forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");
  });
});

document.getElementById("go-button").addEventListener("click", findSomewhere);

document.getElementById("test-arrive").addEventListener("click", arrive);

document.getElementById("back-button").addEventListener("click", () => {
  stopTracking();
  showScreen(homeScreen);
});

document.getElementById("again-button").addEventListener("click", () => {
  showFoundList();
  showScreen(homeScreen);
});


// ---------- Start ----------

showFoundList();
