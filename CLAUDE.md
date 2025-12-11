# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A vanilla JavaScript web application that wraps YouTube videos with enhanced playback controls for musicians practicing songs. The app is a static site designed for Netlify deployment with no build process required.

## Architecture

### Core Components

**Single-Page Application Structure:**
- `index.html` - Single page with all UI sections (search, video library, player, controls)
- `app.js` - Main application class (`MusicPracticeApp`) managing all state and interactions
- `confetti.js` - Canvas-based animation for celebrating video additions
- `styles.css` - Complete styling with CSS custom properties for theming

### State Management

The `MusicPracticeApp` class manages all application state:
- `videos[]` - Video library stored in localStorage as JSON
- `currentVideoId` - Currently playing video
- `player` - YouTube IFrame API player instance
- `loopStart/loopEnd/loopEnabled` - Loop section state
- `playerReady` - YouTube API initialization flag

### YouTube API Integration

**Three separate YouTube APIs used:**
1. **YouTube IFrame Player API** - Video playback (loaded via script tag, no auth)
2. **YouTube oEmbed API** - Automatic title fetching (no auth required)
3. **YouTube Data API v3** - Optional search feature (requires API key via `window.YOUTUBE_API_KEY`)

The search section is conditionally shown only when `window.YOUTUBE_API_KEY` is available.

### Key Features Implementation

**Loop System:**
- Stores `loopStart` and `loopEnd` timestamps
- 100ms interval (`loopCheckInterval`) checks current time and seeks back when reaching loop end
- Visual overlay on timeline shows loop region as percentage of total duration
- Loop UI updates whenever loop points change or video duration is available

**Speed Control:**
- Range slider (0.25x to 1.0x) and preset buttons (0.5x, 0.75x, 1.0x)
- Uses YouTube Player API's `setPlaybackRate()` method
- Active preset button styling syncs with slider value

**Video Library:**
- Videos stored in localStorage as array with `{id, title, addedAt}` structure
- Title fetched automatically via oEmbed API when adding videos
- Video items rendered with click-to-select and remove button functionality

## Development

### Local Development

No build process required. Serve the directory with any static file server:

```bash
python3 -m http.server 8000
# or
npx serve
```

### Testing YouTube Search Locally

To test the optional search feature, inject the API key in `index.html` before `</head>`:

```html
<script>
  window.YOUTUBE_API_KEY = 'your_test_api_key_here';
</script>
```

Never commit API keys. The `.gitignore` already excludes `.env` files.

## Deployment

### Netlify Deployment

The app is configured for Netlify in `netlify.toml`:
- Publishes from root directory (`.`)
- SPA redirect rule sends all routes to `index.html`

**To enable YouTube search on Netlify:**
1. Add `YOUTUBE_API_KEY` environment variable in Netlify dashboard
2. Use one of the injection methods documented in DEPLOYMENT.md:
   - Build plugin to inject into HTML at build time
   - Netlify Functions to proxy API calls (recommended for security)
   - Snippet injection via Netlify UI

## Code Patterns

### Event Flow

1. User adds video → `addVideo()` → `fetchVideoTitle()` → `saveVideos()` → `renderVideoList()` → confetti burst
2. User selects video → `selectVideo()` → `createPlayer()` or `player.loadVideoById()` → `onPlayerReady()` → `startTimeUpdate()`
3. Loop enabled → `toggleLoop()` → `startLoopCheck()` → 100ms interval checks time and seeks

### YouTube Player Lifecycle

1. Script loads `iframe_api` from YouTube
2. YouTube calls global `onYouTubeIframeAPIReady()` when ready
3. First video selection calls `createPlayer()` to instantiate `YT.Player`
4. Player ready callback sets `playerReady = true` and starts time updates
5. Subsequent videos use `player.loadVideoById()` instead of recreating player

### Critical Implementation Details

**Double-tap zoom prevention:** Mobile controls use touch-action CSS and prevent default behaviors

**Time formatting:** `formatTime()` handles edge cases (NaN, Infinity) that occur during video transitions

**Loop timing precision:** 100ms check interval balances responsiveness with performance

**Search results XSS prevention:** Uses `escapeHtml()` helper to safely render user-generated content from YouTube API

## File Structure Modifications

When adding features:
- Keep all JavaScript in `app.js` unless creating a new standalone module like `confetti.js`
- CSS uses clear section comments (`/* ==================== */`) - maintain this pattern
- All UI is in `index.html` - no separate templates or components
- State always flows through the `MusicPracticeApp` class instance (`app` global)

## Environment Variables

- `YOUTUBE_API_KEY` (optional) - Enables YouTube search feature when injected as `window.YOUTUBE_API_KEY`

The app gracefully degrades without the API key - all features work except in-app search.
