// =====================================
// DOM ELEMENTS
// =====================================
const searchInput = document.getElementById("searchInput");
const resultsList = document.getElementById("resultsList");
const template = document.getElementById("movieItemTemplate");
const detailsPanel = document.getElementById("movieDetails");
const spinner = document.getElementById("loadingSpinner");
const searchStatus = document.getElementById("searchStatus");
// =====================================
// STATE
// =====================================
const cache = new Map();
let debounceTimer = null;
let abortController = null;
let selectedIndex = -1;

// =====================================
// INIT CHECK
// =====================================
if (!searchInput || !resultsList || !template || !detailsPanel) {
console.error("Missing required DOM elements.");
} else {
searchInput.addEventListener("input", (e) => {
handleInput(e.target.value);
});

searchInput.addEventListener("keydown", (e) => {
handleKeyboard(e);
});
}

// =====================================
// LOADING SPINNER
// =====================================
function showLoading() {
if (spinner) {
spinner.classList.remove("hidden");
}
}

function hideLoading() {
if (spinner) {
spinner.classList.add("hidden");
}
}

// =====================================
// PROMISE STATUS
// =====================================
function updatePromiseStatus(resolved, total) {
  if (!searchStatus) return;

  searchStatus.textContent = `Promise.allSettled · ${resolved}/${total} resolved`;
}
// =====================================
// HANDLE INPUT WITH DEBOUNCE
// =====================================
function handleInput(query) {
clearTimeout(debounceTimer);

debounceTimer = setTimeout(() => {
if (query.trim().length === 0) {
clearResults();
detailsPanel.innerHTML = `
<h2>Movie Details</h2>
<p>Select a movie to view details.</p>
`;
return;
}

searchMovies(query.trim());
}, 300);
}

// =====================================
// SEARCH MOVIES
// =====================================
async function searchMovies(query) {
if (cache.has(query)) {
console.log("Loaded from cache");
hideLoading();
renderResults(cache.get(query), query);
return;
}

try {
showLoading();

if (abortController) {
abortController.abort();
}

abortController = new AbortController();

const url = `${SEARCH_URL}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

const response = await fetch(url, {
signal: abortController.signal,
});

if (!response.ok) {
throw new Error(`Search request failed: ${response.status}`);
}

const data = await response.json();
const results = data.results || [];

cache.set(query, results);

renderResults(results, query);
} catch (error) {
if (error.name === "AbortError") {
console.log("Request cancelled");
} else {
console.error("Search error:", error);
resultsList.innerHTML = `<li class="movie-item">Unable to load search results.</li>`;
}
} finally {
hideLoading();
}
}

// =====================================
// KEYBOARD NAVIGATION
// =====================================
function handleKeyboard(event) {
const items = resultsList.querySelectorAll(".movie-item");

if (items.length === 0) return;

if (event.key === "ArrowDown") {
event.preventDefault();

selectedIndex++;

if (selectedIndex >= items.length) {
selectedIndex = 0;
}

updateSelection(items);
}

if (event.key === "ArrowUp") {
event.preventDefault();

selectedIndex--;

if (selectedIndex < 0) {
selectedIndex = items.length - 1;
}

updateSelection(items);
}

if (event.key === "Enter") {
if (selectedIndex >= 0) {
event.preventDefault();
items[selectedIndex].click();
}
}
}

function updateSelection(items) {
items.forEach((item) => item.classList.remove("selected"));

if (selectedIndex >= 0) {
items[selectedIndex].classList.add("selected");

items[selectedIndex].scrollIntoView({
block: "nearest",
});
}
}

// =====================================
// HIGHLIGHT SEARCH TEXT
// =====================================
function highlightText(text, query) {
const fragment = document.createDocumentFragment();

const lowerText = text.toLowerCase();
const lowerQuery = query.toLowerCase();

let start = 0;
let index;

while ((index = lowerText.indexOf(lowerQuery, start)) !== -1) {
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
function renderResults(results, query) {
selectedIndex = -1;
resultsList.innerHTML = "";

if (!results.length) {
resultsList.innerHTML = `<li class="movie-item">No movies found.</li>`;
return;
}

const fragment = document.createDocumentFragment();

results.forEach((movie) => {
const clone = template.content.cloneNode(true);

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
title.appendChild(highlightText(movie.title || "Untitled", query));

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
resultsList.querySelectorAll(".movie-item").forEach((el) => {
el.classList.remove("active");
});

item.classList.add("active");
loadMovieDetails(movie.id);
});

fragment.appendChild(clone);
});

resultsList.appendChild(fragment);
}

// =====================================
// CLEAR RESULTS
// =====================================
function clearResults() {
resultsList.innerHTML = "";
selectedIndex = -1;
}

// =====================================
// LOAD MOVIE DETAILS
// =====================================
async function loadMovieDetails(id) {
  const detailsURL = `${MOVIE_DETAILS_URL}/${id}?api_key=${TMDB_API_KEY}`;
  const creditsURL = `${MOVIE_DETAILS_URL}/${id}/credits?api_key=${TMDB_API_KEY}`;
  const videosURL = `${MOVIE_DETAILS_URL}/${id}/videos?api_key=${TMDB_API_KEY}`;

  try {
    showLoading();

    // show pending state BEFORE Promise.allSettled runs
    updatePromiseStatus(0, 3);

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

    // count how many resolved successfully
    const resolvedCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length;

    // update AFTER Promise.allSettled finishes
    updatePromiseStatus(resolvedCount, results.length);

    const details = results[0].status === "fulfilled" ? results[0].value : null;
    const credits = results[1].status === "fulfilled" ? results[1].value : null;
    const videos = results[2].status === "fulfilled" ? results[2].value : null;

    renderMovieDetails(details, credits, videos);
  } catch (error) {
    console.error("Details error:", error);
    detailsPanel.innerHTML = `<p>Unable to load movie details.</p>`;

    // if something unexpected happens outside allSettled
    updatePromiseStatus(0, 3);
  } finally {
    hideLoading();
  }
}

// =====================================
// GET TRAILER
// =====================================
function getTrailer(videos) {
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

const trailer = getTrailer(videos);

detailsPanel.innerHTML = `
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