class SearchComponent {
constructor() {
this.searchInput = document.getElementById("searchInput");
this.resultsList = document.getElementById("resultsList");
this.template = document.getElementById("movieItemTemplate");
this.detailsPanel = document.getElementById("movieDetails");
this.spinner = document.getElementById("loadingSpinner");

this.cache = new Map();
this.debounceTimer = null;
this.abortController = null;
this.selectedIndex = -1;

if (!this.searchInput || !this.resultsList || !this.template || !this.detailsPanel) {
console.error("Missing required DOM elements.");
return;
}


this.searchInput.addEventListener("input", (e) => {
this.handleInput(e.target.value);
});

this.searchInput.addEventListener("keydown", (e) => {
this.handleKeyboard(e);
});
}

// =====================================
// LOADING SPINNER
// =====================================

showLoading() {
if (this.spinner) {
this.spinner.classList.remove("hidden");
}
}

hideLoading() {
if (this.spinner) {
this.spinner.classList.add("hidden");
}
}

// =====================================
// HANDLE INPUT WITH DEBOUNCE
// =====================================

handleInput(query) {
clearTimeout(this.debounceTimer);

this.debounceTimer = setTimeout(() => {
if (query.trim().length === 0) {
this.clearResults();
this.detailsPanel.innerHTML = `
<h2>Movie Details</h2>
<p>Select a movie to view details.</p>
`;
return;
}

this.searchMovies(query.trim());
}, 300);
}


// =====================================
// SEARCH MOVIES
// =====================================

async searchMovies(query) {
if (this.cache.has(query)) {
console.log("Loaded from cache");
this.hideLoading();
this.renderResults(this.cache.get(query), query);
return;
}

try {
this.showLoading();

if (this.abortController) {
this.abortController.abort();
}

this.abortController = new AbortController();

const url = `${SEARCH_URL}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

const response = await fetch(url, {
signal: this.abortController.signal,
});

if (!response.ok) {
throw new Error(`Search request failed: ${response.status}`);
}

const data = await response.json();
const results = data.results || [];

this.cache.set(query, results);

this.renderResults(results, query);
} catch (error) {
if (error.name === "AbortError") {
console.log("Request cancelled");
} else {
console.error("Search error:", error);
this.resultsList.innerHTML = `<li class="movie-item">Unable to load search results.</li>`;
}
} finally {
this.hideLoading();
}
}

// =====================================
// HIGHLIGHT SEARCH TEXT
// =====================================

highlightText(text, query) {
const fragment = document.createDocumentFragment();

const lowerText = text.toLowerCase();
const lowerQuery = query.toLowerCase();

let start = 0;
let index;

while ((index = lowerText.indexOf(lowerQuery, start)) !== -1) {
// normal text
fragment.appendChild(
document.createTextNode(text.slice(start, index))
);

const mark = document.createElement("span");
mark.className = "highlight";
mark.textContent = text.slice(index, index + query.length);

fragment.appendChild(mark);

start = index + query.length;
}

fragment.appendChild(
document.createTextNode(text.slice(start))
);

return fragment;
}

// =====================================
// RENDER SEARCH RESULTS
// =====================================

renderResults(results, query) {
this.selectedIndex = -1;
this.resultsList.innerHTML = "";

if (!results.length) {
this.resultsList.innerHTML = `<li class="movie-item">No movies found.</li>`;
return;
}

const fragment = document.createDocumentFragment();

results.forEach((movie) => {
const clone = this.template.content.cloneNode(true);

const item = clone.querySelector(".movie-item");
const thumbImg = clone.querySelector(".movie-thumb-img");
const thumbFallback = clone.querySelector(".movie-thumb-fallback");
const title = clone.querySelector(".movie-name");
const year = clone.querySelector(".year");
const rating = clone.querySelector(".rating");

const thumbURL = movie.poster_path
? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
: null;

title.textContent = "";
title.appendChild(this.highlightText(movie.title || "Untitled", query));

year.textContent = movie.release_date
? movie.release_date.slice(0, 4)
: "N/A";

rating.textContent = movie.vote_average
? `⭐ ${movie.vote_average.toFixed(1)}`
: "⭐ N/A";

if (thumbURL) {
thumbImg.src = thumbURL;
thumbImg.alt = `${movie.title || "Movie"} poster`;
thumbImg.classList.remove("hidden");

if (thumbFallback) {
thumbFallback.classList.add("hidden");
}
} else {
if (thumbImg) {
thumbImg.classList.add("hidden");
}

if (thumbFallback) {
thumbFallback.classList.remove("hidden");
}
}

item.addEventListener("click", () => {
this.resultsList.querySelectorAll(".movie-item").forEach((el) => {
el.classList.remove("active");
});

item.classList.add("active");
this.loadMovieDetails(movie.id);
});

fragment.appendChild(clone);
});

this.resultsList.appendChild(fragment);
}

// =====================================
// CLEAR RESULTS
// =====================================

clearResults() {
this.resultsList.innerHTML = "";
this.selectedIndex = -1;
}

// =====================================
// LOAD MOVIE DETAILS
// =====================================

async loadMovieDetails(id) {
const detailsURL = `${MOVIE_DETAILS_URL}/${id}?api_key=${TMDB_API_KEY}`;
const creditsURL = `${MOVIE_DETAILS_URL}/${id}/credits?api_key=${TMDB_API_KEY}`;
const videosURL = `${MOVIE_DETAILS_URL}/${id}/videos?api_key=${TMDB_API_KEY}`;

try {
this.showLoading();

const results = await Promise.allSettled([
fetch(detailsURL).then((r) => {
if (!r.ok) throw new Error("Details request failed");
return r.json();
}),
fetch(creditsURL).then((r) => {
if (!r.ok) throw new Error("Credits request failed");
return r.json();
}),
fetch(videosURL).then((r) => {
if (!r.ok) throw new Error("Videos request failed");
return r.json();
}),
]);

const details = results[0].status === "fulfilled" ? results[0].value : null;
const credits = results[1].status === "fulfilled" ? results[1].value : null;
const videos = results[2].status === "fulfilled" ? results[2].value : null;

this.renderMovieDetails(details, credits, videos);
} catch (error) {
console.error("Details error:", error);
this.detailsPanel.innerHTML = `<p>Unable to load movie details.</p>`;
} finally {
this.hideLoading();
}
}

// =====================================
// GET TRAILER
// =====================================

getTrailer(videos) {
if (!videos || !videos.results) return null;

const trailer = videos.results.find(
(video) =>
video.site === "YouTube" &&
(video.type === "Trailer" || video.type === "Teaser")
);

return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

// =====================================
// RENDER MOVIE DETAILS
// =====================================

renderMovieDetails(details, credits, videos) {
if (!details) {
this.detailsPanel.textContent = "Unable to load movie.";
return;
}

const poster = details.poster_path
? `https://image.tmdb.org/t/p/w500${details.poster_path}`
: "https://via.placeholder.com/300x450?text=No+Poster";

const backdrop = details.backdrop_path
? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
: "https://via.placeholder.com/1200x500?text=No+Backdrop";

const genresHTML = details.genres && details.genres.length
? details.genres.map((g) => `<span class="genre-tag">${g.name}</span>`).join("")
: `<span class="genre-tag">N/A</span>`;

const castHTML = credits && credits.cast && credits.cast.length
? credits.cast.slice(0, 5).map((actor) => `
<div class="cast-member">
<div class="cast-avatar">${actor.name.charAt(0)}</div>
<div class="cast-name">${actor.name}</div>
<div class="cast-role">${actor.character || "Unknown Role"}</div>
</div>
`).join("")
: `<p>No cast data available.</p>`;

const trailer = this.getTrailer(videos);

this.detailsPanel.innerHTML = `
<div class="movie-hero">
<img class="movie-backdrop" src="${backdrop}" alt="${details.title} backdrop">
<div class="movie-hero-overlay"></div>

<div class="movie-hero-content">
<img class="movie-poster" src="${poster}" alt="${details.title} poster">

<div class="movie-main-info">
<h1 class="movie-title">${details.title}</h1>
<p class="movie-tagline">${details.tagline || "No tagline available."}</p>

<div class="genre-tags">
${genresHTML}
</div>
</div>
</div>
</div>

<div class="info-card">
<h3>Overview</h3>
<p>${details.overview || "No overview available."}</p>
</div>

<div class="movie-bottom-grid">
<div class="info-card">
<h3>Cast</h3>
<div class="cast-list">
${castHTML}
</div>
</div>

<div class="info-card">
<h3>Movie Info</h3>
<p><strong>Release:</strong> ${details.release_date || "N/A"}</p>
<p><strong>Rating:</strong> ⭐ ${details.vote_average ? details.vote_average.toFixed(1) : "N/A"}</p>
<p><strong>Runtime:</strong> ${details.runtime ? `${details.runtime} mins` : "N/A"}</p>
<p><strong>Language:</strong> ${details.original_language ? details.original_language.toUpperCase() : "N/A"}</p>
<br>
${
trailer
? `<a href="${trailer}" target="_blank" class="trailer-btn">▶ Watch Trailer</a>`
: `<p>No trailer available.</p>`
}
</div>
</div>
`;
}
}

document.addEventListener("DOMContentLoaded", () => {
new SearchComponent();
});