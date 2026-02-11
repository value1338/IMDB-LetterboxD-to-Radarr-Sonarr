/* ==========================================================================
   Modal – state machine, DOM creation, event handling.
   All DOM is built via createElement (CSP-safe, no innerHTML).
   ========================================================================== */

// eslint-disable-next-line no-unused-vars
const ArrModal = (() => {
  const S = {
    LOADING: 'loading',
    READY: 'ready',
    SUBMITTING: 'submitting',
    SUCCESS: 'success',
    ERROR: 'error',
    EXISTS: 'exists',
  };

  let overlay = null;
  let state = null;
  let mediaData = null;
  let lookupResult = null;

  // -----------------------------------------------------------------------
  // DOM helper – create element with className, id, optional text
  // -----------------------------------------------------------------------

  function el(tag, opts) {
    const e = document.createElement(tag);
    if (opts) {
      if (opts.cls) e.className = opts.cls;
      if (opts.id) e.id = opts.id;
      if (opts.text) e.textContent = opts.text;
      if (opts.html) e.textContent = opts.html; // always text, never raw HTML
      if (opts.type) e.type = opts.type;
      if (opts.value !== undefined) e.value = opts.value;
      if (opts.checked) e.checked = true;
      if (opts.disabled) e.disabled = true;
      if (opts.role) e.setAttribute('role', opts.role);
      if (opts.ariaLabel) e.setAttribute('aria-label', opts.ariaLabel);
      if (opts.htmlFor) e.htmlFor = opts.htmlFor;
    }
    return e;
  }

  // -----------------------------------------------------------------------
  // Build DOM (CSP-safe)
  // -----------------------------------------------------------------------

  function buildModal(data) {
    const serviceLabel = data.service === ARR.SERVICE.RADARR ? 'Radarr'
                       : data.service === ARR.SERVICE.LIDARR ? 'Lidarr'
                       : 'Sonarr';
    const typeLabel = data.type === ARR.TYPE.MOVIE ? 'Movie'
                    : data.type === ARR.TYPE.MUSIC ? 'Music'
                    : 'TV Series';
    const mod = data.service === ARR.SERVICE.RADARR ? 'arr-modal--radarr'
              : data.service === ARR.SERVICE.LIDARR ? 'arr-modal--lidarr'
              : 'arr-modal--sonarr';

    // Overlay
    const ov = el('div', { cls: 'arr-modal-overlay' });

    // Modal container
    const modal = el('div', { cls: 'arr-modal ' + mod, role: 'dialog', ariaLabel: 'Add to ' + serviceLabel });

    // --- Header ---
    const header = el('div', { cls: 'arr-modal__header' });
    const svcDiv = el('div', { cls: 'arr-modal__service' });
    svcDiv.appendChild(el('span', { cls: 'arr-modal__service-dot' }));
    svcDiv.appendChild(document.createTextNode('Add to ' + serviceLabel));
    header.appendChild(svcDiv);
    const closeBtn = el('button', { cls: 'arr-modal__close', id: 'arrClose', ariaLabel: 'Close', text: '\u00d7' });
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // --- Body ---
    const body = el('div', { cls: 'arr-modal__body' });

    // Title
    const titleText = data.title + (data.year ? ' (' + data.year + ')' : '');
    body.appendChild(el('div', { cls: 'arr-modal__title', id: 'arrTitle', text: titleText }));
    body.appendChild(el('div', { cls: 'arr-modal__type', text: typeLabel }));

    // Loading
    const loading = el('div', { cls: 'arr-modal__loading', id: 'arrLoading' });
    loading.appendChild(el('div', { cls: 'arr-modal__spinner' }));
    loading.appendChild(el('span', { text: 'Loading options\u2026' }));
    body.appendChild(loading);

    // Form
    const form = el('div', { cls: 'arr-modal__form', id: 'arrForm' });
    form.style.display = 'none';

    // Quality Profile
    const qualField = el('div', { cls: 'arr-modal__field' });
    qualField.appendChild(el('label', { text: 'Quality Profile', htmlFor: 'arrQuality' }));
    qualField.appendChild(el('select', { cls: 'arr-modal__select', id: 'arrQuality' }));
    form.appendChild(qualField);

    // Root Folder
    const rootField = el('div', { cls: 'arr-modal__field' });
    rootField.appendChild(el('label', { text: 'Root Folder', htmlFor: 'arrRoot' }));
    rootField.appendChild(el('select', { cls: 'arr-modal__select', id: 'arrRoot' }));
    form.appendChild(rootField);

    // Monitored checkbox
    const monField = el('div', { cls: 'arr-modal__field--inline' });
    const monLabel = el('label');
    const monCb = el('input', { type: 'checkbox', id: 'arrMonitored', checked: true });
    monLabel.appendChild(monCb);
    monLabel.appendChild(document.createTextNode(' Monitored'));
    monField.appendChild(monLabel);
    form.appendChild(monField);

    // Search checkbox
    const searchField = el('div', { cls: 'arr-modal__field--inline' });
    const searchLabel = el('label');
    const searchCb = el('input', { type: 'checkbox', id: 'arrSearch', checked: true });
    searchLabel.appendChild(searchCb);
    searchLabel.appendChild(document.createTextNode(' Start search for missing items'));
    searchField.appendChild(searchLabel);
    form.appendChild(searchField);

    // Sonarr: Series Type
    if (data.service === ARR.SERVICE.SONARR) {
      const stField = el('div', { cls: 'arr-modal__field' });
      stField.appendChild(el('label', { text: 'Series Type', htmlFor: 'arrSeriesType' }));
      const stSelect = el('select', { cls: 'arr-modal__select', id: 'arrSeriesType' });
      for (const [val, txt] of [['standard','Standard'],['daily','Daily'],['anime','Anime']]) {
        const opt = el('option', { text: txt });
        opt.value = val;
        stSelect.appendChild(opt);
      }
      stField.appendChild(stSelect);
      form.appendChild(stField);
    }

    // Lidarr: Metadata Profile
    if (data.service === ARR.SERVICE.LIDARR) {
      const metaField = el('div', { cls: 'arr-modal__field' });
      metaField.appendChild(el('label', { text: 'Metadata Profile', htmlFor: 'arrMetadata' }));
      metaField.appendChild(el('select', { cls: 'arr-modal__select', id: 'arrMetadata' }));
      form.appendChild(metaField);
    }

    body.appendChild(form);

    // Exists
    const existsDiv = el('div', { cls: 'arr-modal__exists', id: 'arrExists' });
    existsDiv.style.display = 'none';
    existsDiv.appendChild(el('span', { cls: 'arr-modal__exists-icon', text: '\u2014' }));
    existsDiv.appendChild(el('span', { cls: 'arr-modal__exists-text', text: 'Already in your library' }));
    body.appendChild(existsDiv);

    // Success
    const successDiv = el('div', { cls: 'arr-modal__success', id: 'arrSuccess' });
    successDiv.style.display = 'none';
    successDiv.appendChild(el('span', { cls: 'arr-modal__success-icon', text: '\u2713' }));
    successDiv.appendChild(el('span', { cls: 'arr-modal__success-text', text: 'Added successfully' }));
    body.appendChild(successDiv);

    // Error
    const errorDiv = el('div', { cls: 'arr-modal__error', id: 'arrError' });
    errorDiv.style.display = 'none';
    errorDiv.appendChild(el('p', { cls: 'arr-modal__error-text', id: 'arrErrorText' }));
    errorDiv.appendChild(el('button', { cls: 'arr-modal__retry', id: 'arrRetry', text: 'Retry' }));
    body.appendChild(errorDiv);

    modal.appendChild(body);

    // --- Footer ---
    const footer = el('div', { cls: 'arr-modal__footer', id: 'arrFooter' });
    footer.appendChild(el('button', { cls: 'arr-modal__btn arr-modal__btn--cancel', id: 'arrCancel', text: 'Cancel' }));

    // Download button (music only)
    if (data.type === ARR.TYPE.MUSIC) {
      const dlBtn = el('button', { cls: 'arr-modal__btn arr-modal__btn--download', id: 'arrDownload', disabled: true });
      dlBtn.appendChild(el('span', { id: 'arrDlText', text: 'Download' }));
      const dlSpin = el('span', { cls: 'arr-modal__btn-spinner', id: 'arrDlSpin' });
      dlSpin.style.display = 'none';
      dlBtn.appendChild(dlSpin);
      footer.appendChild(dlBtn);
    }

    // Add button
    const addBtn = el('button', { cls: 'arr-modal__btn arr-modal__btn--add', id: 'arrAdd', disabled: true });
    addBtn.appendChild(el('span', { id: 'arrAddText', text: 'Add' }));
    const addSpin = el('span', { cls: 'arr-modal__btn-spinner', id: 'arrAddSpin' });
    addSpin.style.display = 'none';
    addBtn.appendChild(addSpin);
    footer.appendChild(addBtn);

    modal.appendChild(footer);
    ov.appendChild(modal);
    return ov;
  }

  // -----------------------------------------------------------------------
  // State transitions
  // -----------------------------------------------------------------------

  function setState(s, errorMsg) {
    state = s;
    const loading = overlay.querySelector('#arrLoading');
    const form    = overlay.querySelector('#arrForm');
    const exists  = overlay.querySelector('#arrExists');
    const success = overlay.querySelector('#arrSuccess');
    const error   = overlay.querySelector('#arrError');
    const footer  = overlay.querySelector('#arrFooter');
    const addBtn  = overlay.querySelector('#arrAdd');
    const addText = overlay.querySelector('#arrAddText');
    const addSpin = overlay.querySelector('#arrAddSpin');

    loading.style.display = 'none';
    form.style.display    = 'none';
    exists.style.display  = 'none';
    success.style.display = 'none';
    error.style.display   = 'none';
    footer.style.display  = 'flex';
    addBtn.disabled = true;
    addBtn.style.display = '';
    addText.textContent = 'Add';
    addSpin.style.display = 'none';
    const dlBtn = overlay.querySelector('#arrDownload');
    if (dlBtn) dlBtn.disabled = true;
    setFormDisabled(false);

    switch (s) {
      case S.LOADING:
        loading.style.display = 'flex';
        break;

      case S.READY:
        form.style.display = 'flex';
        addBtn.disabled = false;
        if (dlBtn) dlBtn.disabled = false;
        break;

      case S.SUBMITTING:
        form.style.display = 'flex';
        setFormDisabled(true);
        addBtn.disabled = true;
        addText.textContent = '';
        addSpin.style.display = 'inline-block';
        break;

      case S.SUCCESS:
        success.style.display = 'flex';
        footer.style.display = 'none';
        setTimeout(close, 2000);
        break;

      case S.ERROR:
        error.style.display = 'block';
        const errEl = overlay.querySelector('#arrErrorText');
        errEl.textContent = ''; // clear
        if (errorMsg && errorMsg.includes('not configured')) {
          errEl.textContent = mediaData.service + ' is not configured. ';
          const link = document.createElement('a');
          link.href = '#';
          link.textContent = 'Open Settings';
          link.style.color = '#8888bb';
          link.style.textDecoration = 'underline';
          link.style.cursor = 'pointer';
          link.addEventListener('click', function (e) { e.preventDefault(); ArrApi.openOptions(); });
          errEl.appendChild(link);
        } else {
          errEl.textContent = errorMsg || 'Unknown error';
        }
        break;

      case S.EXISTS:
        exists.style.display = 'flex';
        addBtn.style.display = 'none';
        break;
    }
  }

  function setFormDisabled(disabled) {
    const form = overlay.querySelector('#arrForm');
    if (!form) return;
    for (const el of form.querySelectorAll('select, input')) {
      el.disabled = disabled;
    }
  }

  // -----------------------------------------------------------------------
  // Open / Close
  // -----------------------------------------------------------------------

  async function open(data) {
    if (overlay) close();
    mediaData = data;
    lookupResult = null;

    overlay = buildModal(data);
    document.body.appendChild(overlay);

    // Events
    overlay.querySelector('#arrClose').addEventListener('click', close);
    overlay.querySelector('#arrCancel').addEventListener('click', close);
    overlay.querySelector('#arrRetry').addEventListener('click', function () { loadOptions(); });
    overlay.querySelector('#arrAdd').addEventListener('click', handleAdd);
    const dlBtn = overlay.querySelector('#arrDownload');
    if (dlBtn) dlBtn.addEventListener('click', handleDownload);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    setState(S.LOADING);
    await loadOptions();
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    state = null;
    mediaData = null;
    lookupResult = null;
  }

  // -----------------------------------------------------------------------
  // Load quality profiles, root folders, lookup media
  // -----------------------------------------------------------------------

  async function loadOptions() {
    setState(S.LOADING);

    try {
      const requests = [
        ArrApi.getQualityProfiles(mediaData.service),
        ArrApi.getRootFolders(mediaData.service),
        ArrApi.lookupMedia(mediaData.service, mediaData.lookupTerm, mediaData.ids.imdbId || null),
      ];

      if (mediaData.service === ARR.SERVICE.LIDARR) {
        requests.push(chrome.runtime.sendMessage({
          type: ARR.MSG.GET_METADATA_PROFILES,
          service: mediaData.service,
        }));
      }

      const results = await Promise.all(requests);
      const [profilesRes, foldersRes, lookupRes] = results;
      const metaRes = results[3] || null;

      if (!profilesRes.success) throw new Error(profilesRes.error);
      if (!foldersRes.success)  throw new Error(foldersRes.error);
      if (!lookupRes.success)   throw new Error(lookupRes.error);

      lookupResult = lookupRes.data;

      if (lookupResult.id && lookupResult.id > 0) {
        setState(S.EXISTS);
        return;
      }

      // Populate quality profiles
      const qualityEl = overlay.querySelector('#arrQuality');
      while (qualityEl.firstChild) qualityEl.removeChild(qualityEl.firstChild);
      for (const p of profilesRes.data) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        qualityEl.appendChild(opt);
      }

      // Populate root folders
      const rootEl = overlay.querySelector('#arrRoot');
      while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild);
      for (const f of foldersRes.data) {
        const opt = document.createElement('option');
        opt.value = f.path;
        opt.textContent = f.path;
        rootEl.appendChild(opt);
      }

      // Lidarr: populate metadata profiles
      if (mediaData.service === ARR.SERVICE.LIDARR && metaRes && metaRes.success) {
        const metaEl = overlay.querySelector('#arrMetadata');
        if (metaEl) {
          while (metaEl.firstChild) metaEl.removeChild(metaEl.firstChild);
          for (const m of metaRes.data) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            metaEl.appendChild(opt);
          }
        }
      }

      // Apply defaults from settings
      const defaults = await chrome.storage.local.get([
        ARR.STORAGE.RADARR_DEFAULT_QUALITY, ARR.STORAGE.RADARR_DEFAULT_ROOT,
        ARR.STORAGE.SONARR_DEFAULT_QUALITY, ARR.STORAGE.SONARR_DEFAULT_ROOT,
        ARR.STORAGE.SONARR_DEFAULT_SERIES_TYPE,
        ARR.STORAGE.LIDARR_DEFAULT_QUALITY, ARR.STORAGE.LIDARR_DEFAULT_ROOT,
        ARR.STORAGE.LIDARR_DEFAULT_METADATA,
      ]);

      let qualKey, rootKey;
      if (mediaData.service === ARR.SERVICE.RADARR) {
        qualKey = ARR.STORAGE.RADARR_DEFAULT_QUALITY;
        rootKey = ARR.STORAGE.RADARR_DEFAULT_ROOT;
      } else if (mediaData.service === ARR.SERVICE.LIDARR) {
        qualKey = ARR.STORAGE.LIDARR_DEFAULT_QUALITY;
        rootKey = ARR.STORAGE.LIDARR_DEFAULT_ROOT;
      } else {
        qualKey = ARR.STORAGE.SONARR_DEFAULT_QUALITY;
        rootKey = ARR.STORAGE.SONARR_DEFAULT_ROOT;
      }

      if (defaults[qualKey]) qualityEl.value = defaults[qualKey];
      if (defaults[rootKey]) rootEl.value = defaults[rootKey];

      if (mediaData.service === ARR.SERVICE.SONARR && defaults[ARR.STORAGE.SONARR_DEFAULT_SERIES_TYPE]) {
        const stEl = overlay.querySelector('#arrSeriesType');
        if (stEl) stEl.value = defaults[ARR.STORAGE.SONARR_DEFAULT_SERIES_TYPE];
      }

      if (mediaData.service === ARR.SERVICE.LIDARR && defaults[ARR.STORAGE.LIDARR_DEFAULT_METADATA]) {
        const metaEl = overlay.querySelector('#arrMetadata');
        if (metaEl) metaEl.value = defaults[ARR.STORAGE.LIDARR_DEFAULT_METADATA];
      }

      // Update title from lookup result if available
      if (lookupResult.title || lookupResult.artistName) {
        const title = lookupResult.artistName || lookupResult.title;
        const year = lookupResult.year || mediaData.year;
        overlay.querySelector('#arrTitle').textContent =
          title + (year ? ' (' + year + ')' : '');
      }

      setState(S.READY);
    } catch (err) {
      setState(S.ERROR, err.message || String(err));
    }
  }

  // -----------------------------------------------------------------------
  // Add media
  // -----------------------------------------------------------------------

  async function handleAdd() {
    if (state !== S.READY || !lookupResult) return;

    setState(S.SUBMITTING);

    const qualityProfileId = parseInt(overlay.querySelector('#arrQuality').value, 10);
    const rootFolderPath = overlay.querySelector('#arrRoot').value;
    const monitored = overlay.querySelector('#arrMonitored').checked;
    const searchOnAdd = overlay.querySelector('#arrSearch').checked;

    let payload;

    if (mediaData.service === ARR.SERVICE.RADARR) {
      payload = {
        title: lookupResult.title,
        tmdbId: lookupResult.tmdbId,
        qualityProfileId,
        rootFolderPath,
        monitored,
        addOptions: { searchForMovie: searchOnAdd },
      };
      if (lookupResult.images) payload.images = lookupResult.images;
      if (lookupResult.year) payload.year = lookupResult.year;
    } else if (mediaData.service === ARR.SERVICE.LIDARR) {
      const metadataProfileId = parseInt(overlay.querySelector('#arrMetadata')?.value, 10) || 1;
      payload = {
        artistName: lookupResult.artistName,
        foreignArtistId: lookupResult.foreignArtistId,
        qualityProfileId,
        metadataProfileId,
        rootFolderPath,
        monitored,
        addOptions: { searchForMissingAlbums: searchOnAdd },
      };
      if (lookupResult.images) payload.images = lookupResult.images;
    } else {
      const seriesType = overlay.querySelector('#arrSeriesType')?.value || 'standard';
      payload = {
        title: lookupResult.title,
        tvdbId: lookupResult.tvdbId,
        qualityProfileId,
        rootFolderPath,
        monitored,
        seriesType,
        seasonFolder: true,
        addOptions: {
          searchForMissingEpisodes: searchOnAdd,
          ignoreEpisodesWithFiles: false,
          ignoreEpisodesWithoutFiles: false,
        },
      };
      if (lookupResult.images) payload.images = lookupResult.images;
      if (lookupResult.seasons) payload.seasons = lookupResult.seasons;
    }

    try {
      const res = await ArrApi.addMedia(mediaData.service, payload);
      if (!res.success) throw new Error(res.error);
      setState(S.SUCCESS);
    } catch (err) {
      setState(S.ERROR, err.message || String(err));
    }
  }

  // -----------------------------------------------------------------------
  // Download via Monochrome (music only)
  // -----------------------------------------------------------------------

  async function handleDownload() {
    if (state !== S.READY) return;

    const dlBtn = overlay.querySelector('#arrDownload');
    const dlText = overlay.querySelector('#arrDlText');
    const dlSpin = overlay.querySelector('#arrDlSpin');
    if (!dlBtn) return;

    dlBtn.disabled = true;
    dlText.textContent = '';
    dlSpin.style.display = 'inline-block';

    try {
      const searchRes = await ArrApi.monochromeSearch(mediaData.title, 'track');
      if (!searchRes.success || !searchRes.data.items.length) {
        throw new Error('Track not found on Monochrome');
      }

      const track = searchRes.data.items[0];
      const dlRes = await ArrApi.monochromeDownload(track.id);
      if (!dlRes.success) throw new Error(dlRes.error);

      chrome.runtime.sendMessage({
        type: 'TRIGGER_DOWNLOAD',
        url: dlRes.data.streamUrl,
        filename: dlRes.data.artist + ' - ' + dlRes.data.title + '.flac',
      });

      dlText.textContent = 'Started!';
      dlSpin.style.display = 'none';
      dlBtn.disabled = false;
      setTimeout(function () { dlText.textContent = 'Download'; }, 2000);
    } catch (err) {
      dlText.textContent = 'Failed';
      dlSpin.style.display = 'none';
      setTimeout(function () {
        dlText.textContent = 'Download';
        dlBtn.disabled = false;
      }, 2000);
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return { open, close };
})();
