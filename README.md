# Add to Radarr, Sonarr & Lidarr

A Firefox extension that lets you add movies, TV series, and music to your Radarr, Sonarr, and Lidarr instances directly from IMDb, Letterboxd, and Spotify.

## Features

- **Radarr** — Add movies from IMDb and Letterboxd
- **Sonarr** — Add TV series from IMDb
- **Lidarr** — Add artists/albums from Spotify *(Chrome only, see Known Issues)*
- **Monochrome** — Download music from Spotify via Monochrome *(Chrome only, see Known Issues)*
- **Status indicators** — See at a glance if a title is already in your library (green/red LED)
- **Configurable defaults** — Set quality profiles, root folders, series types, and metadata profiles
- **Per-service toggle** — Enable/disable each service individually
- **Import settings** — Load Radarr/Sonarr/Lidarr credentials from a `.txt` file

## Supported Sites

| Site | Service |
|------|---------|
| [IMDb](https://www.imdb.com) | Radarr (movies), Sonarr (series) |
| [Letterboxd](https://letterboxd.com) | Radarr (movies) |
| [Spotify](https://open.spotify.com) | Lidarr (music), Monochrome (downloads) — *Chrome only* |

## Installation

### Self-hosted (signed .xpi)

1. Download the latest `.xpi` from [Releases](https://github.com/value1338/IMDB-LetterboxD-to-Radarr-Sonarr/releases)
2. In Firefox, go to `about:addons` > gear icon > "Install Add-on From File..."
3. Select the downloaded `.xpi` file

The extension auto-updates via the built-in update mechanism.

## Setup

1. Click the extension icon and open **Settings**
2. Enter the **Base URL** and **API Key** for each service you want to use
   - Find your API key in each app under Settings > General > API Key
3. Click **Test Connection** to verify
4. Optionally set default quality profiles and root folders
5. **Grant site permissions** — Firefox requires you to manually allow access to IMDb, Letterboxd, and Spotify

## How It Works

When you visit a supported site, the extension injects a small button next to the title:
- **Green dot** — Already in your library
- **Red dot** — Not in your library, click to add
- Clicking the button opens a modal where you can choose quality profile, root folder, and other options before adding

## Requirements

- Firefox 140+
- A running Radarr, Sonarr, and/or Lidarr instance accessible from your browser

## Known Issues

- **Spotify integration (Lidarr & Monochrome) does not work in Firefox** — Spotify's content script injection is currently only functional in the Chrome extension. Firefox support is planned for a future release.

## Privacy

This extension does **not** collect or transmit any user data. All settings (URLs, API keys) are stored locally in your browser using `browser.storage.local`. The extension only communicates with your self-hosted *arr instances.

## License

MIT
