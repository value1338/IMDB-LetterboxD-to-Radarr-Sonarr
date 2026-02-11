const ArrApi = {
  getQualityProfiles(service) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.GET_QUALITY_PROFILES,
      service,
    });
  },

  getRootFolders(service) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.GET_ROOT_FOLDERS,
      service,
    });
  },

  lookupMedia(service, term, imdbId) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.LOOKUP_MEDIA,
      service,
      term,
      imdbId,
    });
  },

  addMedia(service, payload) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.ADD_MEDIA,
      service,
      payload,
    });
  },

  testConnection(service) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.TEST_CONNECTION,
      service,
    });
  },

  openOptions() {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.OPEN_OPTIONS,
    });
  },

  monochromeSearch(query, searchType) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_SEARCH,
      query,
      searchType,
    });
  },

  monochromeDownload(trackId, quality) {
    return chrome.runtime.sendMessage({
      type: ARR.MSG.MONOCHROME_DOWNLOAD,
      trackId,
      quality,
    });
  },
};
