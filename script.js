// script.js - the app itself: the screens, the map, and keeping track of finds.
// Finding places is in finder.js. The hand-picked places and themes are in places.js.


// ---------- Settings ----------

// Roughly how many metres you cover in a minute
const speeds = {
  walking: 80,
  cycling: 250,
  transit: 300  // buses and trams, including a bit of waiting
};

// Clean, light map tiles from CARTO (free, built on OpenStreetMap)
const tileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const tileCredit = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Free route finder run by the OpenStreetMap community in Germany (FOSSGIS)
const routeServers = {
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/driving/"
};

// How close you need to be to unlock the story (metres)
const arriveDistance = 50;

// Used if someone can't share their location but still wants to try the app
const demoLocation = { lat: 53.4780, lng: -2.2430 };

// A caption needs one of these words (plus an old year) to count as "an older view"
const oldPictureWords = [
  "engraving", "painting", "drawing", "sketch", "illustration", "print",
  "postcard", "lithograph", "etching", "watercolour", "photograph", "photographed"
];


// ---------- Variables ----------

let mode = "walking";
let minutes = 30;
let theme = "anything";

let user = null;          // where you are: { lat, lng }
let target = null;        // the place you're being sent to
let nearbyPlaces = [];    // every place we know about for this trip
let skipped = [];         // places you passed on during this trip
let searchFailed = false; // true if Wikipedia and Wikidata couldn't be reached
let pickProblem = "";     // why no place could be picked
let tripMetres = 0;       // how far away the place was when you set off
let showingWiki = "";     // which story is on screen

let map = null;
let userMarker = null;
let targetMarker = null;
let routeLine = null;
let watchId = null;

let findsMap = null;
let findsMarkers = null;


// ---------- Get the HTML elements ----------

const homeScreen = document.getElementById("home-screen");
const huntScreen = document.getElementById("hunt-screen");
const storyScreen = document.getElementById("story-screen");
const findsScreen = document.getElementById("finds-screen");

const goButton = document.getElementById("go-button");
const statusBox = document.getElementById("status");
const statusText = document.getElementById("status-text");
const demoButton = document.getElementById("demo-button");


// ---------- Small helpers ----------

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

// 640 -> "640 m", 2130 -> "2.1 km"
function niceDistance(metres) {
  if (metres < 1000) {
    return Math.round(metres / 10) * 10 + " m";
  }
  return (metres / 1000).toFixed(1) + " km";
}

