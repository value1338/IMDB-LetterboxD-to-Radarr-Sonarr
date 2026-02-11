/* Spotify – extract artist/album/track data for Lidarr integration.
   Handles SPA navigation via URL change detection + MutationObserver.
   All DOM injection is CSP-safe (no innerHTML). */

/* global ARR */

// Spotify is a React SPA – content changes without full page loads.
// We use a combination of URL polling and MutationObserver to detect navigation.

let _lastSpotifyUrl = '';

function arrExtractData() {
  const path = window.location.pathname;

  // Artist page: /artist/{id}
  if (path.match(/^\/artist\/[a-zA-Z0-9]+/)) {
    return extractArtistData();
  }

  // Album page: /album/{id}
  if (path.match(/^\/album\/[a-zA-Z0-9]+/)) {
    return extractAlbumData();
  }

  // Track page: /track/{id}
  if (path.match(/^\/track\/[a-zA-Z0-9]+/)) {
    return extractTrackData();
  }

  return null;
}

function extractArtistData() {
  const artistName = getSpotifyTitle();
  if (!artistName) return null;

  return {
    type: ARR.TYPE.MUSIC || 'music',
    service: ARR.SERVICE.LIDARR || 'lidarr',
    title: artistName,
    year: '',
    lookupTerm: artistName,
    ids: { spotifyArtistUrl: window.location.href },
    source: 'spotify',
  };
}

function extractAlbumData() {
  const albumTitle = getSpotifyTitle();
  const artistName = getSpotifySubtitle();
  // Still return data even without artist – Monochrome panel can work with
  // just the album title; only the Lidarr lookup truly needs the artist.
  if (!albumTitle && !artistName) return null;

  return {
    type: ARR.TYPE.MUSIC || 'music',
    service: ARR.SERVICE.LIDARR || 'lidarr',
    title: artistName || '',
    year: extractYearFromPage(),
    lookupTerm: artistName || albumTitle || '',
    ids: {
      spotifyAlbumUrl: window.location.href,
      albumTitle: albumTitle || '',
      releaseType: getSpotifyReleaseType() || 'album',  // for Monochrome: single/ep → track search
    },
    source: 'spotify',
  };
}

function extractTrackData() {
  const trackTitle = getSpotifyTitle();
  const artistName = getSpotifySubtitle();
  // Still return data even without artist – Monochrome panel can search by
  // track title alone; only the Lidarr lookup truly needs the artist.
  if (!trackTitle && !artistName) return null;

  return {
    type: ARR.TYPE.MUSIC || 'music',
    service: ARR.SERVICE.LIDARR || 'lidarr',
    title: artistName || '',
    year: extractYearFromPage(),
    lookupTerm: artistName || trackTitle || '',
    ids: {
      spotifyTrackUrl: window.location.href,
      trackTitle: trackTitle || '',
    },
    source: 'spotify',
  };
}

// ---------------------------------------------------------------------------
// DOM helpers – Spotify's selectors change frequently, so we use multiple
// fallback strategies.  We also keep a dedicated artist-name extractor that
// is independent of the "subtitle" logic so that artist pages always work.
// ---------------------------------------------------------------------------

/** Get textContent of el, excluding our injected buttons (Lidarr, Download, etc.). */
function _textWithoutInjected(el) {
  if (!el) return '';
  var clone = el.cloneNode(true);
  var injected = clone.querySelectorAll('[data-arr-ext-injected]');
  for (var i = 0; i < injected.length; i++) injected[i].remove();
  return (clone.textContent || '').trim();
}

