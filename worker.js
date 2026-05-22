// =======================
// worker.js – Video Library Service Worker (with Video.js + Health Check + Root status page)
// Supports: HLS, DASH, MP4, MOV, MKV, iframe embeds
// Automatically intercepts video URLs and wraps them in a Video.js player
// Root path / shows activation status and library information
// Health check endpoint: /video-library-health or /health
// =======================

const ACTIVATION_MSG = '✅ Video Library is activated';

// -------------------------------------------------------------------
// Health check path (customizable)
// -------------------------------------------------------------------
const HEALTH_PATH = '/video-library-health';
const ALT_HEALTH_PATH = '/health';

// -------------------------------------------------------------------
// Detect media type from URL
// -------------------------------------------------------------------
function getMediaType(url) {
  const path = url.pathname || '';
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mpd')) return 'dash';
  if (path.endsWith('.mp4')) return 'native';
  if (path.endsWith('.mov')) return 'native';
  if (path.endsWith('.mkv')) return 'mkv';
  if (url.searchParams?.get('m3u8')) return 'hls';
  if (url.searchParams?.get('mpd')) return 'dash';
  return null;
}

// -------------------------------------------------------------------
// Generate the Video.js player page for a given video URL
// -------------------------------------------------------------------
function getPlayerPage(videoUrl, mediaType) {
  const safeUrl = JSON.stringify(videoUrl);

  // For MKV we use native fallback (browsers rarely support MKV)
  if (mediaType === 'mkv') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Library - MKV Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: system-ui; }
    .player-container { width: 90vw; max-width: 1280px; background: #000; border-radius: 20px; overflow: hidden; }
    video { width: 100%; height: auto; display: block; }
    .info { padding: 1rem; background: #1e1e1e; color: #ccc; text-align: center; }
    .badge { position: fixed; bottom: 16px; right: 16px; background: #2c3e66; color: white; padding: 8px 16px; border-radius: 40px; font-size: 12px; font-family: monospace; z-index: 9999; pointer-events: none; }
  </style>
</head>
<body>
<div class="player-container">
  <video id="video" controls autoplay playsinline>
    <source src=${safeUrl} type="video/x-matroska">
    <p>Your browser does not support MKV playback. <a href=${safeUrl}>Download file</a></p>
  </video>
  <div class="info">🎬 MKV file – native fallback (download available)</div>
</div>
<div class="badge">🎬 Video Library is activated</div>
</body>
</html>`;
  }

  // For all other formats (HLS, DASH, MP4, MOV) – use Video.js with appropriate tech
  let sourceType = "";
  if (mediaType === 'hls') {
    sourceType = 'application/x-mpegURL';
  } else if (mediaType === 'dash') {
    sourceType = 'application/dash+xml';
  } else {
    sourceType = (videoUrl.endsWith('.mov')) ? 'video/quicktime' : 'video/mp4';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>Unified Video Library – Video.js Player</title>
  <!-- Video.js core CSS -->
  <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
  <!-- Video.js core JS -->
  <script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
  <!-- Plugins for HLS and DASH -->
  <script src="https://cdn.jsdelivr.net/npm/videojs-contrib-hls@5.15.0/dist/videojs-contrib-hls.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/videojs-contrib-dash@5.1.1/dist/videojs-dash.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .player-wrapper {
      width: 90vw;
      max-width: 1280px;
      background: #000;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .video-js {
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
    }
    .info {
      padding: 0.8rem;
      background: #1e1e1e;
      color: #ccc;
      text-align: center;
      font-size: 0.85rem;
      border-top: 1px solid #333;
    }
    .badge {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: #2c3e66;
      color: white;
      padding: 8px 16px;
      border-radius: 40px;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 9999;
      font-family: monospace;
      pointer-events: none;
    }
    a { color: #8ab3ff; }
    .controls-note { margin-top: 5px; font-size: 0.7rem; color: #888; }
  </style>
</head>
<body>
<div class="player-wrapper">
  <video id="universal-player" class="video-js vjs-big-play-centered" controls autoplay preload="auto" playsinline>
    <source src=${safeUrl} type="${sourceType}">
    <p class="vjs-no-js">To view this video please enable JavaScript, and consider upgrading to a web browser that supports HTML5 video.</p>
  </video>
  <div class="info">
    🎥 <strong>Unified Video Library</strong> – Playing ${mediaType.toUpperCase()} source<br>
    Powered by Video.js • HLS/DASH native support • Smooth controls & theming
    <div class="controls-note">✔️ Fullscreen, quality (if available), captions • Works in iframe</div>
  </div>
</div>
<div class="badge">🎬 Video Library is activated</div>

<script>
  (function() {
    var player = videojs('universal-player', {
      techOrder: ['html5'],
      html5: {
        nativeAudioTracks: false,
        nativeVideoTracks: false,
        hls: { overrideNative: true }
      },
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        children: [
          'playToggle', 'volumePanel', 'currentTimeDisplay', 'timeDivider',
          'durationDisplay', 'progressControl', 'liveDisplay', 'seekToLive',
          'remainingTimeDisplay', 'playbackRateMenuButton', 'chaptersButton',
          'descriptionsButton', 'subtitlesButton', 'captionsButton',
          'audioTrackButton', 'fullscreenToggle'
        ]
      }
    });

    if (${mediaType === 'hls' ? 'true' : 'false'}) {
      player.src({ src: ${safeUrl}, type: 'application/x-mpegURL' });
    } else if (${mediaType === 'dash' ? 'true' : 'false'}) {
      player.src({ src: ${safeUrl}, type: 'application/dash+xml' });
    }

    console.log("${ACTIVATION_MSG} - Video.js player ready");
  })();
</script>
</body>
</html>`;
}

// -------------------------------------------------------------------
// Health check response
// -------------------------------------------------------------------
function healthCheckResponse() {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      version: '3.0',
      message: ACTIVATION_MSG,
      timestamp: Date.now(),
      endpoints: {
        videoInterception: 'All supported video formats (.mp4, .mov, .mkv, .m3u8, .mpd)',
        playerEngine: 'Video.js 8.10.0 + HLS/DASH plugins',
        healthCheck: 'GET /video-library-health or /health',
        statusPage: 'GET /'
      }
    }, null, 2),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// -------------------------------------------------------------------
// Root status page – confirms activation and shows library info
// -------------------------------------------------------------------
function rootStatusPage() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Library – Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0a0e27 0%, #1a1a2e 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', monospace;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      max-width: 800px;
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border-radius: 32px;
      padding: 40px;
      box-shadow: 0 25px 45px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
    }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(135deg, #fff, #8ab3ff);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      margin-bottom: 1rem;
    }
    .badge-large {
      display: inline-block;
      background: #2c3e66;
      color: white;
      padding: 8px 20px;
      border-radius: 40px;
      font-size: 0.9rem;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .status {
      background: #00c85320;
      border-left: 4px solid #00c853;
      padding: 15px;
      border-radius: 12px;
      margin: 20px 0;
      color: #b0ffcf;
    }
    .endpoint {
      background: #0f0f1a;
      padding: 12px;
      border-radius: 12px;
      margin: 10px 0;
      font-family: monospace;
      word-break: break-all;
    }
    .endpoint a {
      color: #8ab3ff;
      text-decoration: none;
    }
    .supported {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 15px 0;
    }
    .format {
      background: #1e2a3a;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
    }
    hr {
      border-color: #333;
      margin: 20px 0;
    }
    footer {
      margin-top: 30px;
      font-size: 0.8rem;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
<div class="card">
  <div class="badge-large">🎬 VIDEO LIBRARY IS ACTIVATED</div>
  <h1>Unified Video Library<br>Worker Active</h1>
  <div class="status">
    ✅ Status: <strong>HEALTHY & RUNNING</strong><br>
    🌍 Deployed on Cloudflare Workers – Global edge network
  </div>

  <p><strong>📡 Available Endpoints</strong></p>
  <div class="endpoint">
    🏠 <strong>GET /</strong> – This status page
  </div>
  <div class="endpoint">
    💚 <strong>GET /health</strong> or <strong>/video-library-health</strong><br>
    → JSON health check
  </div>
  <div class="endpoint">
    🎥 <strong>Any video URL</strong> (e.g., <code>/video.mp4</code>, <code>/stream.m3u8</code>)<br>
    → Automatic Video.js player with interception
  </div>

  <hr>

  <p><strong>🎞️ Supported Formats (auto-detected)</strong></p>
  <div class="supported">
    <span class="format">MP4</span>
    <span class="format">MOV</span>
    <span class="format">MKV</span>
    <span class="format">HLS (.m3u8)</span>
    <span class="format">DASH (.mpd)</span>
  </div>

  <p><strong>🚀 How to use</strong><br>
  Just request any video file through this worker:<br>
  <code>https://your-worker.workers.dev/path/to/video.mp4</code><br>
  The library automatically wraps it in a feature-rich player.
  </p>

  <footer>
    Video.js engine • HLS.js & dash.js integration • MKV fallback • Built-in health checks
  </footer>
</div>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// -------------------------------------------------------------------
// Service Worker / Cloudflare Worker fetch handler
// -------------------------------------------------------------------
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // Root path – show activation status page
  if (path === '/') {
    event.respondWith(rootStatusPage());
    return;
  }

  // Health check endpoints
  if (path === HEALTH_PATH || path === ALT_HEALTH_PATH) {
    event.respondWith(healthCheckResponse());
    return;
  }

  // Video interception
  const mediaType = getMediaType(url);
  if (mediaType && event.request.method === 'GET') {
    event.respondWith(new Response(getPlayerPage(event.request.url, mediaType), {
      headers: { 'Content-Type': 'text/html' }
    }));
    return;
  }

  // Passthrough for everything else
  event.respondWith(fetch(event.request));
});