// A date as text like "2026-11-16", so days are easy to compare
function dayString(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

// "2026-11-16" -> "16 Nov 2026"
function niceDate(dayText) {
  const date = new Date(dayText + "T12:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function showScreen(screen) {
  homeScreen.hidden = true;
  huntScreen.hidden = true;
  storyScreen.hidden = true;
  findsScreen.hidden = true;
  screen.hidden = false;
  window.scrollTo(0, 0);
}

// Shows a message under the main button. Pass "" to clear it.
function setStatus(message, offerDemo = false) {
  statusText.textContent = message;
  statusBox.hidden = message === "";
  demoButton.hidden = !offerDemo;
}


// ---------- Your finds (saved on this device) ----------

function getFinds() {
  return JSON.parse(localStorage.getItem("finds")) || [];
}

function saveFind(place, metres) {
  const finds = getFinds();

  // Don't save the same place twice
  if (finds.some(find => find.wiki === place.wiki)) return;

  finds.push({
    name: place.name,
    wiki: place.wiki,
    lat: place.lat,
    lng: place.lng,
    heritage: place.heritage || "",
    date: dayString(new Date()),
    metres: Math.round(metres)
  });
  localStorage.setItem("finds", JSON.stringify(finds));
}

// How many days in a row you've found something (counting back from today)
function getStreak(finds) {
  const days = finds.map(find => find.date);
  const day = new Date();

  // If you haven't found anything yet today, the streak can still be alive from yesterday
  if (!days.includes(dayString(day))) {
    day.setDate(day.getDate() - 1);
  }

  let streak = 0;
  while (days.includes(dayString(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

// The button in the corner of the home screen shows how many you've found
function showHomeSummary() {
  const count = getFinds().length;
  document.getElementById("finds-button").textContent = count + " found";
}


// ---------- Picking a place ----------

// How far you can go and still get back in the time you picked
function getMaxDistance() {
  return speeds[mode] * minutes / 2;
}

// Does this place fit the kind of place you asked for?
function matchesTheme(place) {
  if (theme === "anything") return true;
  return hasAnyWord(place.name + " " + place.description, themes[theme]);
}

// Picks a place from nearbyPlaces, or returns null and sets pickProblem
function pickPlace() {
  const maxDistance = getMaxDistance();
  const finds = getFinds();

  // Work out how far away every place is
  const options = nearbyPlaces.map(place => {
    return {
      ...place,
      distance: getDistance(user.lat, user.lng, place.lat, place.lng)
    };
  });

  // Close enough to reach, but not so close you're already standing at it
  const inRange = options.filter(place => place.distance <= maxDistance && place.distance > arriveDistance);

  // The kind of place you asked for
  const rightKind = inRange.filter(matchesTheme);

  // Not found before, and not skipped on this trip
  const fresh = rightKind.filter(place => {
    const alreadyFound = finds.some(find => find.wiki === place.wiki);
    return !alreadyFound && !skipped.includes(place.wiki);
  });

  if (inRange.length === 0 && searchFailed) {
    pickProblem = "No connection, and nothing saved is close enough.";
    return null;
  }
  if (inRange.length === 0) {
    pickProblem = "Nothing in range. Try a longer time.";
    return null;
  }
  if (rightKind.length === 0) {
    pickProblem = "Nothing like that in range. Try a longer time or Anything.";
    return null;
  }
  if (fresh.length === 0) {
    pickProblem = "You've seen everything in range. Try a longer time.";
    return null;
  }

  // Prefer places that use a good part of your time, so a longer trip really goes further
  const further = fresh.filter(place => place.distance >= maxDistance * 0.4);
  const pool = further.length > 0 ? further : fresh;

  return pool[Math.floor(Math.random() * pool.length)];
}


// ---------- Starting a trip ----------

function findSomewhere() {
  if (!navigator.geolocation) {
    setStatus("This browser can't share location.", true);
    return;
  }

  goButton.disabled = true;
  setStatus("Finding you...");

  navigator.geolocation.getCurrentPosition(
    position => {
      user = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      startTrip();
    },
    error => {
      goButton.disabled = false;

      if (error.code === error.PERMISSION_DENIED) {
        setStatus("Location is off. Turn it on in your browser settings.", true);
      } else {
        setStatus("Couldn't find you. Try again outside.", true);
      }
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

async function startTrip() {
  goButton.disabled = true;
  setStatus("Searching...");

  // Our hand-picked places + whatever Wikidata and Wikipedia find nearby
  const result = await findPlaces(user, getMaxDistance());
  searchFailed = result.failed;

  nearbyPlaces = [...places];
  for (const place of result.places) {
    // Don't add it twice if it's already in our list
    if (!nearbyPlaces.some(p => p.wiki === place.wiki)) {
      nearbyPlaces.push(place);
    }
  }

  skipped = [];
  goButton.disabled = false;
  chooseTarget();
}

// Picks a place and shows the map, or goes home and explains why it couldn't
function chooseTarget() {
  target = pickPlace();

  if (target === null) {
    showHomeSummary();
    showScreen(homeScreen);
    setStatus(pickProblem);
    return;
  }

  setStatus("");
  tripMetres = target.distance;
  showHunt();
}

function skipPlace() {
  stopTracking();
  skipped.push(target.wiki);
  chooseTarget();
}


// ---------- On the way (the map screen) ----------

function showHunt() {
  showScreen(huntScreen);

  // Only create the map once
  if (map === null) {
    // No zoom buttons - you can pinch or scroll to zoom
    map = L.map("map", { zoomControl: false });
    L.tileLayer(tileUrl, { attribution: tileCredit, subdomains: "abcd", maxZoom: 20 }).addTo(map);

    routeLine = L.polyline([], { color: "#111111", weight: 5, opacity: 0.85 }).addTo(map);

    const youIcon = L.divIcon({ className: "pin-you", iconSize: [20, 20] });
    const mysteryIcon = L.divIcon({ className: "pin-mystery", html: "?", iconSize: [40, 40] });

    userMarker = L.marker([user.lat, user.lng], { icon: youIcon, alt: "You" }).addTo(map);
    targetMarker = L.marker([target.lat, target.lng], { icon: mysteryIcon, alt: "The mystery place" }).addTo(map);
  }

  // The map was hidden, so tell Leaflet to measure it again
  map.invalidateSize();

  userMarker.setLatLng([user.lat, user.lng]);
  targetMarker.setLatLng([target.lat, target.lng]);
  map.fitBounds([[user.lat, user.lng], [target.lat, target.lng]], { padding: [45, 45] });

  drawRoute();

  // There's no free bus and train planner, so public transport opens Google Maps
  const transitLink = document.getElementById("transit-link");
  transitLink.hidden = mode !== "transit";
  transitLink.href = "https://www.google.com/maps/dir/?api=1&travelmode=transit" +
    "&destination=" + target.lat + "," + target.lng;

  // A clue, if we know the place is officially protected
  const clue = document.getElementById("clue");
  clue.hidden = !target.heritage;
  clue.textContent = target.heritage;

  // Be honest if the live search didn't work
  const note = document.getElementById("hunt-note");
  note.hidden = !searchFailed;
  note.textContent = "No connection. This is a saved place.";

  updateDistance();
  startTracking();
}

// Draws the route from you to the mystery place on the map
async function drawRoute() {
  const routeTime = document.getElementById("route-time");
  const placeAtStart = target;

  // To start with (and if anything goes wrong) just draw a dashed straight line
  routeLine.setLatLngs([[user.lat, user.lng], [target.lat, target.lng]]);
  routeLine.setStyle({ dashArray: "2 10" });
  routeTime.textContent = "";

  // No route for public transport - you'd need bus and train times
  if (mode === "transit") return;

  try {
    // The route finder wants longitude first, then latitude
    const url = routeServers[mode] +
      user.lng + "," + user.lat + ";" + target.lng + "," + target.lat +
      "?overview=full&geometries=geojson";

    const response = await fetch(url);
    const data = await response.json();

    // If you've skipped to another place while this loaded, leave it alone
    if (target !== placeAtStart) return;

    const route = data.routes[0];

    // Swap each point from [lng, lat] to [lat, lng] for Leaflet
    const points = route.geometry.coordinates.map(point => [point[1], point[0]]);
    routeLine.setLatLngs(points);
    routeLine.setStyle({ dashArray: null });

    const routeMinutes = Math.max(1, Math.round(route.duration / 60));
    routeTime.textContent = routeMinutes + " min " + (mode === "cycling" ? "by bike" : "walk");
  } catch (error) {
    // Keep the straight line
  }
}

function updateDistance() {
  const metres = getDistance(user.lat, user.lng, target.lat, target.lng);
  document.getElementById("distance").textContent = niceDistance(metres);

  if (metres <= arriveDistance) {
    arrive();
  }
}

// Keep checking where you are while you travel
function startTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(
    position => {
      user.lat = position.coords.latitude;
      user.lng = position.coords.longitude;
      userMarker.setLatLng([user.lat, user.lng]);
      updateDistance();
    },
    () => {
      // If one check fails we just wait for the next one
    },
    { enableHighAccuracy: true }
  );
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}


// ---------- Arriving and the story ----------

function arrive() {
  stopTracking();
  saveFind(target, tripMetres);

  // Show it the way it was saved, so the date is there
  const find = getFinds().find(f => f.wiki === target.wiki);
  showStory(find);
}

// Shows the story screen for a place
function showStory(place) {
  showingWiki = place.wiki;

  document.getElementById("place-name").textContent = place.name;
  document.getElementById("place-date").textContent = "Found " + niceDate(place.date);

  const tag = document.getElementById("place-tag");
  tag.hidden = !place.heritage;
  tag.textContent = place.heritage;

  // Clear whatever the last story left behind
  document.getElementById("place-story").textContent = "Loading...";
  document.getElementById("place-image").hidden = true;
  document.getElementById("old-view").hidden = true;
  document.getElementById("place-source").href = "https://en.wikipedia.org/wiki/" + encodeURIComponent(place.wiki);

  showScreen(storyScreen);

  loadStory(place.wiki);
  loadPhotos(place.wiki);
}

// Gets the story from Wikipedia's summary API (free, no key needed)
async function loadStory(wikiTitle) {
  const storyText = document.getElementById("place-story");
  const image = document.getElementById("place-image");

  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wikiTitle);
    const response = await fetch(url);
    if (!response.ok) throw new Error("No story found");
    const data = await response.json();

    // If you've moved on to a different story while this loaded, leave it alone
    if (wikiTitle !== showingWiki) return;

    storyText.textContent = data.extract;

    // A small photo for now - loadPhotos swaps in a bigger one if it can
    if (data.thumbnail && image.hidden) {
      image.src = data.thumbnail.source;
      image.hidden = false;
    }
  } catch (error) {
    if (wikiTitle !== showingWiki) return;
    storyText.textContent = "Couldn't load the story. Check your connection.";
  }
}

// Gets the article's pictures: a bigger main photo, and an older view if there is one
async function loadPhotos(wikiTitle) {
  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/media-list/" + encodeURIComponent(wikiTitle);
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();

    if (wikiTitle !== showingWiki) return;

    const pictures = data.items.filter(item => item.type === "image" && item.srcset);

    // The main photo at the top of the article
    const main = pictures.find(item => item.leadImage);
    if (main) {
      const image = document.getElementById("place-image");
      image.src = "https:" + main.srcset[0].src;
      image.hidden = false;
    }

    // An older view: a picture whose caption mentions an old year and how it was made
    const old = pictures.find(item => {
      if (item.leadImage || !item.caption) return false;
      const caption = item.caption.text;
      const hasOldYear = /\b(1[5-8]\d\d|19[0-5]\d)\b/.test(caption);
      return hasOldYear && hasAnyWord(caption, oldPictureWords);
    });

    if (old) {
      // Captions can have footnote markers like [14] in them, so take those out
      const caption = old.caption.text.replace(/\[\d+\]/g, "");

      document.getElementById("old-view-image").src = "https:" + old.srcset[0].src;
      document.getElementById("old-view-caption").textContent = caption;
      document.getElementById("old-view").hidden = false;
    }
  } catch (error) {
    // No extra pictures - the story still works without them
  }
}


// ---------- The finds screen ----------

function showFinds() {
  const finds = getFinds();
  showScreen(findsScreen);

  showStats(finds);
  showFindsMap(finds);
  showFindsList(finds);
}

function showStats(finds) {
  document.getElementById("finds-empty").hidden = finds.length > 0;
  document.getElementById("stats").hidden = finds.length === 0;

  let total = 0;
  for (const find of finds) {
    total += find.metres;
  }

  document.getElementById("stat-places").textContent = finds.length;
  document.getElementById("stat-distance").textContent = niceDistance(total);
  document.getElementById("stat-streak").textContent = getStreak(finds);
}

function showFindsMap(finds) {
  const mapBox = document.getElementById("finds-map");
  mapBox.hidden = finds.length === 0;
  if (finds.length === 0) return;

  // Only create the map once
  if (findsMap === null) {
    findsMap = L.map("finds-map", { zoomControl: false });
    L.tileLayer(tileUrl, { attribution: tileCredit, subdomains: "abcd", maxZoom: 20 }).addTo(findsMap);
    findsMarkers = L.layerGroup().addTo(findsMap);
  }

  findsMap.invalidateSize();
  findsMarkers.clearLayers();

  const dotIcon = L.divIcon({ className: "pin-found", iconSize: [18, 18] });

  for (const find of finds) {
    const marker = L.marker([find.lat, find.lng], { icon: dotIcon, alt: find.name });
    marker.bindPopup(find.name);
    marker.addTo(findsMarkers);
  }

  const corners = finds.map(find => [find.lat, find.lng]);
  findsMap.fitBounds(corners, { padding: [30, 30], maxZoom: 16 });
}

// One row for each place, newest first. Tap one to read its story again.
function showFindsList(finds) {
  const list = document.getElementById("finds-list");
  list.innerHTML = "";

  for (const find of [...finds].reverse()) {
    const name = document.createElement("span");
    name.textContent = find.name;

    const date = document.createElement("span");
    date.className = "quiet";
    date.textContent = niceDate(find.date);

    const button = document.createElement("button");
    button.type = "button";
    button.append(name, date);
    button.addEventListener("click", () => showStory(find));

    const row = document.createElement("li");
    row.appendChild(button);
    list.appendChild(row);
  }
}


// ---------- Buttons ----------

// Makes a group of buttons work like a "pick one" choice
function setUpChoices(groupId, onPick) {
  const buttons = document.querySelectorAll("#" + groupId + " button");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(b => b.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      onPick(button.dataset.value, button.textContent);
    });
  });
}

// The two dropdowns
document.getElementById("mode-select").addEventListener("change", event => {
  mode = event.target.value;
});

document.getElementById("theme-select").addEventListener("change", event => {
  theme = event.target.value;
});

setUpChoices("time-choices", value => {
  minutes = Number(value);
});


goButton.addEventListener("click", findSomewhere);

demoButton.addEventListener("click", () => {
  user = { ...demoLocation };
  startTrip();
});

document.getElementById("skip-button").addEventListener("click", skipPlace);
document.getElementById("test-arrive").addEventListener("click", arrive);

function goHome() {
  stopTracking();
  setStatus("");
  showHomeSummary();
  showScreen(homeScreen);
}

document.getElementById("back-button").addEventListener("click", goHome);
document.getElementById("story-home-button").addEventListener("click", goHome);
document.getElementById("finds-back-button").addEventListener("click", goHome);

// "Next place" goes home and starts a new search with the same choices
document.getElementById("again-button").addEventListener("click", () => {
  goHome();
  findSomewhere();
});

document.getElementById("finds-button").addEventListener("click", showFinds);
document.getElementById("story-finds-button").addEventListener("click", showFinds);


// ---------- Start ----------

showHomeSummary();

// The service worker lets the app open even with no signal (see sw.js)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
