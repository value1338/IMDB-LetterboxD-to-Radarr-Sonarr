/* Background script – handles all API requests to Radarr/Sonarr.
   Features: API version auto-detection (v3 → v1 fallback), improved error handling,
   connection test with version reporting. */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  let promise;
  switch (msg.type) {
    case ARR.MSG.GET_QUALITY_PROFILES:
      promise = handleGetProfiles(msg.service); break;
    case ARR.MSG.GET_ROOT_FOLDERS:
      promise = handleGetRootFolders(msg.service); break;
    case ARR.MSG.GET_METADATA_PROFILES:
      promise = handleGetMetadataProfiles(msg.service); break;
    case ARR.MSG.LOOKUP_MEDIA:
      promise = handleLookup(msg.service, msg.term, msg.imdbId); break;
    case ARR.MSG.ADD_MEDIA:
      promise = handleAdd(msg.service, msg.payload); break;
    case ARR.MSG.TEST_CONNECTION:
      promise = handleTestConnection(msg.service); break;
    case ARR.MSG.MONOCHROME_SEARCH:
      promise = handleMonochromeSearch(msg.query, msg.searchType); break;
    case ARR.MSG.MONOCHROME_DOWNLOAD:
      promise = handleMonochromeDownload(msg.trackId, msg.quality); break;
    case ARR.MSG.MONOCHROME_ARTIST:
      promise = handleMonochromeArtist(msg.artistId); break;
    case ARR.MSG.MONOCHROME_ALBUM:
      promise = handleMonochromeAlbum(msg.albumId); break;
    case ARR.MSG.OPEN_OPTIONS:
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return false;
    case 'TRIGGER_DOWNLOAD':
      chrome.downloads.download({
        url: msg.url,
        filename: msg.filename || 'download.flac',
      });
      sendResponse({ success: true });
      return false;
  }
  if (promise) {
    promise.then(sendResponse);
    return true; // keep message channel open for async response
  }
});

// ---------------------------------------------------------------------------
// Config & API version cache
// ---------------------------------------------------------------------------

const versionCache = {};   // { radarr: 'v3', sonarr: 'v3' }

async function getConfig(service) {
  let urlKey, keyKey;
  if (service === ARR.SERVICE.RADARR) {
    urlKey = ARR.STORAGE.RADARR_URL;
    keyKey = ARR.STORAGE.RADARR_API_KEY;
  } else if (service === ARR.SERVICE.LIDARR) {
    urlKey = ARR.STORAGE.LIDARR_URL;
    keyKey = ARR.STORAGE.LIDARR_API_KEY;
  } else {
    urlKey = ARR.STORAGE.SONARR_URL;
    keyKey = ARR.STORAGE.SONARR_API_KEY;
  }

  const data = await chrome.storage.local.get([urlKey, keyKey]);
  const url = data[urlKey];
  const apiKey = data[keyKey];

  if (!url || !apiKey) {
    throw new Error(`${service} is not configured. Please open extension settings.`);
  }
  return { url: url.replace(/\/+$/, ''), apiKey };
}

// ---------------------------------------------------------------------------
// API request with version fallback (v3 → v1)
// Lidarr always uses v1; Radarr/Sonarr try v3 first then v1
// ---------------------------------------------------------------------------

async function apiRequest(service, method, path, body) {
  const { url, apiKey } = await getConfig(service);

  // Lidarr uses v1 only
  const versions = service === ARR.SERVICE.LIDARR
    ? ['v1']
    : versionCache[service] === 'v1'
      ? ['v1', 'v3']
      : ['v3', 'v1'];

  let lastError;
  for (const ver of versions) {
    const fullUrl = `${url}/api/${ver}${path}`;
    try {
      const result = await doFetch(fullUrl, method, apiKey, body);
      versionCache[service] = ver;  // remember working version
      return result;
    } catch (err) {
      lastError = err;
      // Only retry on 404 (wrong API version), not on auth/network errors
      if (!err.message.includes('HTTP 404')) throw err;
    }
  }
  throw lastError;
}

