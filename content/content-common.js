/* Common content script – runs after site-specific script, injects trigger button.
   Features: duplicate prevention, deferred execution for SPAs, retry logic,
   async library status check with LED indicator. */

(function () {
  'use strict';

  const INJECT_MARKER = 'data-arr-ext-injected';
  const DEFER_MS = 2500;
  const SPOTIFY_DEFER_MS = 4500;  // Spotify’s React often needs longer in Firefox
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 800;

  async function init(retryCount) {
    if (document.querySelector('[' + INJECT_MARKER + ']')) return;

    var data = arrExtractData();
    if (!data) {
      if (retryCount < MAX_RETRIES) setTimeout(function () { init(retryCount + 1); }, RETRY_INTERVAL);
      return;
    }

    // Check if the service is enabled
    var enabledKey = data.service === ARR.SERVICE.RADARR ? ARR.ENABLED.RADARR
                   : data.service === ARR.SERVICE.LIDARR ? ARR.ENABLED.LIDARR
                   : ARR.ENABLED.SONARR;
    var arrServiceDisabled = false;
    var showMonochrome = true;
    try {
      var stored = await chrome.storage.local.get([enabledKey, ARR.ENABLED.MONOCHROME]);
      if (stored[enabledKey] === false) arrServiceDisabled = true;
      if (stored[ARR.ENABLED.MONOCHROME] === false) showMonochrome = false;
    } catch (e) { /* storage unavailable, proceed anyway */ }

    var parent = arrGetInjectionPoint();
    if (!parent) {
      if (retryCount < MAX_RETRIES) setTimeout(function () { init(retryCount + 1); }, RETRY_INTERVAL);
      return;
    }

    var serviceLabel = data.service === ARR.SERVICE.RADARR ? 'Radarr'
                     : data.service === ARR.SERVICE.LIDARR ? 'Lidarr'
                     : 'Sonarr';
    var serviceMod = data.service === ARR.SERVICE.RADARR ? 'arr-ext-trigger--radarr'
                   : data.service === ARR.SERVICE.LIDARR ? 'arr-ext-trigger--lidarr'
                   : 'arr-ext-trigger--sonarr';

    // Create the *arr button – but hide it if the service is explicitly disabled
    var btn = document.createElement('button');
    btn.className = 'arr-ext-trigger ' + serviceMod + ' arr-ext-trigger--checking';
    btn.setAttribute(INJECT_MARKER, 'true');
    if (arrServiceDisabled) {
      btn.style.setProperty('display', 'none', 'important');
    }
    var triggerDot = document.createElement('span');
    triggerDot.className = 'arr-ext-trigger__dot';
    btn.appendChild(triggerDot);
    btn.appendChild(document.createTextNode(serviceLabel));
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      ArrModal.open(data);
    });

    arrWrapTrigger(btn, parent, showMonochrome);

    // Async status check – update LED after lookup; hide button if not configured
    if (!arrServiceDisabled) {
      checkLibraryStatus(btn, data);
    } else {
      btn.style.setProperty('display', 'none', 'important');
    }
  }

  async function checkLibraryStatus(btn, data) {
    try {
      const res = await ArrApi.lookupMedia(
        data.service,
        data.lookupTerm,
        data.ids.imdbId || null
      );

      btn.classList.remove('arr-ext-trigger--checking');

      if (!res || !res.success) {
        // API error (not configured, offline, etc.) – hide the button entirely
        btn.classList.add('arr-ext-trigger--noconfig');
        btn.style.setProperty('display', 'none', 'important');
        return;
      }

      // If the result has an id > 0, it's already in the library
      if (res.data && res.data.id && res.data.id > 0) {
        btn.classList.add('arr-ext-trigger--exists');
        btn.title = 'Already in your library';
      } else {
        btn.classList.add('arr-ext-trigger--missing');
        btn.title = 'Not in your library – click to add';
      }
    } catch {
      btn.classList.remove('arr-ext-trigger--checking');
      btn.classList.add('arr-ext-trigger--noconfig');
      btn.style.setProperty('display', 'none', 'important');
    }
  }

  function start() {
    if (typeof arrExtractData !== 'function') return;
    const host = window.location.hostname;
    if (host.includes('spotify.com')) {
      setTimeout(() => init(0), SPOTIFY_DEFER_MS);
    } else if (host.includes('imdb.com')) {
      setTimeout(() => init(0), DEFER_MS);
    } else {
      init(0);
    }
  }

  // Spotify SPA: re-run init when URL changes (content-spotify.js cleans up old elements)
  if (window.location.hostname.includes('spotify.com')) {
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => init(0), SPOTIFY_DEFER_MS);
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