/** If the title was split (e.g. "I'm Good " + "(Blue)" in DOM), get full title from parent. */
function _fullTitleFromH1(h1) {
  var title = h1.textContent.trim();
  var parent = h1.parentElement;
  if (!parent) return title;
  var pt = _textWithoutInjected(parent) || parent.textContent.trim();
  var firstLine = pt.split(/\n/)[0].trim();
  var beforeDash = firstLine.split(/\s+[-–—]\s+/)[0].trim();
  // Case 1: parent starts with our title and continues with " (…)" → use full segment
  if (pt.length > title.length && pt.indexOf(title) === 0) {
    var rest = pt.slice(title.length);
    if (rest.match(/^\s*\(/)) return beforeDash.length > title.length ? beforeDash : title;
  }
  // Case 2: h1 contains only the parenthetical part (e.g. "Blue" or "(Blue)") – parent has full title
  if (beforeDash.length > title.length && (beforeDash.indexOf('(' + title + ')') !== -1 || beforeDash.indexOf('(' + title) !== -1)) return beforeDash;
  if (title.match(/^\(?[^(\s]+\)?$/) && beforeDash.length > 2 && beforeDash.indexOf(title) !== -1) return beforeDash;
  return title;
}

function getSpotifyTitle() {
  var h1 = document.querySelector('[data-testid="entityTitle"] h1');
  if (h1) return _fullTitleFromH1(h1);

  h1 = document.querySelector('h1[data-encore-id="type"]');
  if (h1) return _fullTitleFromH1(h1);

  h1 = document.querySelector('h1[data-encore-id="text"]');
  if (h1) return _fullTitleFromH1(h1);

  var container = document.querySelector('main [data-testid="entityTitle"]');
  if (container) {
    var ct = _textWithoutInjected(container);
    if (ct) {
      var firstLine = ct.split(/\n/)[0].trim();
      var seg = firstLine.split(/\s+[-–—]\s+/)[0].trim();
      return seg || firstLine || ct;
    }
  }

  h1 = document.querySelector('main section h1');
  if (h1) return _fullTitleFromH1(h1);

  h1 = document.querySelector('main h1');
  if (h1) return _fullTitleFromH1(h1);

  h1 = document.querySelector('h1');
  if (h1) return _fullTitleFromH1(h1);

  var docTitle = document.title;
  if (docTitle && docTitle.includes(' - ')) {
    var parts = docTitle.split(/\s*[-|]\s*/);
    if (parts.length > 0) return parts[0].trim();
  }

  return null;
}

/**
 * Extract the artist / creator name shown below the title on album & track
 * pages.  Only considers the entity header (title block), not "More by..." or
 * track rows, so we get the primary artist (e.g. David Guetta) not a random one.
 */
function getSpotifySubtitle() {
  // Strategy 1 – dedicated test-id for the creator link (primary artist)
  var link = document.querySelector('[data-testid="creator-link"]');
  if (link) return link.textContent.trim();

  // Strategy 2 – only the entity title block (no fallback to whole main section)
  var headerArea = document.querySelector('[data-testid="entityTitle"]');
  if (headerArea) {
    var artistLinks = headerArea.querySelectorAll('a[href*="/artist/"]');
    for (var i = 0; i < artistLinks.length; i++) {
      var text = artistLinks[i].textContent.trim();
      if (text && text.length > 0 && text.length < 100) return text;
    }
  }

  // Strategy 3 – section that contains the page title only (excludes "More by...", track list)
  var titleEl = document.querySelector('[data-testid="entityTitle"] h1') ||
                 document.querySelector('h1[data-encore-id="type"]') ||
                 document.querySelector('main h1');
  if (titleEl) {
    var container = titleEl.closest('[data-testid="entityTitle"]') || titleEl.closest('section') || titleEl.parentElement;
    if (container) {
      var links = container.querySelectorAll('a[href*="/artist/"]');
      for (var j = 0; j < links.length; j++) {
        var t = links[j].textContent.trim();
        if (t && t.length > 0 && t.length < 100) return t;
      }
    }
  }

  // Strategy 4 – document.title (e.g. "I'm Good (Blue) - Single by David Guetta | Spotify")
  var docTitle = document.title;
  if (docTitle) {
    var dotParts = docTitle.split('\u00b7');
    if (dotParts.length >= 2) {
      var afterDot = dotParts[dotParts.length - 1].split(/\s*[|]\s*/)[0].trim();
      if (afterDot && afterDot !== 'Spotify') return afterDot;
    }
    var dashParts = docTitle.split(' - ');
    if (dashParts.length >= 2) {
      var afterDash = dashParts[dashParts.length - 1].split(/\s*[|]\s*/)[0].trim();
      if (afterDash && afterDash !== 'Spotify') return afterDash;
    }
  }

  // Strategy 5 – meta musician: only use artist links inside entity header
  var metaArtist = document.querySelector('meta[name="music:musician"]') ||
                   document.querySelector('meta[property="music:musician"]');
  if (metaArtist && metaArtist.content) {
    var entityOnly = document.querySelector('[data-testid="entityTitle"]');
    var searchRoot = entityOnly || document.body;
    var artistLinks2 = searchRoot.querySelectorAll('a[href*="/artist/"]');
    for (var k = 0; k < artistLinks2.length; k++) {
      var txt = artistLinks2[k].textContent.trim();
      if (txt && txt.length > 0 && txt.length < 100) return txt;
    }
  }

  return null;
}

function extractYearFromPage() {
  const metaDate = document.querySelector('meta[name="music:release_date"]') ||
                   document.querySelector('meta[property="music:release_date"]');
  if (metaDate && metaDate.content) {
    const m = metaDate.content.match(/(\d{4})/);
    if (m) return m[1];
  }

  const spans = document.querySelectorAll('span, time');
  for (const el of spans) {
    const text = el.textContent.trim();
    if (/^\d{4}$/.test(text) && parseInt(text) >= 1900 && parseInt(text) <= 2099) {
      return text;
    }
  }

  return '';
}

/**
 * Read release type from Spotify DOM (Album / Single / EP).
 * Scans spans for exact "Album"/"Single"/"EP", then container text as fallback.
 * Single/EP use Monochrome track search instead of album search.
 */
function getSpotifyReleaseType() {
  var container = document.querySelector('[data-testid="entityTitle"]') ||
                  document.querySelector('main section');
  if (!container) return null;
  var spans = container.querySelectorAll('span');
  for (var i = 0; i < spans.length; i++) {
    var t = spans[i].textContent.trim().toLowerCase();
    if (t === 'album') return 'album';
    if (t === 'single') return 'single';
    if (t === 'ep') return 'ep';
  }
  var text = (container.textContent || '').toLowerCase();
  if (/\bsingle\b/.test(text)) return 'single';
  if (/\bep\b/.test(text)) return 'ep';
  if (/\balbum\b/.test(text)) return 'album';
  return null;
}

// ---------------------------------------------------------------------------
// Inline injection – buttons placed before the title
// ---------------------------------------------------------------------------

function arrGetInjectionPoint() {
  return document.querySelector('[data-testid="entityTitle"] h1') ||
         document.querySelector('h1[data-encore-id="type"]') ||
         document.querySelector('h1[data-encore-id="text"]') ||
         document.querySelector('main h1') ||
         document.querySelector('h1');
}

function _buildMonoInlineBtn() {
  var monoBtn = document.createElement('button');
  monoBtn.className = 'arr-ext-trigger arr-ext-trigger--monochrome';
  monoBtn.setAttribute('data-arr-ext-injected', 'true');
  var dot = document.createElement('span');
  dot.className = 'arr-ext-trigger__dot';
  dot.style.background = '#9c27b0';
  monoBtn.appendChild(dot);
  monoBtn.appendChild(document.createTextNode('Download'));
  monoBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    _openMonoPanel();
  });
  return monoBtn;
}

