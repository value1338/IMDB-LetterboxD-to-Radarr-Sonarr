/* Letterboxd – extract movie data with multi-fallback ID chain */

function arrExtractData() {
  let lookupTerm = null;
  let ids = {};
  let type = ARR.TYPE.MOVIE;
  let service = ARR.SERVICE.RADARR;

  // Fallback chain (inspired by reference plugin):
  // 1. IMDb link on the page → imdb:ttXXX (most precise for Radarr)
  const imdbLink = document.querySelector('a[href*="imdb.com/title/"]');
  if (imdbLink) {
    const m = imdbLink.href.match(/(tt\d+)/);
    if (m) {
      ids.imdbId = m[1];
      lookupTerm = `imdb:${m[1]}`;
    }
  }

  // 2. data-tmdb-id body attribute → tmdb:XXX
  const tmdbId = document.body.dataset.tmdbId;
  if (tmdbId) {
    ids.tmdbId = parseInt(tmdbId, 10);
    if (!lookupTerm) lookupTerm = `tmdb:${tmdbId}`;
  }

  // 3. Check for TMDB TV link (Letterboxd occasionally has TV content via lists)
  const tmdbTvLink = document.querySelector('a[href*="themoviedb.org/tv/"]');
  if (tmdbTvLink) {
    type = ARR.TYPE.SERIES;
    service = ARR.SERVICE.SONARR;
    const m = tmdbTvLink.href.match(/\/(\d+)(?:\/|$)/);
    if (m && !lookupTerm) lookupTerm = `tmdb:${m[1]}`;
  }

  // 4. Check for TMDB movie link as additional confirmation
  const tmdbMovieLink = document.querySelector('a[href*="themoviedb.org/movie/"]');
  if (tmdbMovieLink && !tmdbTvLink) {
    type = ARR.TYPE.MOVIE;
    service = ARR.SERVICE.RADARR;
  }

  if (!lookupTerm) return null;

  // Title
  const titleEl =
    document.querySelector('.headline-1 .name') ||
    document.querySelector('[itemprop="name"]') ||
    document.querySelector('h1');
  const title = titleEl ? titleEl.textContent.trim() : 'Unknown Title';

  // Year
  const yearEl =
    document.querySelector('.releaseyear a') ||
    document.querySelector('small.number a');
  const year = yearEl ? yearEl.textContent.trim() : '';

  // For Sonarr, use title search instead of ID (Sonarr doesn't support tmdb: prefix well)
  if (service === ARR.SERVICE.SONARR) {
    lookupTerm = title;
  }

  return {
    type,
    service,
    title,
    year,
    lookupTerm,
    ids,
    source: 'letterboxd',
  };
}

function arrGetInjectionPoint() {
  return document.querySelector('[data-type=film] .js-actions-panel');
}

function arrWrapTrigger(button, parent) {
  button.classList.add('arr-ext-trigger--letterboxd');
  const li = document.createElement('li');
  li.appendChild(button);
  parent.insertBefore(li, parent.children[0]);
}
