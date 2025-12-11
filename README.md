# Music Practice Tool

A web-based music practice tool that wraps YouTube videos with enhanced playback controls, specifically designed for musicians practicing along with songs.

## Features

- 🎵 **YouTube Video Integration** - Add videos via URL or search (with API key)
- 📺 **Automatic Title Fetching** - Video titles are automatically retrieved
- ⚡ **Speed Control** - Slow down videos (0.25x to 1.0x) for easier practice
- 🔁 **Loop Sections** - Repeat difficult sections seamlessly with visual indicators
- ⏮ **Skip to Start** - Quick reset button to jump back to the beginning
- 🔍 **YouTube Search** - Search and add videos without leaving the app (optional, requires API key)
- 📱 **Mobile Optimized** - Large, touch-friendly controls with double-tap zoom prevention
- 💾 **Persistent Library** - Videos saved between sessions with titles and dates
- 🎉 **Confetti Animations** - Celebrate adding new practice videos!

## Usage

1. **Add Videos**:
   - Paste a YouTube URL and click "Add Video"
   - Or use the search feature (if API key is configured)
2. **Select a Video**: Click any video card to start practicing
3. **Adjust Speed**: Use the slider or preset buttons to slow down
4. **Set Loop Points**:
   - Play to where you want the loop to start → click "Set Start"
   - Play to where you want it to end → click "Set End"
   - Click "Enable Loop" to repeat automatically
5. **Practice Controls**:
   - Skip to Start: Jump back to the beginning instantly
   - Seek buttons: Jump forward/back 5 seconds
   - Timeline scrubber: Drag to any position

## Deployment

This is a static site designed for deployment on Netlify or similar platforms.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions, including how to set up the optional YouTube search feature.

## Technical Stack

- Vanilla HTML/CSS/JavaScript
- YouTube IFrame API for video playback
- YouTube oEmbed API for title fetching (no auth required)
- YouTube Data API v3 for search (optional, requires API key)
- LocalStorage for video library persistence
- Canvas-based confetti animation

## Browser Support

Works on all modern browsers with support for:
- HTML5 video/iframe
- ES6+ JavaScript
- CSS Grid & Flexbox
- LocalStorage
