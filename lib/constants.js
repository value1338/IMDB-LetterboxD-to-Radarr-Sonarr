const ARR = {
  ENABLED: {
    RADARR: 'radarrEnabled',
    SONARR: 'sonarrEnabled',
    LIDARR: 'lidarrEnabled',
    MONOCHROME: 'monochromeEnabled',
  },

  STORAGE: {
    RADARR_URL: 'radarrUrl',
    RADARR_API_KEY: 'radarrApiKey',
    SONARR_URL: 'sonarrUrl',
    SONARR_API_KEY: 'sonarrApiKey',
    LIDARR_URL: 'lidarrUrl',
    LIDARR_API_KEY: 'lidarrApiKey',
    RADARR_DEFAULT_QUALITY: 'radarrDefaultQualityProfileId',
    RADARR_DEFAULT_ROOT: 'radarrDefaultRootFolderPath',
    SONARR_DEFAULT_QUALITY: 'sonarrDefaultQualityProfileId',
    SONARR_DEFAULT_ROOT: 'sonarrDefaultRootFolderPath',
    SONARR_DEFAULT_SERIES_TYPE: 'sonarrDefaultSeriesType',
    LIDARR_DEFAULT_QUALITY: 'lidarrDefaultQualityProfileId',
    LIDARR_DEFAULT_ROOT: 'lidarrDefaultRootFolderPath',
    LIDARR_DEFAULT_METADATA: 'lidarrDefaultMetadataProfileId',
  },

  API: {
    QUALITY_PROFILES: '/qualityprofile',
    ROOT_FOLDERS: '/rootfolder',
    MOVIE_LOOKUP: '/movie/lookup',
    MOVIE_ADD: '/movie',
    SERIES_LOOKUP: '/series/lookup',
    SERIES_ADD: '/series',
    ARTIST_LOOKUP: '/artist/lookup',
    ARTIST_ADD: '/artist',
    METADATA_PROFILES: '/metadataprofile',
    SYSTEM_STATUS: '/system/status',
  },

  STORAGE_MONOCHROME: {
    INSTANCE_URL: 'monochromeInstanceUrl',
    QUALITY: 'monochromeQuality',
  },

  MSG: {
    GET_QUALITY_PROFILES: 'GET_QUALITY_PROFILES',
    GET_ROOT_FOLDERS: 'GET_ROOT_FOLDERS',
    GET_METADATA_PROFILES: 'GET_METADATA_PROFILES',
    LOOKUP_MEDIA: 'LOOKUP_MEDIA',
    ADD_MEDIA: 'ADD_MEDIA',
    TEST_CONNECTION: 'TEST_CONNECTION',
    OPEN_OPTIONS: 'OPEN_OPTIONS',
    MONOCHROME_SEARCH: 'MONOCHROME_SEARCH',
    MONOCHROME_DOWNLOAD: 'MONOCHROME_DOWNLOAD',
    MONOCHROME_ARTIST: 'MONOCHROME_ARTIST',
    MONOCHROME_ALBUM: 'MONOCHROME_ALBUM',
  },

  SERVICE: {
    RADARR: 'radarr',
    SONARR: 'sonarr',
    LIDARR: 'lidarr',
  },

  TYPE: {
    MOVIE: 'movie',
    SERIES: 'series',
    MUSIC: 'music',
  },

  MONOCHROME_DEFAULT_INSTANCES: [
    'https://eu-central.monochrome.tf',
    'https://us-west.monochrome.tf',
    'https://arran.monochrome.tf',
    'https://api.monochrome.tf',
    'https://tidal-api.binimum.org',
    'https://monochrome-api.samidy.com',
    'https://triton.squid.wtf',
    'https://wolf.qqdl.site',
    'https://hifi-one.spotisaver.net',
    'https://hifi-two.spotisaver.net',
    'https://maus.qqdl.site',
    'https://vogel.qqdl.site',
    'https://hund.qqdl.site',
    'https://tidal.kinoplus.online',
  ],

  TIMEOUT_MS: 15000,
};
