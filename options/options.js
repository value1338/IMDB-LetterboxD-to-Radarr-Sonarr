/* Options page logic – load / save settings, test connections, populate defaults */

const FIELDS = [
  'radarrUrl', 'radarrApiKey',
  'sonarrUrl', 'sonarrApiKey',
  'lidarrUrl', 'lidarrApiKey',
  'radarrDefaultQualityProfileId', 'radarrDefaultRootFolderPath',
  'sonarrDefaultQualityProfileId', 'sonarrDefaultRootFolderPath',
  'sonarrDefaultSeriesType',
  'lidarrDefaultQualityProfileId', 'lidarrDefaultRootFolderPath',
  'lidarrDefaultMetadataProfileId',
  'monochromeInstanceUrl', 'monochromeQuality',
];

const TOGGLE_KEYS = [
  ARR.ENABLED.RADARR, ARR.ENABLED.SONARR,
  ARR.ENABLED.LIDARR, ARR.ENABLED.MONOCHROME,
];

// Service section mapping for toggle disable effect
const TOGGLE_SECTIONS = {
  radarrEnabled: 'radarr',
  sonarrEnabled: 'sonarr',
  lidarrEnabled: 'lidarr',
  monochromeEnabled: 'monochrome',
};

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

async function loadSettings() {
  const data = await chrome.storage.local.get([...FIELDS, ...TOGGLE_KEYS]);
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (el && data[key] != null) el.value = data[key];
  }
  // Load toggle states (default to enabled if not set)
  for (const key of TOGGLE_KEYS) {
    const el = document.getElementById(key);
    if (el) {
      el.checked = data[key] !== false; // default true
      updateSectionState(key, el.checked);
    }
  }
}

function updateSectionState(toggleKey, enabled) {
  const checkbox = document.getElementById(toggleKey);
  if (!checkbox) return;
  const section = checkbox.closest('.arr-opt__section');
  if (!section) return;
  if (enabled) {
    section.classList.remove('arr-opt__section--disabled');
  } else {
    section.classList.add('arr-opt__section--disabled');
  }
}

// Wire up toggle switches for instant visual feedback
for (const key of TOGGLE_KEYS) {
  const el = document.getElementById(key);
  if (el) {
    el.addEventListener('change', function () {
      updateSectionState(key, el.checked);
    });
  }
}

// ---------------------------------------------------------------------------
// Load from .txt file (format: [radarr] / URL / API_KEY, [sonarr], [lidarr])
// ---------------------------------------------------------------------------

function parseSettingsFile(text) {
  const result = {
    radarrUrl: '', radarrApiKey: '',
    sonarrUrl: '', sonarrApiKey: '',
    lidarrUrl: '', lidarrApiKey: '',
  };
  const lines = text.split(/\r?\n/).map(function (l) { return l.trim(); });
  let section = null;
  let step = 0; // 0 = expect URL, 1 = expect API key
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const sectionMatch = line.match(/^\[(\w+)\]$/i);
    if (sectionMatch) {
      section = sectionMatch[1].toLowerCase();
      step = 0;
      continue;
    }
    if (!section) continue;
    if (section === 'radarr') {
      if (step === 0) { result.radarrUrl = line; step = 1; }
      else if (step === 1) { result.radarrApiKey = line; step = 2; }
    } else if (section === 'sonarr') {
      if (step === 0) { result.sonarrUrl = line; step = 1; }
      else if (step === 1) { result.sonarrApiKey = line; step = 2; }
    } else if (section === 'lidarr') {
      if (step === 0) { result.lidarrUrl = line; step = 1; }
      else if (step === 1) { result.lidarrApiKey = line; step = 2; }
    }
  }
  return result;
}

document.getElementById('loadFileBtn').addEventListener('click', function () {
  document.getElementById('loadFileInput').click();
});