function arrWrapTrigger(button, parent, showMonochrome) {
  // Build inline wrapper with Lidarr trigger + Monochrome download button.
  // When showMonochrome is a boolean, add the Download button synchronously so the
  // wrapper is complete before insert – avoids React (e.g. on Firefox) replacing the
  // DOM before the async storage callback runs.
  var wrapper = document.createElement('div');
  wrapper.className = 'arr-ext-inline-wrap';
  wrapper.setAttribute('data-arr-ext-injected', 'true');

  if (button) {
    wrapper.appendChild(button);
  }

  if (typeof showMonochrome === 'boolean') {
    if (showMonochrome) wrapper.appendChild(_buildMonoInlineBtn());
  } else {
    try {
      chrome.storage.local.get([ARR.ENABLED.MONOCHROME]).then(function (stored) {
        if (stored[ARR.ENABLED.MONOCHROME] !== false) {
          wrapper.appendChild(_buildMonoInlineBtn());
        }
      }).catch(function () {
        wrapper.appendChild(_buildMonoInlineBtn());
      });
    } catch (e) {
      wrapper.appendChild(_buildMonoInlineBtn());
    }
  }

  if (parent && parent.parentNode) {
    parent.parentNode.insertBefore(wrapper, parent);
  }
}

// ---------------------------------------------------------------------------
// Monochrome Download Panel – browse albums/tracks, download individually
// ---------------------------------------------------------------------------