async function doFetch(fullUrl, method, apiKey, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARR.TIMEOUT_MS);

  const opts = {
    method,
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: controller.signal,
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(fullUrl, opts);
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text();
      let detail;
      try {
        const json = JSON.parse(text);
        detail = json.message || (json[0] && json[0].errorMessage) || `HTTP ${res.status}`;
      } catch {
        detail = `HTTP ${res.status}: ${res.statusText}`;
      }
      throw new Error(detail);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out connecting to ${service}. Is the server running?`);
    }
    // Network errors: provide helpful message
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(`Cannot reach server. Check the URL and ensure the server is running.`);
    }
    throw err;
  }
}

function wrap(fn) {
  return fn()
    .then(data => ({ success: true, data }))
    .catch(err => ({ success: false, error: err.message || String(err) }));
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleGetProfiles(service) {
  return wrap(() => apiRequest(service, 'GET', ARR.API.QUALITY_PROFILES));
}

function handleGetRootFolders(service) {
  return wrap(() => apiRequest(service, 'GET', ARR.API.ROOT_FOLDERS));
}

function handleGetMetadataProfiles(service) {
  return wrap(() => apiRequest(service, 'GET', ARR.API.METADATA_PROFILES));
}

function handleLookup(service, term, imdbId) {
  return wrap(async () => {
    if (service === ARR.SERVICE.RADARR) {
      const encoded = encodeURIComponent(term);
      const results = await apiRequest(service, 'GET', `${ARR.API.MOVIE_LOOKUP}?term=${encoded}`);
      if (!results || results.length === 0) {
        throw new Error('Movie not found. It may not yet exist in the TMDB/IMDb database.');
      }
      return results[0];
    }

    if (service === ARR.SERVICE.LIDARR) {
      const encoded = encodeURIComponent(term);
      const results = await apiRequest(service, 'GET', `${ARR.API.ARTIST_LOOKUP}?term=${encoded}`);
      if (!results || results.length === 0) {
        throw new Error('Artist not found. Try checking the name spelling or search manually in Lidarr.');
      }
      return results[0];
    }

    // Sonarr – search by title, then verify by imdbId if available
    const encoded = encodeURIComponent(term);
    const results = await apiRequest(service, 'GET', `${ARR.API.SERIES_LOOKUP}?term=${encoded}`);
    if (!results || results.length === 0) {
      throw new Error('Series not found. Try checking the title spelling or search manually in Sonarr.');
    }

    // Match by imdbId for precision (Sonarr doesn't support imdb: prefix lookup)
    if (imdbId) {
      const exact = results.find(s => s.imdbId === imdbId);
      if (exact) return exact;
    }
    return results[0];
  });
}

function handleAdd(service, payload) {
  return wrap(async () => {
    let path;
    if (service === ARR.SERVICE.RADARR) path = ARR.API.MOVIE_ADD;
    else if (service === ARR.SERVICE.LIDARR) path = ARR.API.ARTIST_ADD;
    else path = ARR.API.SERIES_ADD;
    return apiRequest(service, 'POST', path, payload);
  });
}

function handleTestConnection(service) {
  return wrap(async () => {
    const status = await apiRequest(service, 'GET', ARR.API.SYSTEM_STATUS);
    return {
      version: status.version || '?',
      appName: status.appName || service,
      apiVersion: versionCache[service] || 'v3',
    };
  });
}

// ---------------------------------------------------------------------------
// Monochrome (TIDAL) API – music search & download
// ---------------------------------------------------------------------------

async function getMonochromeInstance() {
  const data = await chrome.storage.local.get([ARR.STORAGE_MONOCHROME.INSTANCE_URL]);
  const custom = data[ARR.STORAGE_MONOCHROME.INSTANCE_URL];
  if (custom) return custom.replace(/\/+$/, '');
  // Rotate through default instances randomly
  const instances = ARR.MONOCHROME_DEFAULT_INSTANCES;
  return instances[Math.floor(Math.random() * instances.length)];
}

async function getMonochromeQuality() {
  const data = await chrome.storage.local.get([ARR.STORAGE_MONOCHROME.QUALITY]);
  return data[ARR.STORAGE_MONOCHROME.QUALITY] || 'HI_RES_LOSSLESS';
}

async function monochromeFetch(path) {
  const instances = [];
  const data = await chrome.storage.local.get([ARR.STORAGE_MONOCHROME.INSTANCE_URL]);
  const custom = data[ARR.STORAGE_MONOCHROME.INSTANCE_URL];
  if (custom) {
    instances.push(custom.replace(/\/+$/, ''));
  } else {
    instances.push(...ARR.MONOCHROME_DEFAULT_INSTANCES);
  }

  let lastError;
  for (const baseUrl of instances) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(ARR.TIMEOUT_MS),
      });
      if (res.ok) return res;
      if (res.status === 429) continue; // rate limited, try next
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('All Monochrome instances failed');
}

function handleMonochromeSearch(query, searchType) {
  return wrap(async () => {
    const paramMap = { track: 's', artist: 'a', album: 'al' };
    const param = paramMap[searchType] || 's';
    const res = await monochromeFetch(`/search/?${param}=${encodeURIComponent(query)}`);
    const json = await res.json();

    // Normalize: find the items array in the response
    const items = extractItems(json, searchType === 'artist' ? 'artists'
                                    : searchType === 'album' ? 'albums' : 'tracks');
    return { items, query, searchType };
  });
}

function extractItems(data, key) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  if (data[key] && data[key].items) return data[key].items;
  // Recursive search
  for (const v of Object.values(data)) {
    if (v && typeof v === 'object') {
      if (v.items && Array.isArray(v.items)) return v.items;
    }
  }
  return [];
}

function handleMonochromeDownload(trackId, quality) {
  return wrap(async () => {
    const q = quality || await getMonochromeQuality();
    const res = await monochromeFetch(`/track/?id=${trackId}&quality=${q}`);
    const json = await res.json();

    // Parse track response: find track metadata and stream info
    const normalized = json.data || json;
    const entries = Array.isArray(normalized) ? normalized : [normalized];

    let trackMeta = null;
    let streamInfo = null;

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (!trackMeta && entry.duration) trackMeta = entry;
      if (!streamInfo && entry.manifest) streamInfo = entry;
    }

    if (!streamInfo) throw new Error('Could not get stream info');

    // Decode manifest to get stream URL
    let streamUrl = null;
    try {
      const decoded = atob(streamInfo.manifest);
      if (decoded.includes('<MPD')) {
        throw new Error('DASH streams cannot be downloaded directly from extension');
      }
      try {
        const parsed = JSON.parse(decoded);
        if (parsed.urls && parsed.urls[0]) streamUrl = parsed.urls[0];
      } catch {
        const match = decoded.match(/https?:\/\/[\w\-.~:?#[@!$&'()*+,;=%/]+/);
        if (match) streamUrl = match[0];
      }
    } catch (err) {
      if (err.message.includes('DASH')) throw err;
      throw new Error('Failed to decode stream manifest');
    }

    if (!streamUrl) throw new Error('Could not resolve stream URL');

    return {
      streamUrl,
      trackId,
      title: trackMeta?.title || 'Unknown',
      artist: trackMeta?.artist?.name || trackMeta?.artists?.[0]?.name || 'Unknown',
      album: trackMeta?.album?.title || '',
      quality: q,
    };
  });
}

// ---------------------------------------------------------------------------
// Monochrome Artist & Album handlers (new)
// ---------------------------------------------------------------------------

function handleMonochromeArtist(artistId) {
  return wrap(async () => {
    const [infoRes, contentRes] = await Promise.all([
      monochromeFetch('/artist/?id=' + artistId),
      monochromeFetch('/artist/?f=' + artistId + '&skip_tracks=true'),
    ]);
    const infoJson = await infoRes.json();
    const contentJson = await contentRes.json();
    const info = infoJson.data || infoJson;
    const content = contentJson.data || contentJson;

    let albums = [];
    if (content.albums && Array.isArray(content.albums)) albums = content.albums;
    else if (content.albums && content.albums.items) albums = content.albums.items;
    let singles = [];
    if (content.singles && Array.isArray(content.singles)) singles = content.singles;
    else if (content.singles && content.singles.items) singles = content.singles.items;
    let compilations = [];
    if (content.compilations && Array.isArray(content.compilations)) compilations = content.compilations;
    else if (content.compilations && content.compilations.items) compilations = content.compilations.items;

    const allReleases = [...albums, ...singles, ...compilations];

    // Deduplicate
    const unique = new Map();
    for (const a of allReleases) {
      const key = JSON.stringify([(a.title || a.name || ''), a.numberOfTracks || 0]);
      if (unique.has(key)) {
        const existing = unique.get(key);
        if (a.explicit && !existing.explicit) { unique.set(key, a); continue; }
        if (!a.explicit && existing.explicit) continue;
        const existingTags = existing.mediaMetadata?.tags?.length || 0;
        const newTags = a.mediaMetadata?.tags?.length || 0;
        if (newTags > existingTags) unique.set(key, a);
      } else {
        unique.set(key, a);
      }
    }
    const dedupedReleases = Array.from(unique.values());

    return {
      name: info.name || content.name || '',
      id: artistId,
      albums: dedupedReleases.map(function (a) {
        return {
          id: a.id,
          title: a.title || a.name || '',
          year: a.releaseDate ? a.releaseDate.substring(0, 4) : '',
          tracks: a.numberOfTracks || a.tracksCount || 0,
          cover: a.cover || a.image || '',
          type: a.type || '',
        };
      }),
    };
  });
}

function handleMonochromeAlbum(albumId) {
  return wrap(async () => {
    const res = await monochromeFetch('/album/?id=' + albumId);
    const json = await res.json();
    const data = json.data || json;

    let rawTracks = [];
    if (data.items && Array.isArray(data.items)) {
      rawTracks = data.items.map(function (entry) {
        return entry.item || entry;
      });
    } else if (data.tracks && Array.isArray(data.tracks)) {
      rawTracks = data.tracks;
    } else if (data.tracks && data.tracks.items) {
      rawTracks = data.tracks.items;
    }

    return {
      id: albumId,
      title: data.title || data.name || '',
      artist: data.artist?.name || data.artists?.[0]?.name || '',
      tracks: rawTracks.map(function (t) {
        return {
          id: t.id,
          title: t.title || t.name || '',
          artist: t.artist?.name || t.artists?.[0]?.name || '',
          duration: t.duration || 0,
          trackNumber: t.trackNumber || t.index || 0,
        };
      }),
    };
  });
}
