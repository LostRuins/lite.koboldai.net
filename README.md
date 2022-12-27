#Kobold AI Lite
# [lite.koboldai.net](https://lite.koboldai.net)

This is a standalone Web UI for KoboldAIs Horde, which requires no dependencies, installation or setup.

Simply open it in any browser, and it should work out of the box. All functionality is in a single static HTML file.

You can run it directly from your desktop or throw it on some web server and serve it there too. E.g. Github pages, nginx, whatever.

- Concedo

Changelog Addendum 28 Dec 2022:
- Thanks to Henk, KAI Horde Web UI is now rebranded as KoboldAI Lite! There is a new subdomain for it at https://lite.koboldai.net

Changelog for KAI Horde Web UI v3 at 27 Dec 2022:
- Added a information table which displays current list of Workers and their capabilities (click on Volunteers or volunteer name).
- Added a toggle to enable Persistent Sessions, which will autosave your story and settings to the browser local cache, and automatically load and resume every time you return. For privacy, this is switched off by default.
- Added a share feature which allows you to instantly share any story via a special URL. The entire context, memory and authors note is compacted using an efficient LZMA compression and converted to a URL safe base64 format which others can import with a single click.
- Opening a shared URL will automaticlly load the story, fill in context, Author's Note and memory, and select the correct model.
- Added a button to allow user to manually abort a text generation after 10 seconds if a response was not received.
- Change to minified bootstrap for smaller filesize
- Added an optional workaround hack attempting to fix Horde misdirecting prompts to incorrect models by explicitly requesting Worker IDs (toggleable, not foolproof)

Changelog for KAI Horde Web UI v2 at 25 Dec 2022:
- Added support for Author Note Template
- Added a rudimentary save and load to file, can read both old and new file formats, and will save to old format 
(Caution: Feature is bare bones. Please backup your story.)
- Added chat mode, toggle it in settings
- Added adventure mode, toggle it in settings
- Added autoscroll toggle it in settings
- Added toggle to trim incomplete sentences
- Cleaned up unused CSS classes and tidy up layout, especially for mobile device
- Adjusted settings layout
- Added more descriptive error messages when generation fails