//These store references to HTML elements for reusability
let searchInput = null;
let resultsList = null;
let template = null;
let detailsPanel = null;
let spinner = null;
let searchStatus = null;
let detailEmpty = null;

let cache = new Map();
let abortController = null;
let detailsAbortController = null;
let selectedIndex = -1;
let currentResults = [];

let lastQuery = "";
//Grabs all required DOM elements & check if they exist
function init() {
searchInput = document.getElementById("searchInput");
resultsList = document.getElementById("resultsList");
template = document.getElementById("movieItemTemplate");
detailsPanel = document.getElementById("movieDetails");
spinner = document.getElementById("loadingSpinner");
searchStatus = document.getElementById("searchStatus");
detailEmpty = document.getElementById("detail-empty");

if (!searchInput || !resultsList || !template || !detailsPanel) {
console.error("Missing required DOM elements.");
return;
}

bindEvents();
setSearchStatus("Ready");
}

//attaches two key listeners to the search input
function bindEvents() {
searchInput.addEventListener(//triggers search with debounce
"input",
debounce((e) => {
handleInput(e.target.value);
}, 300)
);
//handles keyboard navigation
searchInput.addEventListener("keydown", (e) => {
if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
e.preventDefault();
}

handleKeyboard(e);
});
}

function debounce(fn, delay = 300) {//ensures 300 delay debounce
let timer = null;

return (...args) => {
clearTimeout(timer);
timer = setTimeout(() => {
fn(...args);
}, delay);
};
}


function showLoading() {
if (spinner) {
spinner.classList.remove("hidden");
}

if (searchInput) {
searchInput.setAttribute("data-loading", "true");
searchInput.setAttribute("aria-busy", "true");
}
}

function hideLoading() {
if (spinner) {
spinner.classList.add("hidden");
}

if (searchInput) {
searchInput.setAttribute("data-loading", "false");
searchInput.setAttribute("aria-busy", "false");
}
}

function setSearchStatus(message) {
if (!searchStatus) return;
searchStatus.textContent = message;
}

function updatePromiseStatus(resolved, total) {
if (!searchStatus) return;
searchStatus.textContent = `Promise.allSettled · ${resolved}/${total} resolved`;
}

function createTextNodeSafe(value, fallback = "") {
return document.createTextNode(value || fallback);
}


function handleInput(query) {
const trimmed = query.trim();
lastQuery = trimmed;

if (trimmed.length === 0) {
abortActiveSearch();
clearResults();
resetDetailsPanel();
setSearchStatus("Ready");
return;
}

searchMovies(trimmed);
}

function abortActiveSearch() {
if (abortController) {
abortController.abort();
}
}

function abortActiveDetailsRequest() {
if (detailsAbortController) {
detailsAbortController.abort();
}
}