var _monoPanel = null;

function _closeMonoPanel() {
  if (_monoPanel) {
    _monoPanel.remove();
    _monoPanel = null;
  }
}

function _createPanel(title) {
  _closeMonoPanel();

  var panel = document.createElement('div');
  panel.className = 'arr-mono-panel';
  panel.setAttribute('data-arr-ext-injected', 'true');

  var header = document.createElement('div');
  header.className = 'arr-mono-panel__header';

  var titleEl = document.createElement('div');
  titleEl.className = 'arr-mono-panel__title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  var closeBtn = document.createElement('button');
  closeBtn.className = 'arr-mono-panel__close';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', _closeMonoPanel);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  var body = document.createElement('div');
  body.className = 'arr-mono-panel__body';
  panel.appendChild(body);

  document.body.appendChild(panel);
  _monoPanel = panel;
  return { panel: panel, body: body, titleEl: titleEl };
}

function _showPanelLoading(body, text) {
  body.textContent = '';
  var loading = document.createElement('div');
  loading.className = 'arr-mono-panel__loading';
  var spinner = document.createElement('div');
  spinner.className = 'arr-modal__spinner';
  loading.appendChild(spinner);
  loading.appendChild(document.createTextNode(text || 'Searching\u2026'));
  body.appendChild(loading);
}

function _showPanelError(body, msg) {
  body.textContent = '';
  var err = document.createElement('div');
  err.className = 'arr-mono-panel__error';
  err.textContent = msg;
  body.appendChild(err);
}

function _formatDuration(seconds) {
  if (!seconds) return '';
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/**
 * Extract a display-friendly artist name from a track object.
 */
function _getTrackArtistName(track) {
  if (!track) return 'Unknown';
  if (track.artist) {
    if (typeof track.artist === 'string') return track.artist;
    if (track.artist.name) return track.artist.name;
  }
  if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
    if (typeof track.artists[0] === 'string') return track.artists[0];
    if (track.artists[0].name) return track.artists[0].name;
  }
  return 'Unknown';
}

/**
 * Build a filename for a track download.
 * Uses metadata from the track object (from search/album results) as primary
 * source, falling back to the download response metadata.
 */
function _buildFilename(track, dlData) {
  var artist = _getTrackArtistName(track);
  var title = track.title || track.name || '';
  // Fall back to download response if track metadata is missing
  if ((!artist || artist === 'Unknown') && dlData.artist && dlData.artist !== 'Unknown') {
    artist = dlData.artist;
  }
  if (!title && dlData.title && dlData.title !== 'Unknown') {
    title = dlData.title;
  }
  return (artist || 'Unknown') + ' - ' + (title || 'Unknown') + '.flac';
}

async function _downloadTrack(trackId, btn, trackMeta) {
  btn.disabled = true;
  btn.textContent = '\u2026';
  try {
    var dlRes = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_DOWNLOAD,
      trackId: trackId,
    });
    if (!dlRes.success) throw new Error(dlRes.error);
    var filename = trackMeta
      ? _buildFilename(trackMeta, dlRes.data)
      : (dlRes.data.artist || 'Unknown') + ' - ' + (dlRes.data.title || 'Unknown') + '.flac';
    chrome.runtime.sendMessage({
      type: 'TRIGGER_DOWNLOAD',
      url: dlRes.data.streamUrl,
      filename: filename,
    });
    btn.textContent = '\u2713';
    btn.className = 'arr-mono-panel__item-action arr-mono-panel__item-action--done';
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(function () {
      btn.textContent = 'DL';
      btn.disabled = false;
      btn.className = 'arr-mono-panel__item-action';
    }, 2000);
  }
}

