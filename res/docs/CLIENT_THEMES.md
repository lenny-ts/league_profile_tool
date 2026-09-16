# Create a League Client theme

Client Themes applies a plain UTF-8 CSS file through the LPT `client-theme`
Pengu plugin. It styles the League Client, not the game or the LPT window.
No Rose code is used. JavaScript themes and archive packages are not supported.

## 1. Install and test the plugin

Install Pengu Loader from https://github.com/PenguLoader/PenguLoader and enable
it following its instructions. In LPT, open **Client Themes**, enter CSS and
click **Apply Theme**. This installs the plugin and writes its configuration.
Restart League after installation or plugin upgrades. With the plugin loaded, later
edits and Disable are picked up within five seconds while League is running.
The status in LPT describes saved configuration, not a confirmed client connection.

## 2. Write your first stylesheet

Create `theme.css` in a text editor and save as UTF-8. Start with:

```css
/* Midnight theme — author: your name — tested on patch: your patch */
body {
  background-color: #09090b !important;
}
```

The client may draw opaque panels over the body. Use Pengu's developer tools
where supported to inspect the actual element you want to change. Copy a stable
class or element selector and test one rule at a time. For example:

```css
/* Replace this placeholder with a selector inspected in your client. */
.some-client-panel {
  background: #18181b !important;
  color: #fafafa !important;
  border: 1px solid #3b82f6 !important;
}
```

Custom variables only affect properties that reference them. Defining a color
variable alone does not recolor League. Avoid universal selectors that hide
buttons or make text unreadable. Keep keyboard focus indicators visible.

## 3. Import, preview and apply

Choose **Import CSS**, inspect/edit the file and click **Apply Theme**.
Importing alone does not change League. The isolated sample preview shows basic
CSS behavior, not League's DOM, assets or layout. Images from CommunityDragon and
data URLs are allowed in the preview; other external resources are blocked.
Test your theme in League's Home, Profile, Lobby and champion select screens.
The plugin applies styles to the document and open Shadow DOM roots, including
newly mounted components. Iframes and closed roots are not supported.
Client patches can change selectors.

Files must be nonempty UTF-8 CSS, no larger than 200,000 bytes. Imports and legacy
executable CSS constructs are rejected by a basic content check. This is not a
security sandbox or a complete CSS parser: only import themes you trust.
CSS URLs can cause network requests from the client. Relative asset paths resolve
against the client document, not the original imported file. Use self-contained
styles (or small data URLs within the size limit); image/font folders are not imported.

## 4. Share your theme

Click **Export CSS**. Include author, version, tested League patch, intended
selectors and any external resource dependencies in a comment at the top.
Share the CSS file with installation instructions. There is one applied theme
at a time. **Default Themes** includes:

- **Arcane — Fractured**: Arcane Fractured Jinx splash, cyan/pink accents,
  dark glass panels and floating light motes.
- **Star Guardian — Ahri**: Star Guardian Ahri splash, pearl pink/lilac accents,
  luminous navigation and magical-girl styling.

Splash artwork belongs to Riot Games and loads from CommunityDragon. Network
access is required; offline, the theme retains its base color and panel styles.
Export CSS preserves the image URLs, not the downloaded image. Animations respect
`prefers-reduced-motion`. Actual screen coverage needs checking on the current patch.

### Wallpaper coverage

The reserved `:root { --lpt-wallpaper: url("..."); }` property stores the shared
wallpaper. Built-ins neutralize the page-owned backdrops for Home, Lobby/Parties,
Loot, Collection, Event Hub, Activity Center, Clash, Postgame, Store and TFT shop.
This is intentionally a curated selector list: making every element transparent
would destroy card contrast, modals and controls.

**Profile Overview is excluded.** Its native or user-selected LPT Profile
Background continues to render and is not replaced by the theme wallpaper.
The Challenges collection is handled through its own component selector, so it
can use the theme without applying wallpaper rules to Profile Overview.
The theme plugin does not pause or rewrite the Background feature. When authoring
a custom theme, keep profile background selectors out of generic wallpaper rules.
Saved library copies of older presets are not overwritten: select the new built-in
again to use these fixes. Client patches may add new page backdrop selectors.

## Personal theme library

**My Themes** stores each theme in a separate JSON file under the application's
data directory (`themes/`). Library operations do not require Pengu. Imports
receive unique IDs, so two files with the same name do not overwrite each other.
Use Search to find a theme. Selecting it loads its CSS into the editor without
applying it. Export an unfinished draft before loading another theme.

Use **New Theme** or select a preset, edit it, and choose **Save to My Themes**.
For an existing personal theme, **Update Saved Theme** replaces that library entry;
**Save as Copy** creates a new entry. Presets remain unchanged. **Delete** asks for
confirmation and removes only the saved library entry, not the applied theme.
**Disable** controls the applied client theme independently of the library.

## 5. Disable or recover

Click **Disable** and allow five seconds for the plugin to remove its stylesheet.
Your draft remains available and **Apply Theme** enables it again.
If the client becomes unusable, close League, remove or rename
`plugins/client-theme/index.js`, and restart League. Themes are independent of
the Rank Override plugin. The installed `theme.json` contains the theme name,
enabled flag and CSS together so the plugin reads one consistent configuration.

Discovery currently checks Program Files, Program Files (x86), then
Documents/Pengu Loader/plugins. Custom Pengu installations must place the plugin
in a supported location for this version of the tool to manage it.