document.getElementById('loadFileInput').addEventListener('change', function () {
  const input = this;
  const file = input.files && input.files[0];
  if (!file) return;
  const status = document.getElementById('saveStatus');
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const parsed = parseSettingsFile(reader.result);
      const urlEl = document.getElementById('radarrUrl');
      const keyEl = document.getElementById('radarrApiKey');
      if (urlEl && keyEl) { urlEl.value = parsed.radarrUrl || ''; keyEl.value = parsed.radarrApiKey || ''; }
      const surl = document.getElementById('sonarrUrl');
      const skey = document.getElementById('sonarrApiKey');
      if (surl && skey) { surl.value = parsed.sonarrUrl || ''; skey.value = parsed.sonarrApiKey || ''; }
      const lurl = document.getElementById('lidarrUrl');
      const lkey = document.getElementById('lidarrApiKey');
      if (lurl && lkey) { lurl.value = parsed.lidarrUrl || ''; lkey.value = parsed.lidarrApiKey || ''; }
      status.textContent = 'Loaded from file. Click Save to apply.';
      status.classList.remove('arr-opt__status--error');
      setTimeout(function () { status.textContent = ''; }, 4000);
    } catch (e) {
      status.textContent = 'Invalid file: ' + (e.message || 'unknown error');
      status.classList.add('arr-opt__status--error');
      setTimeout(function () { status.textContent = ''; status.classList.remove('arr-opt__status--error'); }, 4000);
    }
    input.value = '';
  };
  reader.onerror = function () {
    status.textContent = 'Could not read file';
    status.classList.add('arr-opt__status--error');
    setTimeout(function () { status.textContent = ''; status.classList.remove('arr-opt__status--error'); }, 4000);
    input.value = '';
  };
  reader.readAsText(file, 'UTF-8');
});

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

document.getElementById('saveBtn').addEventListener('click', async () => {
  const settings = {};
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (!el) continue;
    settings[key] = el.value.trim() || null;
  }
  // Strip trailing slashes from URLs
  if (settings.radarrUrl) settings.radarrUrl = settings.radarrUrl.replace(/\/+$/, '');
  if (settings.sonarrUrl) settings.sonarrUrl = settings.sonarrUrl.replace(/\/+$/, '');
  if (settings.lidarrUrl) settings.lidarrUrl = settings.lidarrUrl.replace(/\/+$/, '');
  if (settings.monochromeInstanceUrl) settings.monochromeInstanceUrl = settings.monochromeInstanceUrl.replace(/\/+$/, '');

  // Save toggle states
  for (const key of TOGGLE_KEYS) {
    const el = document.getElementById(key);
    if (el) settings[key] = el.checked;
  }

  await chrome.storage.local.set(settings);

  const status = document.getElementById('saveStatus');
  status.textContent = 'Saved!';
  setTimeout(() => { status.textContent = ''; }, 2500);
});

// ---------------------------------------------------------------------------
// Test Connection
// ---------------------------------------------------------------------------

// Ensure extension has host permission for the given base URL (required in Firefox MV3).
// For HTTP URLs, Firefox may refuse per-origin grant; then we fall back to <all_urls>.
async function ensureHostPermission(baseUrl) {
  if (!baseUrl) return true;
  const origin = baseUrl.replace(/\/+$/, '') + '/*';
  if (!chrome.permissions || !chrome.permissions.contains) return true;
  try {
    const has = await chrome.permissions.contains({ origins: [origin] });
    if (has) return true;
    if (typeof chrome.permissions.request !== 'function') return true;
    let granted = await chrome.permissions.request({ origins: [origin] });
    // Firefox often denies HTTP origins at runtime; fallback to <all_urls> so *arr HTTP works
    if (!granted && origin.startsWith('http://')) {
      const hasAll = await chrome.permissions.contains({ origins: ['<all_urls>'] });
      if (!hasAll && typeof chrome.permissions.request === 'function') granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
      else granted = true;
    }
    return granted;
  } catch (_e) {
    return true;
  }
}