async function _openMonoPanel() {
  var path = window.location.pathname;
  var data = arrExtractData();

  // Even if arrExtractData() returned null (e.g. artist not found on the
  // page), we can still try to open the panel with whatever we can scrape.
  if (!data) {
    var fallbackTitle = getSpotifyTitle();
    var fallbackArtist = getSpotifySubtitle();
    if (!fallbackTitle && !fallbackArtist) return;
    data = {
      type: 'music',
      service: 'lidarr',
      title: fallbackArtist || fallbackTitle || '',
      year: '',
      lookupTerm: fallbackArtist || fallbackTitle || '',
      ids: {
        trackTitle: path.match(/^\/track\//) ? fallbackTitle : '',
        albumTitle: path.match(/^\/album\//) ? fallbackTitle : '',
      },
      source: 'spotify',
    };
  }

  if (path.match(/^\/track\//)) {
    _openTrackPanel(data);
  } else if (path.match(/^\/album\//)) {
    // Single/EP: Monochrome finds nothing with album search → use track search
    var releaseType = (data.ids && data.ids.releaseType) || getSpotifyReleaseType() || 'album';
    if (releaseType === 'single' || releaseType === 'ep') {
      _openTrackPanel(data);
    } else {
      _openAlbumSearchPanel(data);
    }
  } else if (path.match(/^\/artist\//)) {
    _openArtistSearchPanel(data);
  }
}

// --- Track page: search and direct download; includes manual search ---
async function _runTrackSearchAndRender(resultsContainer, trackTitle, artistName) {
  resultsContainer.textContent = '';
  var loading = document.createElement('div');
  loading.className = 'arr-mono-panel__loading';
  var spinner = document.createElement('div');
  spinner.className = 'arr-modal__spinner';
  loading.appendChild(spinner);
  loading.appendChild(document.createTextNode('Searching\u2026'));
  resultsContainer.appendChild(loading);

  var query = (trackTitle && artistName) ? trackTitle + ' ' + artistName
            : (trackTitle || artistName || '').trim();
  if (!query) {
    resultsContainer.textContent = '';
    var err = document.createElement('div');
    err.className = 'arr-mono-panel__error';
    err.textContent = 'Enter artist and/or title.';
    resultsContainer.appendChild(err);
    return;
  }

  try {
    var res = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_SEARCH,
      query: query,
      searchType: 'track',
    });
    resultsContainer.textContent = '';
    if (!res.success) throw new Error(res.error || 'Search failed');
    if (!res.data.items || !res.data.items.length) throw new Error('Track not found on TIDAL');

    for (var i = 0; i < Math.min(res.data.items.length, 10); i++) {
      _appendTrackItem(resultsContainer, res.data.items[i], i + 1);
    }
  } catch (err) {
    resultsContainer.textContent = '';
    var errEl = document.createElement('div');
    errEl.className = 'arr-mono-panel__error';
    errEl.textContent = err.message || 'Search failed';
    resultsContainer.appendChild(errEl);
  }
}

async function _openTrackPanel(data) {
  var trackTitle = data.ids.trackTitle || getSpotifyTitle() || '';
  var artistName = data.title || getSpotifySubtitle() || '';
  var displayTitle = trackTitle || artistName || 'Unknown Track';
  var parts = _createPanel('Track: ' + displayTitle);
  parts.body.className = 'arr-mono-panel__body arr-mono-panel__body--track';

  var manualWrap = document.createElement('div');
  manualWrap.className = 'arr-mono-panel__manual-search';
  var manualLabel = document.createElement('div');
  manualLabel.className = 'arr-mono-panel__manual-label';
  manualLabel.textContent = 'Manual search (if auto failed):';
  manualWrap.appendChild(manualLabel);
  var row = document.createElement('div');
  row.className = 'arr-mono-panel__manual-row';
  var artistInput = document.createElement('input');
  artistInput.type = 'text';
  artistInput.placeholder = 'Artist';
  artistInput.className = 'arr-mono-panel__input';
  artistInput.value = artistName || '';
  var titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.placeholder = 'Title';
  titleInput.className = 'arr-mono-panel__input';
  titleInput.value = trackTitle || '';
  var searchBtn = document.createElement('button');
  searchBtn.type = 'button';
  searchBtn.className = 'arr-mono-panel__manual-btn';
  searchBtn.textContent = 'Search';
  row.appendChild(artistInput);
  row.appendChild(titleInput);
  row.appendChild(searchBtn);
  manualWrap.appendChild(row);
  parts.body.appendChild(manualWrap);

  var resultsWrap = document.createElement('div');
  resultsWrap.className = 'arr-mono-panel__results';
  parts.body.appendChild(resultsWrap);

  searchBtn.addEventListener('click', function () {
    _runTrackSearchAndRender(resultsWrap, titleInput.value.trim(), artistInput.value.trim());
  });

  await _runTrackSearchAndRender(resultsWrap, trackTitle, artistName);
}

// --- Album page: search album, show tracks; if no album found, fall back to track search ---
async function _openAlbumSearchPanel(data) {
  var albumTitle = data.ids.albumTitle || getSpotifyTitle() || '';
  var artistName = data.title || getSpotifySubtitle() || '';
  var parts = _createPanel('Album: ' + (albumTitle || artistName));
  _showPanelLoading(parts.body, 'Searching album\u2026');

  var query = (albumTitle && artistName) ? albumTitle + ' ' + artistName
            : albumTitle || artistName;

  try {
    var res = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_SEARCH,
      query: query,
      searchType: 'album',
    });
    if (!res.success) throw new Error('Search failed: ' + (res.error || 'unknown'));
    if (!res.data.items || !res.data.items.length) {
      // Album not found – do not search by fragment (e.g. "Blue"); search as track with full title
      parts.body.textContent = '';
      parts.body.className = 'arr-mono-panel__body arr-mono-panel__body--track';
      var manualWrap = document.createElement('div');
      manualWrap.className = 'arr-mono-panel__manual-search';
      var manualLabel = document.createElement('div');
      manualLabel.className = 'arr-mono-panel__manual-label';
      manualLabel.textContent = 'Album not found. Search as track (full title):';
      manualWrap.appendChild(manualLabel);
      var row = document.createElement('div');
      row.className = 'arr-mono-panel__manual-row';
      var artistInput = document.createElement('input');
      artistInput.type = 'text';
      artistInput.placeholder = 'Artist';
      artistInput.className = 'arr-mono-panel__input';
      artistInput.value = artistName || '';
      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.placeholder = 'Title';
      titleInput.className = 'arr-mono-panel__input';
      titleInput.value = albumTitle || '';
      var searchBtn = document.createElement('button');
      searchBtn.type = 'button';
      searchBtn.className = 'arr-mono-panel__manual-btn';
      searchBtn.textContent = 'Search';
      row.appendChild(artistInput);
      row.appendChild(titleInput);
      row.appendChild(searchBtn);
      manualWrap.appendChild(row);
      parts.body.appendChild(manualWrap);
      var resultsWrap = document.createElement('div');
      resultsWrap.className = 'arr-mono-panel__results';
      parts.body.appendChild(resultsWrap);
      searchBtn.addEventListener('click', function () {
        _runTrackSearchAndRender(resultsWrap, titleInput.value.trim(), artistInput.value.trim());
      });
      await _runTrackSearchAndRender(resultsWrap, albumTitle, artistName);
      return;
    }

    var album = res.data.items[0];
    _showAlbumTracks(parts, album.id, album.title || albumTitle);
  } catch (err) {
    _showPanelError(parts.body, err.message || 'Search failed');
  }
}

// --- Artist page: search artist, show albums ---
async function _openArtistSearchPanel(data) {
  var artistName = data.title || getSpotifyTitle() || '';
  var parts = _createPanel('Artist: ' + artistName);
  _showPanelLoading(parts.body, 'Searching artist\u2026');

  if (!artistName) {
    _showPanelError(parts.body, 'Could not detect artist name from page');
    return;
  }

  try {
    var res = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_SEARCH,
      query: artistName,
      searchType: 'artist',
    });
    if (!res.success) throw new Error('Search failed: ' + (res.error || 'unknown'));
    if (!res.data.items || !res.data.items.length) throw new Error('Artist "' + artistName + '" not found on TIDAL');

    // Get artist details with albums
    var artist = res.data.items[0];
    _showPanelLoading(parts.body, 'Loading albums for ' + (artist.name || data.title) + '\u2026');

    var artistRes = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_ARTIST,
      artistId: artist.id,
    });
    if (!artistRes.success) throw new Error('Could not load artist: ' + (artistRes.error || 'unknown'));

    parts.body.textContent = '';
    var albums = artistRes.data.albums || [];

    if (albums.length === 0) {
      _showPanelError(parts.body, 'No albums found');
      return;
    }

    // "Download All Albums" button
    var dlAll = document.createElement('button');
    dlAll.className = 'arr-mono-panel__dl-all';
    dlAll.textContent = 'Download All Albums (' + albums.length + ')';
    dlAll.addEventListener('click', function () {
      dlAll.disabled = true;
      dlAll.textContent = 'Starting downloads\u2026';
      _downloadAllAlbums(albums, dlAll);
    });
    parts.body.appendChild(dlAll);

    // Album list
    for (var i = 0; i < albums.length; i++) {
      _appendAlbumItem(parts, albums[i], i + 1);
    }
  } catch (err) {
    _showPanelError(parts.body, err.message || 'Search failed');
  }
}

