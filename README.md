# Hidden History

Say how long you've got, and the app sends you to somewhere nearby with a past.
You only find out what it is when you get there.

## Running it

Open the folder in VS Code and use **Open with Live Server** on `index.html`.
Location only works on `localhost` or `https`, not by double-clicking the file.

## How it works

1. You pick how you're travelling, how long you've got, and what sort of place you want.
2. The app gets your location and looks for places within reach (there and back).
3. A map shows you and a question mark. The story unlocks within 50 metres of it.
4. Every place you find is saved on your device as a plaque in "Your finds".

## Where the information comes from

| What | Source |
|---|---|
| Protected places near you (listed buildings, monuments) | Wikidata query service |
| Other historic-sounding places near you | Wikipedia geosearch API |
| The story, photo and older view | Wikipedia REST API (summary and media list) |
| The map | OpenStreetMap, shown with Leaflet |
| Directions | A link that opens Google Maps |
| Backup list of 12 places | `places.js` |

All of these are free and need no API key.

## The files

| File | What it does |
|---|---|
| `index.html` | The four screens: home, on the way, the story, your finds |
| `style.css` | The look (blue plaques and enamel signs) |
| `places.js` | The hand-picked backup places and the themes |
| `finder.js` | Finds places near you from Wikidata and Wikipedia |
| `script.js` | Everything else: screens, map, arriving, saved finds |
| `sw.js`, `manifest.json`, `icons/` | Let people add the app to their phone's home screen |
| `lib/leaflet/`, `fonts/` | The map library and fonts, kept here so nothing relies on a CDN |

## Known limits

- The Wikipedia part uses keywords to guess what's historic, so the odd dull place gets through.
- "An older view" only shows when a picture's caption mentions an old year and how it was made.
- Distance covered is measured in a straight line from where you set off.
- Finds are saved in the browser, so they don't follow you to another device.
