// finder.js - finds places with a past near a point on the map.
//
// It asks two free, open sources (no API keys needed):
//   1. Wikidata  - for officially protected places (listed buildings, monuments)
//   2. Wikipedia - for any page near you that sounds historic
//
// Both return places in the same shape as places.js:
//   { name, wiki, lat, lng, description, heritage }


// ---------- Settings ----------

// Words that suggest a Wikipedia page is about somewhere historic
const historicWords = [
  "listed", "historic", "historical", "heritage", "former", "century",
  "church", "chapel", "cathedral", "abbey", "priory",
  "museum", "library", "gallery", "theatre",
  "memorial", "monument", "statue", "sculpture",
  "hall", "house", "manor", "castle", "pub", "inn",
  "mill", "warehouse", "canal", "viaduct", "barracks",
  "fort", "ruin", "ruins", "park", "cemetery"
];

// Words that rule a page out, even if it matched above
const boringWords = [
  "tram stop", "under construction", "electoral ward", "retail park",
  "stadium", "radio station"
];

// Give up on a request after this long (milliseconds)
const searchTimeout = 12000;


// ---------- Word matching ----------

// True if the text contains any of the words (as whole words)
function hasAnyWord(text, words) {
  text = text.toLowerCase();
  return words.some(word => new RegExp("\\b" + word + "\\b").test(text));
}

function soundsHistoric(description) {
  if (!description) return false;
  return hasAnyWord(description, historicWords) && !hasAnyWord(description, boringWords);
}


// ---------- Source 1: Wikidata (protected places) ----------

// Finds everything within the radius that has an official heritage status
// (like "Grade II listed building") and an English Wikipedia page.
// Returns a list of places, or null if Wikidata couldn't be reached.
async function getHeritagePlaces(centre, radiusMetres) {
  const radiusKm = radiusMetres / 1000;

  // This is a SPARQL query - the language Wikidata uses for searching.
  // P625 = coordinates, P1435 = heritage designation
  const query = `
    SELECT ?itemLabel ?itemDescription ?coord ?heritageLabel ?article WHERE {
      SERVICE wikibase:around {
        ?item wdt:P625 ?coord .
        bd:serviceParam wikibase:center "Point(${centre.lng} ${centre.lat})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "${radiusKm}" .
      }
      ?item wdt:P1435 ?heritage .
      ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 300`;

  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(searchTimeout) });
    const data = await response.json();

    return data.results.bindings.map(row => {
      // Coordinates arrive as text like "Point(-2.2776 53.4693)"
      const numbers = row.coord.value.replace("Point(", "").replace(")", "").split(" ");

      // The article arrives as a full link, and we only want the page title
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


// ---------- Source 2: Wikipedia (pages near you) ----------

// Wikipedia only gives back the 50 pages closest to the point you ask about.
// In a city those 50 can all be within a few streets, so for longer trips
// we also ask about four more points: north, east, south and west of you.
function getSearchPoints(centre, maxDistance) {
  const points = [centre];

  if (maxDistance > 1000) {
    const step = maxDistance * 0.6;
    const latStep = step / 111320; // metres in one degree of latitude
    const lngStep = step / (111320 * Math.cos(centre.lat * Math.PI / 180));

    points.push({ lat: centre.lat + latStep, lng: centre.lng });
    points.push({ lat: centre.lat - latStep, lng: centre.lng });
    points.push({ lat: centre.lat, lng: centre.lng + lngStep });
    points.push({ lat: centre.lat, lng: centre.lng - lngStep });
  }

  return points;
}

// Asks Wikipedia for pages near one point.
// Returns a list of places, or null if Wikipedia couldn't be reached.
async function getWikipediaPlaces(point, radiusMetres) {
  // Wikipedia won't search further than 10km
  const radius = Math.min(Math.round(radiusMetres), 10000);

  const url = "https://en.wikipedia.org/w/api.php" +
    "?action=query&format=json&origin=*" +
    "&generator=geosearch&ggslimit=50" +
    "&ggscoord=" + point.lat + "|" + point.lng +
    "&ggsradius=" + radius +
    "&prop=coordinates|description&colimit=50";

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(searchTimeout) });
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


// ---------- Putting it together ----------

// Finds places around the centre, out to maxDistance metres.
// Returns { places, failed } - failed is true if neither source could be reached.
async function findPlaces(centre, maxDistance) {
  const points = getSearchPoints(centre, maxDistance);

  // Ask everything at the same time, so it's quick
  const searches = [getHeritagePlaces(centre, maxDistance)];
  for (const point of points) {
    // One point covers the whole area. Five points each cover a smaller patch.
    const radius = points.length === 1 ? maxDistance : maxDistance * 0.5;
    searches.push(getWikipediaPlaces(point, radius));
  }
  const results = await Promise.all(searches);

  // Join the lists together, skipping any place we already have
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