function _appendAlbumItem(panelParts, album, num) {
  var item = document.createElement('div');
  item.className = 'arr-mono-panel__item';

  var numEl = document.createElement('span');
  numEl.className = 'arr-mono-panel__item-num';
  numEl.textContent = num;
  item.appendChild(numEl);

  var info = document.createElement('div');
  info.className = 'arr-mono-panel__item-info';
  var titleEl = document.createElement('div');
  titleEl.className = 'arr-mono-panel__item-title';
  titleEl.textContent = album.title;
  info.appendChild(titleEl);
  var subEl = document.createElement('div');
  subEl.className = 'arr-mono-panel__item-sub';
  subEl.textContent = (album.year || '') + (album.tracks ? ' \u00b7 ' + album.tracks + ' tracks' : '');
  info.appendChild(subEl);
  item.appendChild(info);

  // "DL" button – download all tracks of this album directly
  var dlBtn = document.createElement('button');
  dlBtn.className = 'arr-mono-panel__item-action';
  dlBtn.textContent = 'DL';
  dlBtn.title = 'Download all tracks of this album';
  dlBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    _downloadAlbumById(album.id, dlBtn);
  });
  item.appendChild(dlBtn);

  // "View" button – show track list
  var btn = document.createElement('button');
  btn.className = 'arr-mono-panel__item-action';
  btn.textContent = 'View';
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    _showAlbumTracks(panelParts, album.id, album.title);
  });
  item.appendChild(btn);

  panelParts.body.appendChild(item);
}

