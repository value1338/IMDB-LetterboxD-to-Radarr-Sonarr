/* Popup – shows connection status for Radarr/Sonarr/Lidarr, links to settings.
   Respects service enabled/disabled toggles from options. */

(async function () {
  const services = [
    { key: 'radarr', enabledKey: ARR.ENABLED.RADARR, rowId: 'radarrRow', statusId: 'radarrStatus' },
    { key: 'sonarr', enabledKey: ARR.ENABLED.SONARR, rowId: 'sonarrRow', statusId: 'sonarrStatus' },
    { key: 'lidarr', enabledKey: ARR.ENABLED.LIDARR, rowId: 'lidarrRow', statusId: 'lidarrStatus' },
  ];

  // Load enabled states
  const enabledData = await chrome.storage.local.get([
    ARR.ENABLED.RADARR, ARR.ENABLED.SONARR, ARR.ENABLED.LIDARR,
  ]);

  var disabledCount = 0;

  for (var svc of services) {
    var enabled = enabledData[svc.enabledKey] !== false; // default true
    var row = document.getElementById(svc.rowId);
    var statusEl = document.getElementById(svc.statusId);

    if (!enabled) {
      disabledCount++;
      if (row) row.classList.add('row--hidden');
      continue;
    }

    await checkService(svc.key, statusEl);
  }

  // Show disabled count message
  if (disabledCount > 0) {
    var msgEl = document.getElementById('disabledMsg');
    if (msgEl) {
      msgEl.textContent = disabledCount + (disabledCount === 1 ? ' Dienst deaktiviert' : ' Dienste deaktiviert');
      msgEl.style.display = 'block';
    }
  }

  // Settings link
  document.getElementById('openSettings').addEventListener('click', function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });
})();

async function checkService(service, el) {
  var urlKey, keyKey;
  if (service === 'radarr') {
    urlKey = ARR.STORAGE.RADARR_URL;
    keyKey = ARR.STORAGE.RADARR_API_KEY;
  } else if (service === 'lidarr') {
    urlKey = ARR.STORAGE.LIDARR_URL;
    keyKey = ARR.STORAGE.LIDARR_API_KEY;
  } else {
    urlKey = ARR.STORAGE.SONARR_URL;
    keyKey = ARR.STORAGE.SONARR_API_KEY;
  }

  var data = await chrome.storage.local.get([urlKey, keyKey]);

  if (!data[urlKey] || !data[keyKey]) {
    el.textContent = 'not configured';
    el.className = 'status status--no';
    return;
  }

  try {
    var res = await chrome.runtime.sendMessage({
      type: ARR.MSG.TEST_CONNECTION,
      service: service,
    });
    if (res.success) {
      el.textContent = 'v' + (res.data.version || '?');
      el.className = 'status status--ok';
    } else {
      el.textContent = 'offline';
      el.className = 'status status--no';
    }
  } catch (err) {
    el.textContent = 'error';
    el.className = 'status status--no';
  }
}