document.querySelectorAll('.arr-opt__test').forEach(btn => {
  btn.addEventListener('click', async () => {
    const service = btn.dataset.service;
    const resultEl = document.getElementById(`${service}TestResult`);
    resultEl.className = 'arr-opt__test-result';
    resultEl.textContent = 'Testing…';

    // Temporarily save current values so the background script can read them
    const urlVal = document.getElementById(`${service}Url`).value.trim().replace(/\/+$/, '');
    const keyVal = document.getElementById(`${service}ApiKey`).value.trim();

    if (!urlVal || !keyVal) {
      resultEl.textContent = 'URL and API key required';
      resultEl.classList.add('error');
      return;
    }

    // In Firefox, host access for user-configured URLs must be granted at runtime
    const allowed = await ensureHostPermission(urlVal);
    if (!allowed) {
      resultEl.textContent = 'Access to this server was denied. Grant the permission and try again.';
      resultEl.classList.add('error');
      return;
    }

    let urlKey, apiKeyKey;
    if (service === 'radarr') { urlKey = ARR.STORAGE.RADARR_URL; apiKeyKey = ARR.STORAGE.RADARR_API_KEY; }
    else if (service === 'lidarr') { urlKey = ARR.STORAGE.LIDARR_URL; apiKeyKey = ARR.STORAGE.LIDARR_API_KEY; }
    else { urlKey = ARR.STORAGE.SONARR_URL; apiKeyKey = ARR.STORAGE.SONARR_API_KEY; }
    await chrome.storage.local.set({ [urlKey]: urlVal, [apiKeyKey]: keyVal });

    const res = await chrome.runtime.sendMessage({
      type: ARR.MSG.TEST_CONNECTION,
      service,
    });

    if (res.success) {
      const d = res.data;
      resultEl.textContent = `Connected — ${d.appName || service} v${d.version || '?'} (API ${d.apiVersion || 'v3'})`;
      resultEl.classList.add('success');
      await populateDefaults(service);
    } else {
      resultEl.textContent = res.error;
      resultEl.classList.add('error');
    }
  });
});

// ---------------------------------------------------------------------------
// Populate default dropdowns after successful connection test
// ---------------------------------------------------------------------------

async function populateDefaults(service) {
  const profilesRes = await chrome.runtime.sendMessage({
    type: ARR.MSG.GET_QUALITY_PROFILES,
    service,
  });
  const foldersRes = await chrome.runtime.sendMessage({
    type: ARR.MSG.GET_ROOT_FOLDERS,
    service,
  });

  const defaultsEl = document.getElementById(`${service}Defaults`);
  if (!profilesRes.success || !foldersRes.success) return;

  // Quality profiles
  const profileSelect = document.getElementById(`${service}DefaultQualityProfileId`);
  const savedProfile = profileSelect.value;
  profileSelect.innerHTML = '<option value="">— Always ask —</option>';
  for (const p of profilesRes.data) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    profileSelect.appendChild(opt);
  }
  if (savedProfile) profileSelect.value = savedProfile;

  // Root folders
  const folderSelect = document.getElementById(`${service}DefaultRootFolderPath`);
  const savedFolder = folderSelect.value;
  folderSelect.innerHTML = '<option value="">— Always ask —</option>';
  for (const f of foldersRes.data) {
    const opt = document.createElement('option');
    opt.value = f.path;
    opt.textContent = f.path;
    folderSelect.appendChild(opt);
  }
  if (savedFolder) folderSelect.value = savedFolder;

  // Lidarr: also load metadata profiles
  if (service === 'lidarr') {
    const metaRes = await chrome.runtime.sendMessage({
      type: ARR.MSG.GET_METADATA_PROFILES,
      service,
    });
    if (metaRes.success) {
      const metaSelect = document.getElementById('lidarrDefaultMetadataProfileId');
      const savedMeta = metaSelect.value;
      metaSelect.innerHTML = '<option value="">— Always ask —</option>';
      for (const m of metaRes.data) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        metaSelect.appendChild(opt);
      }
      if (savedMeta) metaSelect.value = savedMeta;
    }
  }

  defaultsEl.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Connection Status Banner (shown at top of settings page)
// ---------------------------------------------------------------------------

async function checkConnectionStatus() {
  const enabledKeys = [ARR.ENABLED.RADARR, ARR.ENABLED.SONARR, ARR.ENABLED.LIDARR];
  const enabledData = await chrome.storage.local.get(enabledKeys);

  for (const service of ['radarr', 'sonarr', 'lidarr']) {
    const el = document.getElementById(service + 'ConnStatus');
    if (!el) continue;

    // Check if service is disabled
    const eKey = service === 'radarr' ? ARR.ENABLED.RADARR
               : service === 'lidarr' ? ARR.ENABLED.LIDARR
               : ARR.ENABLED.SONARR;
    if (enabledData[eKey] === false) {
      el.textContent = 'disabled';
      el.className = 'arr-opt__status-value';
      continue;
    }

    let urlKey, keyKey;
    if (service === 'radarr') { urlKey = ARR.STORAGE.RADARR_URL; keyKey = ARR.STORAGE.RADARR_API_KEY; }
    else if (service === 'lidarr') { urlKey = ARR.STORAGE.LIDARR_URL; keyKey = ARR.STORAGE.LIDARR_API_KEY; }
    else { urlKey = ARR.STORAGE.SONARR_URL; keyKey = ARR.STORAGE.SONARR_API_KEY; }
    const data = await chrome.storage.local.get([urlKey, keyKey]);

    if (!data[urlKey] || !data[keyKey]) {
      el.textContent = 'not configured';
      el.className = 'arr-opt__status-value err';
      continue;
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: ARR.MSG.TEST_CONNECTION,
        service: service,
      });
      if (res.success) {
        el.textContent = 'v' + (res.data.version || '?') + ' \u2014 connected';
        el.className = 'arr-opt__status-value ok';
      } else {
        el.textContent = 'offline';
        el.className = 'arr-opt__status-value err';
      }
    } catch (e) {
      el.textContent = 'error';
      el.className = 'arr-opt__status-value err';
    }
  }
}