/**
 * Download all tracks of a single album by its ID.
 * Updates the button text with progress.
 */
async function _downloadAlbumById(albumId, btn) {
  btn.disabled = true;
  btn.textContent = '\u2026';
  try {
    var res = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_ALBUM,
      albumId: albumId,
    });
    if (!res.success) throw new Error(res.error || 'Failed');
    var tracks = res.data.tracks || [];
    if (tracks.length === 0) {
      btn.textContent = '0';
      return;
    }
    var done = 0;
    for (var i = 0; i < tracks.length; i++) {
      try {
        var dlRes = await chrome.runtime.sendMessage({
          type: ARR.MSG.MONOCHROME_DOWNLOAD,
          trackId: tracks[i].id,
        });
        if (dlRes.success) {
          chrome.runtime.sendMessage({
            type: 'TRIGGER_DOWNLOAD',
            url: dlRes.data.streamUrl,
            filename: _buildFilename(tracks[i], dlRes.data),
          });
          done++;
          btn.textContent = done + '/' + tracks.length;
        }
      } catch (_e) { /* skip failed track */ }
    }
    btn.textContent = '\u2713';
    btn.className = 'arr-mono-panel__item-action arr-mono-panel__item-action--done';
  } catch (err) {
    btn.textContent = 'Err';
    setTimeout(function () {
      btn.textContent = 'DL';
      btn.disabled = false;
      btn.className = 'arr-mono-panel__item-action';
    }, 2000);
  }
}

async function _showAlbumTracks(panelParts, albumId, albumTitle) {
  panelParts.titleEl.textContent = albumTitle;
  _showPanelLoading(panelParts.body, 'Loading tracks\u2026');

  try {
    var res = await chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_ALBUM,
      albumId: albumId,
    });
    if (!res.success) throw new Error('Could not load album');

    panelParts.body.textContent = '';
    var tracks = res.data.tracks || [];

    // Back button (if came from artist view)
    var backBtn = document.createElement('button');
    backBtn.className = 'arr-mono-panel__back';
    backBtn.textContent = '\u2190 Back';
    backBtn.addEventListener('click', function () {
      _openMonoPanel(); // re-open from current page context
    });
    panelParts.body.appendChild(backBtn);

    if (tracks.length === 0) {
      _showPanelError(panelParts.body, 'No tracks found');
      return;
    }

    // "Download All Tracks" button
    var dlAll = document.createElement('button');
    dlAll.className = 'arr-mono-panel__dl-all';
    dlAll.textContent = 'Download All Tracks (' + tracks.length + ')';
    dlAll.addEventListener('click', function () {
      dlAll.disabled = true;
      dlAll.textContent = 'Downloading\u2026';
      _downloadAllTracks(tracks, dlAll);
    });
    panelParts.body.appendChild(dlAll);

    // Track list
    for (var i = 0; i < tracks.length; i++) {
      _appendTrackItem(panelParts.body, tracks[i], tracks[i].trackNumber || i + 1);
    }
  } catch (err) {
    _showPanelError(panelParts.body, err.message || 'Failed to load tracks');
  }
}

