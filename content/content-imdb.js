/* IMDb – extract movie/series data with multi-strategy type detection */

function arrExtractData() {
  // Strategy 1: IMDb ID from canonical link (most reliable)
  let imdbId = null;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    const m = canonical.href.match(/(tt\d{5,10})/i);
    if (m) imdbId = m[1];
  }
  // Fallback: from URL
  if (!imdbId) {
    const urlMatch = window.location.pathname.match(/\/title\/(tt\d+)/);
    if (urlMatch) imdbId = urlMatch[1];
  }
  if (!imdbId) return null;

  let type = null;
  let title = '';

  // Strategy 2: og:type meta tag (fast, reliable, used by reference plugin)
  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType) {
    const val = (ogType.content || '').toLowerCase();
    if (/tv_show|tvseries|tv_series/.test(val)) {
      type = ARR.TYPE.SERIES;
    } else if (/movie|video\.movie/.test(val)) {
      type = ARR.TYPE.MOVIE;
    }
  }

  // Strategy 3: JSON-LD structured data (more detailed, title extraction)
  const ldScript = document.querySelector('script[type="application/ld+json"]');
  if (ldScript) {
    try {
      const ld = JSON.parse(ldScript.textContent);
      const schemaType = ld['@type'];
      if (!type) {
        if (schemaType === 'TVSeries' || schemaType === 'TVMiniSeries' || schemaType === 'TVSpecial') {
          type = ARR.TYPE.SERIES;
        } else if (schemaType === 'Movie' || schemaType === 'ShortFilm') {
          type = ARR.TYPE.MOVIE;
        }
      }
      title = ld.name || '';
    } catch (e) {
      console.warn('[ArrExt] Failed to parse JSON-LD:', e);
    }
  }

  // Default to movie if still undetected
  if (!type) type = ARR.TYPE.MOVIE;

  // Fallback title from DOM
  if (!title) {
    const titleEl =
      document.querySelector('[data-testid="hero__pageTitle"]') ||
      document.querySelector('h1');
    title = titleEl ? titleEl.textContent.trim() : 'Unknown Title';
  }

  // Year extraction with multiple fallbacks
  let year = '';
  const yearMeta = document.querySelector('[data-testid="hero-title-block__metadata"] a');
  if (yearMeta) {
    const m = yearMeta.textContent.match(/\d{4}/);
    if (m) year = m[0];
  }
  if (!year) {
    // Fallback: og:title often contains year like "Title (2024)"
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const m = (ogTitle.content || '').match(/\((\d{4})\)/);
      if (m) year = m[1];
    }
  }

  const service = type === ARR.TYPE.SERIES ? ARR.SERVICE.SONARR : ARR.SERVICE.RADARR;

  // Radarr supports imdb: lookup; Sonarr needs title search + imdbId verification
  const lookupTerm = service === ARR.SERVICE.RADARR
    ? `imdb:${imdbId}`
    : title;

  return {
    type,
    service,
    title,
    year,
    lookupTerm,
    ids: { imdbId },
    source: 'imdb',
  };
}

// ---------------------------------------------------------------------------
// Inline injection – button placed before the title
// ---------------------------------------------------------------------------

function arrGetInjectionPoint() {
  return document.querySelector('[data-testid="hero__pageTitle"]') ||
         document.querySelector('h1');
}

function arrWrapTrigger(button, parent) {
  if (parent && parent.parentNode) {
    parent.parentNode.insertBefore(button, parent);
  }
}