// ---------------------------------------------------------------------------
// Site Permissions (required for Firefox MV3 – content script injection)
// ---------------------------------------------------------------------------

const SITE_PERMS = [
  { id: 'imdb',       label: 'IMDb',       origin: '*://*.imdb.com/*' },
  { id: 'letterboxd', label: 'Letterboxd', origin: 'https://letterboxd.com/*' },
  { id: 'spotify',    label: 'Spotify',    origin: '*://open.spotify.com/*' },
];

function permContains(origin) {
  return new Promise(function (resolve) {
    try {
      var result = chrome.permissions.contains({ origins: [origin] });
      // Promise-based (Firefox MV3 / Chrome MV3)
      if (result && typeof result.then === 'function') {
        result.then(function (ok) { resolve(!!ok); }).catch(function () { resolve(false); });
      } else {
        // Callback-based (older Chrome)
        resolve(!!result);
      }
    } catch (_e) { resolve(false); }
  });
}

function permRequest(origins) {
  return new Promise(function (resolve) {
    try {
      if (typeof chrome.permissions.request !== 'function') { resolve(false); return; }
      var result = chrome.permissions.request({ origins: origins });
      if (result && typeof result.then === 'function') {
        result.then(function (ok) { resolve(!!ok); }).catch(function () { resolve(false); });
      } else {
        resolve(!!result);
      }
    } catch (_e) { resolve(false); }
  });
}

async function checkSitePermissions() {
  var listEl = document.getElementById('permList');
  var grantAllBtn = document.getElementById('grantAllBtn');
  if (!listEl) return;
  listEl.textContent = '';

  var allGranted = true;

  for (var i = 0; i < SITE_PERMS.length; i++) {
    var site = SITE_PERMS[i];
    var granted = await permContains(site.origin);

    var row = document.createElement('div');
    row.className = 'arr-opt__perm-row';

    var nameEl = document.createElement('span');
    nameEl.className = 'arr-opt__perm-name';
    nameEl.textContent = site.label;
    row.appendChild(nameEl);

    var statusEl = document.createElement('span');
    statusEl.className = 'arr-opt__perm-status';
    row.appendChild(statusEl);

    if (granted) {
      statusEl.textContent = '\u2713 Granted';
      statusEl.classList.add('arr-opt__perm-status--granted');
    } else {
      allGranted = false;
      statusEl.textContent = 'Not granted';
      statusEl.classList.add('arr-opt__perm-status--missing');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arr-opt__perm-grant';
      btn.textContent = 'Grant';
      btn.dataset.origin = site.origin;
      btn.addEventListener('click', function (e) {
        var origin = e.currentTarget.dataset.origin;
        permRequest([origin]).then(function (ok) {
          if (ok) checkSitePermissions();
        });
      });
      row.appendChild(btn);
    }

    listEl.appendChild(row);
  }

  if (allGranted) {
    grantAllBtn.style.display = 'none';
  } else {
    grantAllBtn.style.display = '';
  }
}

document.getElementById('grantAllBtn').addEventListener('click', function () {
  var origins = SITE_PERMS.map(function (s) { return s.origin; });
  permRequest(origins).then(function (ok) {
    if (ok) {
      checkSitePermissions();
    } else {
      // Fallback: request <all_urls> (Firefox MV3 treats host_permissions as optional)
      permRequest(['<all_urls>']).then(function (ok2) {
        if (ok2) checkSitePermissions();
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadSettings();
checkConnectionStatus();
checkSitePermissions();
