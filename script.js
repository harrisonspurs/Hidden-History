const speeds = {
  walking: 80,   // metres per minute
  cycling: 250,
  transit: 300
};

const arriveDistance = 50;
const rerouteDistance = 100;
const demoLocation = { lat: 53.4780, lng: -2.2430 };

const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const tileCredit = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const routeServers = {
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
  cycling: "https://routing.openstreetmap.de/routed-bike/route/v1/driving/"
};

// words that make a wikipedia page sound historic
const historicWords = [
  "listed", "historic", "historical", "heritage", "former", "century",
  "church", "chapel", "cathedral", "abbey", "priory",
  "museum", "library", "gallery", "theatre",
  "memorial", "monument", "statue", "sculpture",
  "hall", "house", "manor", "castle", "pub", "inn",
  "mill", "warehouse", "canal", "viaduct", "barracks",
  "fort", "ruin", "ruins", "park", "cemetery"
];

// stuff that matches above but is boring
const boringWords = [
  "tram stop", "under construction", "electoral ward", "retail park",
  "stadium", "radio station"
];

const oldPictureWords = [
  "engraving", "painting", "drawing", "sketch", "illustration", "print",
  "postcard", "lithograph", "etching", "watercolour", "photograph", "photographed"
];

let mode = "walking";
let minutes = 30;
let theme = "anything";

let user = null;
let target = null;
let nearbyPlaces = [];
let skipped = [];
let searchFailed = false;
let pickProblem = "";
let tripMetres = 0;
let showingWiki = "";

let map = null;
let userMarker = null;
let targetMarker = null;
let routeLine = null;
let routeFor = null;
let routeFrom = null;
let following = true;
let watchId = null;

let findsMap = null;
let findsMarkers = null;

const homeScreen = document.getElementById("home-screen");
const huntScreen = document.getElementById("hunt-screen");
const storyScreen = document.getElementById("story-screen");
const findsScreen = document.getElementById("finds-screen");

const goButton = document.getElementById("go-button");
const statusBox = document.getElementById("status");
const statusText = document.getElementById("status-text");
const demoButton = document.getElementById("demo-button");


// haversine formula - distance between 2 points in metres
// (earth's round so you can't just do a straight line)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function niceDistance(metres) {
  if (metres < 1000) {
    return Math.round(metres / 10) * 10 + " m";
  }
  return (metres / 1000).toFixed(1) + " km";
}

