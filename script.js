document.addEventListener("DOMContentLoaded", () => {
const MovieSearchApp = {
elements: {
searchInput: null,
resultsList: null,
template: null,
detailsPanel: null,
spinner: null,
searchStatus: null,
detailEmpty: null,
appContainer: null,
},

state: {
cache: new Map(),
abortController: null,
detailsAbortController: null,
selectedIndex: -1,
currentResults: [],
lastQuery: "",
},


init() {
this.elements.searchInput = document.getElementById("searchInput");
this.elements.resultsList = document.getElementById("resultsList");
this.elements.template = document.getElementById("movieItemTemplate");
this.elements.detailsPanel = document.getElementById("movieDetails");
this.elements.spinner = document.getElementById("loadingSpinner");
this.elements.searchStatus = document.getElementById("searchStatus");
this.elements.detailEmpty = document.getElementById("detail-empty");
this.elements.appContainer = document.querySelector(".app-shell");

const {
searchInput,
resultsList,
template,
detailsPanel,
} = this.elements;

if (!searchInput || !resultsList || !template || !detailsPanel) {
console.error("Missing required DOM elements.");
return;
}

this.bindEvents();
this.setSearchStatus("Ready");
this.resetDetailsPanel();
},


bindEvents() {
const { searchInput } = this.elements;

searchInput.addEventListener(
"input",
this.debounce((e) => {
this.handleInput(e.target.value);
}, 300)
);

searchInput.addEventListener("keydown", (e) => {
if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
e.preventDefault();
}

this.handleKeyboard(e);
});
},

debounce(fn, delay = 300) {
let timer = null;

return (...args) => {
clearTimeout(timer);
timer = setTimeout(() => {
fn(...args);
}, delay);
};
},


showLoading() {
const { spinner, searchInput, appContainer } = this.elements;

if (spinner) {
spinner.classList.remove("hidden");
}

if (searchInput) {
if (appContainer) {
appContainer.setAttribute("data-loading", "true");
}
searchInput.setAttribute("aria-busy", "true");
}
},

hideLoading() {
const { spinner, searchInput, appContainer } = this.elements;

if (spinner) {
spinner.classList.add("hidden");
}

if (searchInput) {
if (appContainer) {
appContainer.setAttribute("data-loading", "false");
}
searchInput.setAttribute("aria-busy", "false");
}
},

setSearchStatus(message) {
const { searchStatus } = this.elements;
if (!searchStatus) return;
searchStatus.textContent = message;
},

updatePromiseStatus(resolved, total) {
const { searchStatus } = this.elements;
if (!searchStatus) return;
searchStatus.textContent = `Promise.allSettled · ${resolved}/${total} resolved`;
},

createTextNodeSafe(value, fallback = "") {
return document.createTextNode(value || fallback);
},


handleInput(query) {
const trimmed = query.trim();
this.state.lastQuery = trimmed;

if (trimmed.length === 0) {
this.abortActiveSearch();
this.clearResults();
this.resetDetailsPanel();
this.setSearchStatus("Ready");
return;
}

this.searchMovies(trimmed);
},

abortActiveSearch() {
if (this.state.abortController) {
this.state.abortController.abort();
}
},

abortActiveDetailsRequest() {
if (this.state.detailsAbortController) {
this.state.detailsAbortController.abort();
}
},

async searchMovies(query) {
const { resultsList } = this.elements;
const { cache } = this.state;

if (cache.has(query)) {
const cachedResults = cache.get(query);
this.state.currentResults = cachedResults;
this.renderResults(cachedResults, query);
this.setSearchStatus(
`Cache hit · ${cachedResults.length} result${cachedResults.length === 1 ? "" : "s"}`
);
return;
}

try {
this.showLoading();
this.setSearchStatus("Searching...");

this.abortActiveSearch();
this.state.abortController = new AbortController();

const url = `${SEARCH_URL}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

const response = await fetch(url, {
signal: this.state.abortController.signal,
});

if (!response.ok) {
throw new Error(`Search request failed: ${response.status}`);
}

const data = await response.json();
const results = Array.isArray(data.results) ? data.results : [];

cache.set(query, results);
this.state.currentResults = results;

if (this.state.lastQuery !== query) {
return;
}

this.renderResults(results, query);
this.setSearchStatus(
`Loaded · ${results.length} result${results.length === 1 ? "" : "s"}`
);
} catch (error) {
if (error.name === "AbortError") {
console.log("Search request cancelled");
return;
}

console.error("Search error:", error);
if (resultsList) {
resultsList.innerHTML = `<li class="movie-item">Unable to load search results.</li>`;
}
this.setSearchStatus("Search failed");
} finally {
this.hideLoading();
}
},

handleKeyboard(event) {
const { resultsList, searchInput } = this.elements;
const items = resultsList.querySelectorAll(".movie-item[data-result-item='true']");
if (items.length === 0) return;

if (event.key === "ArrowDown") {
event.preventDefault();

if (this.state.selectedIndex < 0) {
this.state.selectedIndex = 0;
} else {
this.state.selectedIndex++;
if (this.state.selectedIndex >= items.length) {
this.state.selectedIndex = 0;
}
}

this.updateSelection(items);
return;
}

if (event.key === "ArrowUp") {
event.preventDefault();

if (this.state.selectedIndex < 0) {
this.state.selectedIndex = items.length - 1;
} else {
this.state.selectedIndex--;
if (this.state.selectedIndex < 0) {
this.state.selectedIndex = items.length - 1;
}
}

this.updateSelection(items);
return;
}

if (event.key === "Enter") {
if (this.state.selectedIndex >= 0 && items[this.state.selectedIndex]) {
event.preventDefault();
items[this.state.selectedIndex].click();
}
return;
}

if (event.key === "Escape") {
event.preventDefault();
this.clearSelection(items);
searchInput.focus();
}
},

updateSelection(items) {
items.forEach((item) => {
item.classList.remove("selected");
item.setAttribute("aria-selected", "false");
item.setAttribute("tabindex", "-1");
});

if (this.state.selectedIndex >= 0 && items[this.state.selectedIndex]) {
const activeItem = items[this.state.selectedIndex];
activeItem.classList.add("selected");
activeItem.setAttribute("aria-selected", "true");
activeItem.setAttribute("tabindex", "0");

activeItem.scrollIntoView({
block: "nearest",
});
}
},

clearSelection(items) {
this.state.selectedIndex = -1;

items.forEach((item) => {
item.classList.remove("selected");
item.setAttribute("aria-selected", "false");
item.setAttribute("tabindex", "-1");
});
},

highlightText(text, query) {
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
},

renderResults(results, query) {
const { resultsList, template } = this.elements;

this.state.selectedIndex = -1;
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
title.appendChild(this.highlightText(movieTitle, query));

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
this.state.selectedIndex = index;
this.loadMovieDetails(movie.id);
});

item.addEventListener("mouseenter", () => {
this.state.selectedIndex = index;
const liveItems = resultsList.querySelectorAll(".movie-item[data-result-item='true']");
this.updateSelection(liveItems);
});

fragment.appendChild(clone);
});

resultsList.appendChild(fragment);
},

clearResults() {
const { resultsList } = this.elements;
resultsList.innerHTML = "";
this.state.selectedIndex = -1;
this.state.currentResults = [];
},

resetDetailsPanel() {
const { detailEmpty, detailsPanel } = this.elements;

if (detailEmpty) {
detailsPanel.innerHTML = "";
detailsPanel.appendChild(detailEmpty.cloneNode(true));
return;
}

detailsPanel.innerHTML = `
<h2>Movie Details</h2>
<p>Select a movie to view details.</p>
`;
},

async loadMovieDetails(id) {
const { detailsPanel } = this.elements;
if (!id) return;

const detailsURL = `${MOVIE_DETAILS_URL}/${id}?api_key=${TMDB_API_KEY}`;
const creditsURL = `${MOVIE_DETAILS_URL}/${id}/credits?api_key=${TMDB_API_KEY}`;
const videosURL = `${MOVIE_DETAILS_URL}/${id}/videos?api_key=${TMDB_API_KEY}`;

try {
this.showLoading();

this.abortActiveDetailsRequest();
this.state.detailsAbortController = new AbortController();

const { signal } = this.state.detailsAbortController;

this.updatePromiseStatus(0, 3);

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
this.updatePromiseStatus(resolvedCount, results.length);

const details = results[0].status === "fulfilled" ? results[0].value : null;
const credits = results[1].status === "fulfilled" ? results[1].value : null;
const videos = results[2].status === "fulfilled" ? results[2].value : null;

this.renderMovieDetails(details, credits, videos);
} catch (error) {
if (error.name === "AbortError") {
console.log("Details request cancelled");
return;
}

console.error("Details error:", error);
detailsPanel.innerHTML = `<p>Unable to load movie details.</p>`;
this.updatePromiseStatus(0, 3);
} finally {
this.hideLoading();
}
},

getTrailer(videos) {
if (!videos || !Array.isArray(videos.results)) return null;

const trailer = videos.results.find(
(video) =>
video.site === "YouTube" &&
(video.type === "Trailer" || video.type === "Teaser")
);

return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
},

createGenreTags(genres) {
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
},

createCastList(credits) {
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
},

renderMovieDetails(details, credits, videos) {
const { detailsPanel } = this.elements;

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

const trailer = this.getTrailer(videos);

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

const genreTags = this.createGenreTags(details.genres);

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

const castList = this.createCastList(credits);

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
},
};

MovieSearchApp.init();
});