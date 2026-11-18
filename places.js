// A small hand-picked list of places around Manchester and Salford.
// The app also finds places live (see finder.js) - this list is the backup,
// and makes sure a few favourites are always included.
//
// "wiki" is the Wikipedia page title. The story loads from there when you arrive.
// Coordinates and descriptions were checked against Wikipedia in November 2026.

const places = [
  { name: "Ordsall Hall",                   wiki: "Ordsall_Hall",                   lat: 53.4693, lng: -2.2776, description: "Historic country house" },
  { name: "Salford Lads' Club",             wiki: "Salford_Lads'_Club",             lat: 53.4769, lng: -2.2744, description: "Recreational club" },
  { name: "Peel Park",                      wiki: "Peel_Park,_Salford",             lat: 53.4875, lng: -2.2706, description: "Urban park" },
  { name: "Working Class Movement Library", wiki: "Working_Class_Movement_Library", lat: 53.4842, lng: -2.2731, description: "Library" },
  { name: "Mamucium Roman fort",            wiki: "Mamucium",                       lat: 53.4760, lng: -2.2500, description: "Former Roman fort" },
  { name: "Peterloo",                       wiki: "Peterloo_Massacre",              lat: 53.4767, lng: -2.2458, description: "1819 massacre" },
  { name: "Guardian telephone exchange",    wiki: "Guardian_telephone_exchange",    lat: 53.4778, lng: -2.2414, description: "Underground telephone exchange" },
  { name: "1996 Manchester bombing",        wiki: "1996_Manchester_bombing",        lat: 53.4836, lng: -2.2433, description: "IRA attack" },
  { name: "St Ann's Church",                wiki: "St_Ann's_Church,_Manchester",    lat: 53.4817, lng: -2.2458, description: "Parish church" },
  { name: "Chetham's Library",              wiki: "Chetham's_Library",              lat: 53.4866, lng: -2.2439, description: "Library" },
  { name: "The Old Wellington Inn",         wiki: "The_Old_Wellington_Inn",         lat: 53.4847, lng: -2.2440, description: "Listed pub" },
  { name: "Alan Turing Memorial",           wiki: "Alan_Turing_Memorial",           lat: 53.4767, lng: -2.2360, description: "Memorial statue" },
  { name: "Elizabeth Gaskell's House",      wiki: "84_Plymouth_Grove",              lat: 53.4636, lng: -2.2211, description: "Historic house" },
  { name: "Victoria Baths",                 wiki: "Victoria_Baths",                 lat: 53.4600, lng: -2.2160, description: "Historical bathing venue" }
];


// The kinds of place in the dropdown on the home screen.
// A place matches if its name or description contains one of the words.
const themes = {
  anything:    [],
  interesting: ["massacre", "attack", "bombing", "riot", "disaster", "explosion", "battle",
                "siege", "fire", "protest", "strike", "crash", "flood", "exhibition",
                "underground", "secret", "hidden", "demolished", "site of"],
  churches:    ["church", "chapel", "cathedral", "abbey", "priory", "synagogue", "mosque"],
  pubs:        ["pub", "inn", "tavern", "public house", "brewery"],
  memorials:   ["memorial", "statue", "monument", "sculpture", "cenotaph"],
  houses:      ["hall", "house", "manor", "castle", "villa"],
  industry:    ["mill", "warehouse", "canal", "railway", "viaduct", "bridge", "factory", "dock", "docks", "locks"]
};