function dayString(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function niceDate(dayText) {
  const date = new Date(dayText + "T12:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// \b = whole words only, so "inn" doesn't match "dinner"
function hasAnyWord(text, words) {
  text = text.toLowerCase();
  return words.some(word => new RegExp("\\b" + word + "\\b").test(text));
}

function showScreen(screen) {
  homeScreen.hidden = true;
  huntScreen.hidden = true;
  storyScreen.hidden = true;
  findsScreen.hidden = true;
  screen.hidden = false;
  window.scrollTo(0, 0);
}

function setStatus(message, offerDemo = false) {
  statusText.textContent = message;
  statusBox.hidden = message === "";
  demoButton.hidden = !offerDemo;
}


// finds get saved in localStorage so they stay on the phone
function getFinds() {
  return JSON.parse(localStorage.getItem("finds")) || [];
}

function saveFind(place, metres) {
  const finds = getFinds();
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

// counts back day by day. if nothing found today yet, start from yesterday
// so the streak doesn't reset in the morning
function getStreak(finds) {
  const days = finds.map(find => find.date);
  const day = new Date();

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

function showHomeSummary() {
  document.getElementById("finds-button").textContent = getFinds().length + " found";
}


// wikidata search (SPARQL) - gets listed buildings + monuments near you
// P625 = coordinates, P1435 = heritage status
// returns null if it fails so we know the difference between "nothing found" and "broken"
async function getHeritagePlaces(centre, radiusMetres) {
  const query = `
    SELECT ?itemLabel ?itemDescription ?coord ?heritageLabel ?article WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?coord .
        bd:serviceParam wikibase:center "Point(${centre.lng} ${centre.lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${radiusMetres / 1000}" .
      }
      ?item wdt:P1435 ?heritage .
      ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 300`;

  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await response.json();

    return data.results.bindings.map(row => {
      // coords come back as text like "Point(-2.27 53.46)" so pull the numbers out
      const numbers = row.coord.value.replace("Point(", "").replace(")", "").split(" ");
      const title = decodeURIComponent(row.article.value.split("/wiki/")[1]);

      return {
        name: row.itemLabel.value,
        wiki: title,
        lat: Number(numbers[1]),
        lng: Number(numbers[0]),
        description: row.itemDescription ? row.itemDescription.value : "",
        heritage: row.heritageLabel.value
      };
    });
  } catch (error) {
    return null;
  }
}

// wikipedia only gives back the 50 closest pages, so in the city a long trip
// still finds stuff on your doorstep. fix = also search 4 spots around you
function getSearchPoints(centre, maxDistance) {
  const points = [centre];

  if (maxDistance > 1000) {
    const step = maxDistance * 0.6;
    const latStep = step / 111320; // metres in 1 degree of latitude
    const lngStep = step / (111320 * Math.cos(centre.lat * Math.PI / 180));

    points.push({ lat: centre.lat + latStep, lng: centre.lng });
    points.push({ lat: centre.lat - latStep, lng: centre.lng });
    points.push({ lat: centre.lat, lng: centre.lng + lngStep });
    points.push({ lat: centre.lat, lng: centre.lng - lngStep });
  }

  return points;
}

async function getWikipediaPlaces(point, radiusMetres) {
  const radius = Math.min(Math.round(radiusMetres), 10000); // wikipedia max is 10km

  const url = "https://en.wikipedia.org/w/api.php" +
    "?action=query&format=json&origin=*" +
    "&generator=geosearch&ggslimit=50" +
    "&ggscoord=" + point.lat + "|" + point.lng +
    "&ggsradius=" + radius +
    "&prop=coordinates|description&colimit=50";

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!data.query) return [];

    return Object.values(data.query.pages)
      .filter(page => page.coordinates && soundsHistoric(page.description))
      .map(page => {
        return {
          name: page.title,
          wiki: page.title.replaceAll(" ", "_"),
          lat: page.coordinates[0].lat,
          lng: page.coordinates[0].lon,
          description: page.description,
          heritage: ""
        };
      });
  } catch (error) {
    return null;
  }
}

function soundsHistoric(description) {
  if (!description) return false;
  const historic = hasAnyWord(description, historicWords) || hasAnyWord(description, themes.interesting);
  return historic && !hasAnyWord(description, boringWords);
}

// fires all the searches at once (Promise.all) so it's quicker, then merges them
async function findPlaces(centre, maxDistance) {
  const points = getSearchPoints(centre, maxDistance);

  const searches = [getHeritagePlaces(centre, maxDistance)];
  for (const point of points) {
    const radius = points.length === 1 ? maxDistance : maxDistance * 0.5;
    searches.push(getWikipediaPlaces(point, radius));
  }
  const results = await Promise.all(searches);

  const found = [];
  for (const list of results) {
    if (list === null) continue;
    for (const place of list) {
      if (!found.some(p => p.wiki === place.wiki)) {
        found.push(place);
      }
    }
  }

  return {
    places: found,
    failed: results.every(list => list === null)
  };
}


// halved cos you've got to get back as well
function getMaxDistance() {
  return speeds[mode] * minutes / 2;
}

function matchesTheme(place) {
  if (theme === "anything") return true;
  return hasAnyWord(place.name + " " + place.description, themes[theme]);
}

function pickPlace() {
  const maxDistance = getMaxDistance();
  const finds = getFinds();

  const options = nearbyPlaces.map(place => {
    return { ...place, distance: getDistance(user.lat, user.lng, place.lat, place.lng) };
  });

  const inRange = options.filter(place => place.distance <= maxDistance && place.distance > arriveDistance);
  const rightKind = inRange.filter(matchesTheme);
  const fresh = rightKind.filter(place => {
    return !finds.some(find => find.wiki === place.wiki) && !skipped.includes(place.wiki);
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

  // go for places at least 40% of the way out, so longer trips actually go further
  const further = fresh.filter(place => place.distance >= maxDistance * 0.4);
  const pool = further.length > 0 ? further : fresh;

  return pool[Math.floor(Math.random() * pool.length)];
}


function findSomewhere() {
  if (!navigator.geolocation) {
    setStatus("This browser can't share location.", true);
    return;
  }

  goButton.disabled = true;
  setStatus("Finding you...");

  navigator.geolocation.getCurrentPosition(
    position => {
      user = { lat: position.coords.latitude, lng: position.coords.longitude };
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

  const result = await findPlaces(user, getMaxDistance());
  searchFailed = result.failed;

  // my own places + whatever got found live
  nearbyPlaces = [...places];
  for (const place of result.places) {
    if (!nearbyPlaces.some(p => p.wiki === place.wiki)) {
      nearbyPlaces.push(place);
    }
  }

  skipped = [];
  goButton.disabled = false;
  chooseTarget();
}

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


function showHunt() {
  showScreen(huntScreen);

  if (map === null) {
    map = L.map("map", { zoomControl: false });
    L.tileLayer(tileUrl, { attribution: tileCredit, maxZoom: 19 }).addTo(map);

    map.on("dragstart", () => {
      following = false;
      document.getElementById("recentre-button").hidden = false;
    });

    routeLine = L.polyline([], { color: "#111111", weight: 5, opacity: 0.85 }).addTo(map);

    const youIcon = L.divIcon({ className: "pin-you", iconSize: [20, 20] });
    const mysteryIcon = L.divIcon({ className: "pin-mystery", html: "?", iconSize: [40, 40] });

    userMarker = L.marker([user.lat, user.lng], { icon: youIcon, alt: "You" }).addTo(map);
    targetMarker = L.marker([target.lat, target.lng], { icon: mysteryIcon, alt: "Mystery place" }).addTo(map);
  }

  // leaflet gets the size wrong if the map was hidden, this makes it re-measure
  map.invalidateSize();

  userMarker.setLatLng([user.lat, user.lng]);
  targetMarker.setLatLng([target.lat, target.lng]);
  recentre();
  drawRoute();

  // no free bus/train planner exists so this just opens google maps
  const transitLink = document.getElementById("transit-link");
  transitLink.hidden = mode !== "transit";
  transitLink.href = "https://www.google.com/maps/dir/?api=1&travelmode=transit" +
    "&destination=" + target.lat + "," + target.lng;

  const clue = document.getElementById("clue");
  clue.hidden = !target.heritage;
  clue.textContent = target.heritage;

  const note = document.getElementById("hunt-note");
  note.hidden = !searchFailed;
  note.textContent = "No connection. This is a saved place.";

  updateDistance();
  startTracking();
}

function recentre() {
  following = true;
  document.getElementById("recentre-button").hidden = true;
  map.fitBounds([[user.lat, user.lng], [target.lat, target.lng]], { padding: [45, 45], maxZoom: 18 });
}

// draws a dashed straight line first, then swaps it for the real route when it comes back.
// if the route api is down the dashed line just stays
async function drawRoute() {
  const routeTime = document.getElementById("route-time");
  const placeAtStart = target;
  routeFrom = { lat: user.lat, lng: user.lng };

  if (routeFor !== target || mode === "transit") {
    routeLine.setLatLngs([[user.lat, user.lng], [target.lat, target.lng]]);
    routeLine.setStyle({ dashArray: "2 10" });
    routeTime.textContent = "";
  }
  routeFor = target;

  if (mode === "transit") return;

  try {
    // route api wants lng,lat (backwards to everything else)
    const url = routeServers[mode] +
      user.lng + "," + user.lat + ";" + target.lng + "," + target.lat +
      "?overview=full&geometries=geojson";

    const response = await fetch(url);
    const data = await response.json();

    // you skipped while this was loading, so ignore it
    if (target !== placeAtStart) return;

    const route = data.routes[0];

    // flip each point from [lng, lat] to [lat, lng] for leaflet
    const points = route.geometry.coordinates.map(point => [point[1], point[0]]);
    routeLine.setLatLngs(points);
    routeLine.setStyle({ dashArray: null });

    const routeMinutes = Math.max(1, Math.round(route.duration / 60));
    routeTime.textContent = routeMinutes + " min " + (mode === "cycling" ? "by bike" : "walk");
  } catch (error) {}
}

function updateDistance() {
  const metres = getDistance(user.lat, user.lng, target.lat, target.lng);
  document.getElementById("distance").textContent = niceDistance(metres);

  if (metres <= arriveDistance) {
    arrive();
  }
}

// watchPosition keeps firing every time the phone's GPS moves
function startTracking() {
  if (!navigator.geolocation) return;

  watchId = navigator.geolocation.watchPosition(
    position => {
      user.lat = position.coords.latitude;
      user.lng = position.coords.longitude;
      userMarker.setLatLng([user.lat, user.lng]);
      updateDistance();

      if (watchId === null) return; // already arrived

      if (following) {
        recentre();
      }

      // only get a new route every 100m so we're not spamming the api
      const moved = getDistance(user.lat, user.lng, routeFrom.lat, routeFrom.lng);
      if (mode === "transit" || moved >= rerouteDistance) {
        drawRoute();
      }
    },
    () => {},
    { enableHighAccuracy: true }
  );
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}


function arrive() {
  stopTracking();
  saveFind(target, tripMetres);
  showStory(getFinds().find(f => f.wiki === target.wiki));
}

function showStory(place) {
  showingWiki = place.wiki;

  document.getElementById("place-name").textContent = place.name;
  document.getElementById("place-date").textContent = "Found " + niceDate(place.date);

  const tag = document.getElementById("place-tag");
  tag.hidden = !place.heritage;
  tag.textContent = place.heritage;

  document.getElementById("place-story").textContent = "Loading...";
  document.getElementById("place-image").hidden = true;
  document.getElementById("old-view").hidden = true;
  document.getElementById("place-source").href = "https://en.wikipedia.org/wiki/" + encodeURIComponent(place.wiki);

  showScreen(storyScreen);
  loadStory(place.wiki);
  loadPhotos(place.wiki);
}

async function loadStory(wikiTitle) {
  const storyText = document.getElementById("place-story");
  const image = document.getElementById("place-image");

  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(wikiTitle);
    const response = await fetch(url);
    if (!response.ok) throw new Error();
    const data = await response.json();

    // you've opened a different story since, so ignore this one
    if (wikiTitle !== showingWiki) return;

    storyText.textContent = data.extract;

    if (data.thumbnail && image.hidden) {
      image.src = data.thumbnail.source;
      image.hidden = false;
    }
  } catch (error) {
    if (wikiTitle !== showingWiki) return;
    storyText.textContent = "Couldn't load the story. Check your connection.";
  }
}

// gets a bigger photo, plus an old picture if a caption has an old year in it
async function loadPhotos(wikiTitle) {
  try {
    const url = "https://en.wikipedia.org/api/rest_v1/page/media-list/" + encodeURIComponent(wikiTitle);
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();

    if (wikiTitle !== showingWiki) return;

    const pictures = data.items.filter(item => item.type === "image" && item.srcset);

    const main = pictures.find(item => item.leadImage);
    if (main) {
      const image = document.getElementById("place-image");
      image.src = "https:" + main.srcset[0].src;
      image.hidden = false;
    }

    // regex = any year from 1500 to 1959
    const old = pictures.find(item => {
      if (item.leadImage || !item.caption) return false;
      const caption = item.caption.text;
      return /\b(1[5-8]\d\d|19[0-5]\d)\b/.test(caption) && hasAnyWord(caption, oldPictureWords);
    });

    if (old) {
      document.getElementById("old-view-image").src = "https:" + old.srcset[0].src;
      // strips footnote bits like [14] out of the caption
      document.getElementById("old-view-caption").textContent = old.caption.text.replace(/\[\d+\]/g, "");
      document.getElementById("old-view").hidden = false;
    }
  } catch (error) {}
}


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

  if (findsMap === null) {
    findsMap = L.map("finds-map", { zoomControl: false });
    L.tileLayer(tileUrl, { attribution: tileCredit, maxZoom: 19 }).addTo(findsMap);
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

  findsMap.fitBounds(finds.map(find => [find.lat, find.lng]), { padding: [30, 30], maxZoom: 16 });
}

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


document.getElementById("mode-select").addEventListener("change", event => {
  mode = event.target.value;
});

document.getElementById("theme-select").addEventListener("change", event => {
  theme = event.target.value;
});

const timeButtons = document.querySelectorAll("#time-choices button");
timeButtons.forEach(button => {
  button.addEventListener("click", () => {
    timeButtons.forEach(b => b.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    minutes = Number(button.dataset.value);
  });
});

goButton.addEventListener("click", findSomewhere);

demoButton.addEventListener("click", () => {
  user = { ...demoLocation };
  startTrip();
});

document.getElementById("skip-button").addEventListener("click", skipPlace);
document.getElementById("recentre-button").addEventListener("click", recentre);
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

document.getElementById("again-button").addEventListener("click", () => {
  goHome();
  findSomewhere();
});

document.getElementById("finds-button").addEventListener("click", showFinds);
document.getElementById("story-finds-button").addEventListener("click", showFinds);

showHomeSummary();
