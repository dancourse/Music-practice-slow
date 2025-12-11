# Deployment Guide

## Netlify Deployment

This app is ready to deploy to Netlify as a static site.

### Basic Deployment (No YouTube Search)

1. Connect your GitHub repository to Netlify
2. Netlify will auto-detect the configuration from `netlify.toml`
3. Click "Deploy"

The app will work immediately with URL-based video adding and automatic title fetching.

### Adding YouTube Search (Optional)

To enable the YouTube search feature, you need a YouTube Data API v3 key:

#### 1. Get a YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "YouTube Data API v3"
4. Go to "Credentials" and create an API key
5. (Optional) Restrict the key to YouTube Data API v3 and your domain

#### 2. Add API Key to Netlify

In your Netlify site dashboard:

1. Go to **Site settings** → **Environment variables**
2. Add a new variable:
   - **Key**: `YOUTUBE_API_KEY`
   - **Value**: Your YouTube API key
3. Save and redeploy your site

#### 3. Inject Environment Variable

The app expects the API key to be available as `window.YOUTUBE_API_KEY`.

Add this snippet in your `netlify.toml` (already included):

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Then create a build script or use Netlify's environment variable injection:

**Option A: Build Plugin (Recommended)**

Create a file `netlify/plugins/inject-env/index.js`:

```javascript
module.exports = {
  onPreBuild: async ({ utils }) => {
    const fs = require('fs');
    const apiKey = process.env.YOUTUBE_API_KEY || '';

    const script = `<script>window.YOUTUBE_API_KEY = '${apiKey}';</script>`;

    let html = fs.readFileSync('index.html', 'utf8');
    html = html.replace('</head>', `${script}\n</head>`);
    fs.writeFileSync('index.html', html);

    console.log('✓ Environment variables injected');
  }
};
```

Update `netlify.toml`:

```toml
[[plugins]]
  package = "./netlify/plugins/inject-env"
```

**Option B: Simple Script Injection**

Add this to your `index.html` before the closing `</head>` tag:

```html
<script>
  // Netlify will replace this at build time
  window.YOUTUBE_API_KEY = '%%YOUTUBE_API_KEY%%';
</script>
```

Then use Netlify's snippet injection feature.

**Option C: Netlify Functions (Most Secure)**

Create `netlify/functions/search.js`:

```javascript
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const query = event.queryStringParameters.q;
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${apiKey}`
    );
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Search failed' })
    };
  }
};
```

Then update `app.js` to call `/.netlify/functions/search?q=${query}` instead of the YouTube API directly.

## Testing Locally

To test with the search feature locally:

1. Create a `.env` file (not committed to git):
   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

2. Serve with a local server that injects env vars, or manually add to `index.html`:
   ```html
   <script>
     window.YOUTUBE_API_KEY = 'your_test_key';
   </script>
   ```

## Features Available Without API Key

- ✅ Add videos via YouTube URL
- ✅ Automatic title fetching (uses YouTube oEmbed API)
- ✅ All playback controls
- ✅ Speed control
- ✅ Loop sections
- ✅ Video library persistence
- ✅ Confetti animations

## Features Requiring API Key

- 🔍 In-app YouTube search

The search section will be hidden if no API key is detected.
