# Can't think of a name

(Working title.) Pick a time and the app sends you to a nearby place with a past.
You only find out what it is when you get there.

## Running it

Open the folder in VS Code and use **Open with Live Server** on `index.html`.
Location only works on `localhost` or `https`, not by double-clicking the file.

## How it works

1. You pick how you're getting there (walk, bike or public transport), how long you've got, and what sort of place you want.
2. The app gets your location and looks for places within reach (there and back).
3. A map shows you, a question mark and the route between you. It follows you as you move and gets a fresh route every 100 metres. The story unlocks within 50 metres.
4. Every place you find is saved on your device under "Finds".

## Where the information comes from

| What | Source |
|---|---|
| Protected places near you (listed buildings, monuments) | Wikidata query service |
| Other historic-sounding places near you | Wikipedia geosearch API |
| The story, photo and older view | Wikipedia REST API (summary and media list) |
| The map | OpenStreetMap tiles (turned grey in CSS), shown with Leaflet |
| Walking and bike routes | FOSSGIS route finder (routing.openstreetmap.de) |
| Public transport | A link that opens Google Maps, as there's no free bus and train planner |
| Backup list of 14 places | `places.js` |

All of these are free and need no API key.

## The files

| File | What it does |
|---|---|
| `index.html` | The four screens: home, on the way, the story, your finds |
| `style.css` | The look |
| `places.js` | The hand-picked backup places and the dropdown themes |
| `finder.js` | Finds places near you from Wikidata and Wikipedia |
| `script.js` | Everything else: screens, map, arriving, saved finds |
| `sw.js`, `manifest.json`, `icons/` | Let people add the app to their phone's home screen |
| `lib/leaflet/`, `fonts/` | The map library and fonts, kept here so nothing relies on a CDN |

## Known limits

- The Wikipedia part uses keywords to guess what's historic, so the odd dull place gets through.
- "An older view" only shows when a picture's caption mentions an old year and how it was made.
- Distance covered is measured in a straight line from where you set off.
- The OpenStreetMap tiles and the route finder are free for light use like this. A real launch would need its own tile and route servers, or a paid plan.
- The page has to stay open with the screen on for live tracking. Phones pause location when the screen locks.
- Public transport has no route on the map, just a link to bus and train times.
- Finds are saved in the browser, so they don't follow you to another device.