async function searchMovies(query) {
if (cache.has(query)) {
const cachedResults = cache.get(query);
currentResults = cachedResults;
renderResults(cachedResults, query);
setSearchStatus(
`Cache hit · ${cachedResults.length} result${cachedResults.length === 1 ? "" : "s"}`
);
return;
}

try {
showLoading();
setSearchStatus("Searching...");

abortActiveSearch();
abortController = new AbortController();

const url = `${SEARCH_URL}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

const response = await fetch(url, {
signal: abortController.signal,
});

if (!response.ok) {
throw new Error(`Search request failed: ${response.status}`);
}

const data = await response.json();
const results = Array.isArray(data.results) ? data.results : [];

cache.set(query, results);
currentResults = results;

if (lastQuery !== query) {
return;
}

renderResults(results, query);
setSearchStatus(`Loaded · ${results.length} result${results.length === 1 ? "" : "s"}`);
} catch (error) {
if (error.name === "AbortError") {
console.log("Search request cancelled");
return;
}

console.error("Search error:", error);
resultsList.innerHTML = `<li class="movie-item">Unable to load search results.</li>`;
setSearchStatus("Search failed");
} finally {
hideLoading();
}
}

function handleKeyboard(event) {
const items = resultsList.querySelectorAll(".movie-item[data-result-item='true']");
if (items.length === 0) return;

if (event.key === "ArrowDown") {
event.preventDefault();

if (selectedIndex < 0) {
selectedIndex = 0;
} else {
selectedIndex++;
if (selectedIndex >= items.length) {
selectedIndex = 0;
}
}

updateSelection(items);
return;
}

if (event.key === "ArrowUp") {
event.preventDefault();

if (selectedIndex < 0) {
selectedIndex = items.length - 1;
} else {
selectedIndex--;
if (selectedIndex < 0) {
selectedIndex = items.length - 1;
}
}

updateSelection(items);
return;
}

if (event.key === "Enter") {
if (selectedIndex >= 0 && items[selectedIndex]) {
event.preventDefault();
items[selectedIndex].click();
}
return;
}

if (event.key === "Escape") {
event.preventDefault();
clearSelection(items);
searchInput.focus();
}
}

function updateSelection(items) {
items.forEach((item) => {
item.classList.remove("selected");
item.setAttribute("aria-selected", "false");
item.setAttribute("tabindex", "-1");
});

if (selectedIndex >= 0 && items[selectedIndex]) {
const activeItem = items[selectedIndex];
activeItem.classList.add("selected");
activeItem.setAttribute("aria-selected", "true");
activeItem.setAttribute("tabindex", "0");

activeItem.scrollIntoView({
block: "nearest",
});
}
}

function clearSelection(items) {
selectedIndex = -1;

items.forEach((item) => {
item.classList.remove("selected");
item.setAttribute("aria-selected", "false");
item.setAttribute("tabindex", "-1");
});
}


function highlightText(text, query) {
const fragment = document.createDocumentFragment();

const safeText = String(text || "Untitled");
const safeQuery = String(query || "").trim();

if (!safeQuery) {
fragment.appendChild(document.createTextNode(safeText));
return fragment;
}

const lowerText = safeText.toLowerCase();
const lowerQuery = safeQuery.toLowerCase();

let start = 0;
let index;

while ((index = lowerText.indexOf(lowerQuery, start)) !== -1) {
fragment.appendChild(document.createTextNode(safeText.slice(start, index)));

const mark = document.createElement("span");
mark.className = "highlight";
mark.textContent = safeText.slice(index, index + safeQuery.length);

fragment.appendChild(mark);
start = index + safeQuery.length;
}

fragment.appendChild(document.createTextNode(safeText.slice(start)));
return fragment;
}

function renderResults(results, query) {
selectedIndex = -1;
resultsList.innerHTML = "";

if (!Array.isArray(results) || results.length === 0) {
resultsList.innerHTML = `<li class="movie-item">No movies found.</li>`;
return;
}

const fragment = document.createDocumentFragment();

results.forEach((movie, index) => {
const clone = template.content.cloneNode(true);

const item = clone.querySelector(".movie-item");
const thumbImg = clone.querySelector(".movie-thumb-img");
const thumbFallback = clone.querySelector(".movie-thumb-fallback");
const title = clone.querySelector(".movie-name");
const year = clone.querySelector(".year");
const rating = clone.querySelector(".rating");

if (!item || !title || !year || !rating) return;

const movieTitle = movie?.title || "Untitled";
const releaseYear = movie?.release_date ? movie.release_date.slice(0, 4) : "N/A";
const voteAverage =
typeof movie?.vote_average === "number" && movie.vote_average > 0
? `⭐ ${movie.vote_average.toFixed(1)}`
: "⭐ N/A";

const thumbURL = movie?.poster_path
? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
: null;

item.setAttribute("data-result-item", "true");
item.setAttribute("data-index", String(index));
item.setAttribute("role", "option");
item.setAttribute("aria-selected", "false");
item.setAttribute("tabindex", "-1");

title.textContent = "";
title.appendChild(highlightText(movieTitle, query));

year.textContent = releaseYear;
rating.textContent = voteAverage;

if (thumbURL && thumbImg) {
thumbImg.src = thumbURL;
thumbImg.alt = `${movieTitle} poster`;
thumbImg.classList.remove("hidden");

thumbImg.onerror = () => {
thumbImg.classList.add("hidden");
if (thumbFallback) thumbFallback.classList.remove("hidden");
};

if (thumbFallback) {
thumbFallback.classList.add("hidden");
}
} else {
if (thumbImg) {
thumbImg.classList.add("hidden");
thumbImg.removeAttribute("src");
}

if (thumbFallback) {
thumbFallback.classList.remove("hidden");
}
}

item.addEventListener("click", () => {
resultsList.querySelectorAll(".movie-item").forEach((el) => {
el.classList.remove("active");
});

item.classList.add("active");
selectedIndex = index;
loadMovieDetails(movie.id);
});

item.addEventListener("mouseenter", () => {
selectedIndex = index;
const liveItems = resultsList.querySelectorAll(".movie-item[data-result-item='true']");
updateSelection(liveItems);
});

fragment.appendChild(clone);
});

resultsList.appendChild(fragment);
}


function clearResults() {
resultsList.innerHTML = "";
selectedIndex = -1;
currentResults = [];
}

function resetDetailsPanel() {
if (detailEmpty) {
detailsPanel.innerHTML = "";
detailsPanel.appendChild(detailEmpty.cloneNode(true));
return;
}

detailsPanel.innerHTML = `
<h2>Movie Details</h2>
<p>Select a movie to view details.</p>
`;
}

async function loadMovieDetails(id) {
if (!id) return;

const detailsURL = `${MOVIE_DETAILS_URL}/${id}?api_key=${TMDB_API_KEY}`;
const creditsURL = `${MOVIE_DETAILS_URL}/${id}/credits?api_key=${TMDB_API_KEY}`;
const videosURL = `${MOVIE_DETAILS_URL}/${id}/videos?api_key=${TMDB_API_KEY}`;

try {
showLoading();

abortActiveDetailsRequest();
detailsAbortController = new AbortController();

const { signal } = detailsAbortController;

updatePromiseStatus(0, 3);

const results = await Promise.allSettled([
fetch(detailsURL, { signal }).then((r) => {
if (!r.ok) throw new Error("Details request failed");
return r.json();
}),
fetch(creditsURL, { signal }).then((r) => {
if (!r.ok) throw new Error("Credits request failed");
return r.json();
}),
fetch(videosURL, { signal }).then((r) => {
if (!r.ok) throw new Error("Videos request failed");
return r.json();
}),
]);

const resolvedCount = results.filter((result) => result.status === "fulfilled").length;
updatePromiseStatus(resolvedCount, results.length);

const details = results[0].status === "fulfilled" ? results[0].value : null;
const credits = results[1].status === "fulfilled" ? results[1].value : null;
const videos = results[2].status === "fulfilled" ? results[2].value : null;

renderMovieDetails(details, credits, videos);
} catch (error) {
if (error.name === "AbortError") {
console.log("Details request cancelled");
return;
}

console.error("Details error:", error);
detailsPanel.innerHTML = `<p>Unable to load movie details.</p>`;
updatePromiseStatus(0, 3);
} finally {
hideLoading();
}
}

function getTrailer(videos) {
if (!videos || !Array.isArray(videos.results)) return null;

const trailer = videos.results.find(
(video) =>
video.site === "YouTube" &&
(video.type === "Trailer" || video.type === "Teaser")
);

return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

function createGenreTags(genres) {
const wrapper = document.createElement("div");
wrapper.className = "genre-tags";

if (Array.isArray(genres) && genres.length > 0) {
genres.forEach((genre) => {
const tag = document.createElement("span");
tag.className = "genre-tag";
tag.textContent = genre?.name || "N/A";
wrapper.appendChild(tag);
});
} else {
const tag = document.createElement("span");
tag.className = "genre-tag";
tag.textContent = "N/A";
wrapper.appendChild(tag);
}

return wrapper;
}

function createCastList(credits) {
const castList = document.createElement("div");
castList.className = "cast-list";

if (credits && Array.isArray(credits.cast) && credits.cast.length > 0) {
credits.cast.slice(0, 5).forEach((actor) => {
const member = document.createElement("div");
member.className = "cast-member";

const avatar = document.createElement("div");
avatar.className = "cast-avatar";
avatar.textContent = (actor?.name || "?").charAt(0);

const name = document.createElement("div");
name.className = "cast-name";
name.textContent = actor?.name || "Unknown";

const role = document.createElement("div");
role.className = "cast-role";
role.textContent = actor?.character || "Unknown Role";

member.appendChild(avatar);
member.appendChild(name);
member.appendChild(role);
castList.appendChild(member);
});
} else {
const noCast = document.createElement("p");
noCast.textContent = "No cast data available.";
castList.appendChild(noCast);
}

return castList;
}

function renderMovieDetails(details, credits, videos) {
if (!details) {
detailsPanel.textContent = "Unable to load movie.";
return;
}

const poster = details.poster_path
? `https://image.tmdb.org/t/p/w500${details.poster_path}`
: "https://via.placeholder.com/300x450?text=No+Poster";

const backdrop = details.backdrop_path
? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
: "https://via.placeholder.com/1200x500?text=No+Backdrop";

const trailer = getTrailer(videos);

detailsPanel.innerHTML = "";

const hero = document.createElement("div");
hero.className = "movie-hero";

const backdropImg = document.createElement("img");
backdropImg.className = "movie-backdrop";
backdropImg.src = backdrop;
backdropImg.alt = `${details.title || "Movie"} backdrop`;

const overlay = document.createElement("div");
overlay.className = "movie-hero-overlay";

const heroContent = document.createElement("div");
heroContent.className = "movie-hero-content";

const posterImg = document.createElement("img");
posterImg.className = "movie-poster";
posterImg.src = poster;
posterImg.alt = `${details.title || "Movie"} poster`;

const mainInfo = document.createElement("div");
mainInfo.className = "movie-main-info";

const title = document.createElement("h1");
title.className = "movie-title";
title.textContent = details.title || "Untitled";

const tagline = document.createElement("p");
tagline.className = "movie-tagline";
tagline.textContent = details.tagline || "No tagline available.";

const genreTags = createGenreTags(details.genres);

mainInfo.appendChild(title);
mainInfo.appendChild(tagline);
mainInfo.appendChild(genreTags);

heroContent.appendChild(posterImg);
heroContent.appendChild(mainInfo);

hero.appendChild(backdropImg);
hero.appendChild(overlay);
hero.appendChild(heroContent);

const overviewCard = document.createElement("div");
overviewCard.className = "info-card";

const overviewHeading = document.createElement("h3");
overviewHeading.textContent = "Overview";

const overviewText = document.createElement("p");
overviewText.textContent = details.overview || "No overview available.";

overviewCard.appendChild(overviewHeading);
overviewCard.appendChild(overviewText);

const bottomGrid = document.createElement("div");
bottomGrid.className = "movie-bottom-grid";

const castCard = document.createElement("div");
castCard.className = "info-card";

const castHeading = document.createElement("h3");
castHeading.textContent = "Cast";

const castList = createCastList(credits);

castCard.appendChild(castHeading);
castCard.appendChild(castList);

const infoCard = document.createElement("div");
infoCard.className = "info-card";

const infoHeading = document.createElement("h3");
infoHeading.textContent = "Movie Info";

const release = document.createElement("p");
release.innerHTML = `<strong>Release:</strong> ${details.release_date || "N/A"}`;

const rating = document.createElement("p");
rating.innerHTML = `<strong>Rating:</strong> ⭐ ${
typeof details.vote_average === "number" && details.vote_average > 0
? details.vote_average.toFixed(1)
: "N/A"
}`;

const runtime = document.createElement("p");
runtime.innerHTML = `<strong>Runtime:</strong> ${
details.runtime ? `${details.runtime} mins` : "N/A"
}`;

const language = document.createElement("p");
language.innerHTML = `<strong>Language:</strong> ${
details.original_language ? details.original_language.toUpperCase() : "N/A"
}`;

infoCard.appendChild(infoHeading);
infoCard.appendChild(release);
infoCard.appendChild(rating);
infoCard.appendChild(runtime);
infoCard.appendChild(language);
infoCard.appendChild(document.createElement("br"));

if (trailer) {
const trailerLink = document.createElement("a");
trailerLink.href = trailer;
trailerLink.target = "_blank";
trailerLink.rel = "noopener noreferrer";
trailerLink.className = "trailer-btn";
trailerLink.textContent = "▶ Watch Trailer";
infoCard.appendChild(trailerLink);
} else {
const noTrailer = document.createElement("p");
noTrailer.textContent = "No trailer available.";
infoCard.appendChild(noTrailer);
}

bottomGrid.appendChild(castCard);
bottomGrid.appendChild(infoCard);

detailsPanel.appendChild(hero);
detailsPanel.appendChild(overviewCard);
detailsPanel.appendChild(bottomGrid);
}

document.addEventListener("DOMContentLoaded", () => {
init();
});