function _appendTrackItem(container, track, num) {
  var item = document.createElement('div');
  item.className = 'arr-mono-panel__item';

  var numEl = document.createElement('span');
  numEl.className = 'arr-mono-panel__item-num';
  numEl.textContent = num;
  item.appendChild(numEl);

  var info = document.createElement('div');
  info.className = 'arr-mono-panel__item-info';
  var titleEl = document.createElement('div');
  titleEl.className = 'arr-mono-panel__item-title';
  titleEl.textContent = track.title || track.name || '';
  info.appendChild(titleEl);
  var subEl = document.createElement('div');
  subEl.className = 'arr-mono-panel__item-sub';
  var subParts = [];
  if (track.artist) subParts.push(typeof track.artist === 'string' ? track.artist : (track.artist.name || ''));
  if (track.duration) subParts.push(_formatDuration(track.duration));
  subEl.textContent = subParts.join(' \u00b7 ');
  info.appendChild(subEl);
  item.appendChild(info);

  var btn = document.createElement('button');
  btn.className = 'arr-mono-panel__item-action';
  btn.textContent = 'DL';
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    _downloadTrack(track.id, btn, track);
  });
  item.appendChild(btn);

  container.appendChild(item);
}

async function _downloadAllTracks(tracks, btn) {
  var done = 0;
  for (var i = 0; i < tracks.length; i++) {
    try {
      var dlRes = await chrome.runtime.sendMessage({
        type: ARR.MSG.MONOCHROME_DOWNLOAD,
        trackId: tracks[i].id,
      });
      if (dlRes.success) {
        chrome.runtime.sendMessage({
          type: 'TRIGGER_DOWNLOAD',
          url: dlRes.data.streamUrl,
          filename: _buildFilename(tracks[i], dlRes.data),
        });
        done++;
        btn.textContent = done + '/' + tracks.length + ' done';
      }
    } catch (err) { /* skip failed tracks */ }
  }
  btn.textContent = 'All done! (' + done + '/' + tracks.length + ')';
}

async function _downloadAllAlbums(albums, btn) {
  var done = 0;
  for (var a = 0; a < albums.length; a++) {
    btn.textContent = 'Album ' + (a + 1) + '/' + albums.length + '\u2026';
    try {
      var res = await chrome.runtime.sendMessage({
        type: ARR.MSG.MONOCHROME_ALBUM,
        albumId: albums[a].id,
      });
      if (!res.success) continue;
      var tracks = res.data.tracks || [];
      for (var t = 0; t < tracks.length; t++) {
        try {
          var dlRes = await chrome.runtime.sendMessage({
            type: ARR.MSG.MONOCHROME_DOWNLOAD,
            trackId: tracks[t].id,
          });
          if (dlRes.success) {
            chrome.runtime.sendMessage({
              type: 'TRIGGER_DOWNLOAD',
              url: dlRes.data.streamUrl,
              filename: _buildFilename(tracks[t], dlRes.data),
            });
            done++;
          }
        } catch (err) { /* skip */ }
      }
    } catch (err) { /* skip album */ }
  }
  btn.textContent = 'All done! (' + done + ' tracks)';
}

// ---------------------------------------------------------------------------
// SPA navigation detection – re-inject on URL changes
// ---------------------------------------------------------------------------

(function setupSpotifyNavWatcher() {
  setInterval(function () {
    if (window.location.href !== _lastSpotifyUrl) {
      _lastSpotifyUrl = window.location.href;
      _closeMonoPanel();
      var existing = document.querySelectorAll('[data-arr-ext-injected]');
      existing.forEach(function (el) { el.remove(); });
    }
  }, 1000);
})();
