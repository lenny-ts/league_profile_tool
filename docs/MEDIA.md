# Website videos

Eleven recorded demos from `C:\Users\leenny\Videos\demo` are published in `docs/media/`: Background, Bio, Challenge Level, Icon Swapper, Lobby Manager, Overview, Rank Override, Client Themes, Tokens, Music Bio, and Friends.

Each section in `docs/index.html` uses a muted 960×600 H.264 MP4 with native controls and a matching JPG poster. `docs/script.js` adds a Play button so videos start only on click, tap, or keyboard activation, and pauses them when they leave the viewport. `preload="none"` keeps videos unloaded until played. The raw 1920×1080 recordings stay outside the repository.

Published videos and posters have the player's display name covered, except **Friends**, which remains uncensored at the owner's request. The first 5.5 seconds of **Music Bio** were removed entirely because they showed a Last.fm API key and username; the profile-hover name later in that clip is covered. The original recordings are untouched.

## Re-exporting a clip

Run this from the source video directory and use the matching name in `docs/media/`:

```bash
ffmpeg -i input.mp4 -vf "crop=1320:825:300:165,scale=960:600:flags=lanczos,fps=24" -c:v libx264 -preset medium -crf 29 -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p -movflags +faststart -an output.mp4
ffmpeg -ss 2 -i output.mp4 -frames:v 1 -q:v 3 output.jpg
```

Before exporting any new clip, inspect the entire recording for account details, API keys, and other users' identifiers. Preserve the display-name masks if you re-export a published clip. Then link it to its matching showcase section; do not put the raw master on the website.

## Static screenshots

`docs/media/presets.png`, `logs.png`, and `settings.png` come from the supplied screenshots in `Videos/demo` and appear beside Profile Presets, System Log, and Settings. These screenshots load lazily. Check future replacements for account names, keys, and filesystem paths before publishing them.
