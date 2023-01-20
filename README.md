#Kobold AI Lite
# [lite.koboldai.net](https://lite.koboldai.net)

This is a standalone Web UI for KoboldAIs Horde, which requires no dependencies, installation or setup.

Simply open it in any browser, and it should work out of the box. All functionality is in a single static HTML file.

You can run it directly from your desktop or throw it on some web server and serve it there too. E.g. Github pages, nginx, whatever.

- Concedo

Changelog of KoboldAI Lite 22 Jan 2023:
- Added World Info support, with compatible loading from v1 and v2 saves, and saving to v1 format.
- Fixed a bug that allowed HTML inside images to also be edited when edit text was enabled.

Changelog of KoboldAI Lite 18 Jan 2023:
- Added horde disclaimer to welcome page text.
- Added a NSFW toggle for image generation.
- Added a toggle for auto image generation, and button to manually generate images (ratelimited).
- Added trailing whitespace trimming (currently forced, let me know if it needs to be an option).
- Changed the default chat opponent name from "Stranger" to "KoboldAI" as it gives consistently more interesting output.
- Displays number of workers next to each stable horde worker when setting image generation.
- Allows you to randomize Stable Horde models by using * as the model name.
- Changed the delimiters used in story saving to improve compatibility with the official client (uses <|> comments now, this might affect some saved stories with images.)

Changelog for KoboldAI Lite 13 Jan 2023:
- Added integration with Stable Horde to auto generate images INSIDE your stories and adventures! Supports multiple simultaneous generations, with prompts AUTOMATICALLY DEDUCED from your story. They will be displayed inline in the text, with full support for embedded saving and sharing. You can use your own API key, and select your SD model in the Settings panel. Note that this save format is an extension of KoboldAIs own save, if you save a story with images they will not load in the official client. Regular text-only stories are still cross compatible.
- Added support for Pygmalion models in Chat Mode. Defaulted chatmode to inject some hidden context for prompt engineering if none was supplied and memory and author note is empty, it should now behave and respond much better across all models.
- Added fancy color coding to Adventure mode actions and Chat handles
- Added speed (performance) information to worker table
- Added an option when selecting model to use legacy v1 sync API instead of the new v2 API. The Horde model bug should be fixed already, so you may not need it, but could be useful if either one of them breaks in future.
- Fixed a bug where a story would fail to generate if A/N Template was undefined
- Fixed a bug where loading a story prevented you from loading the same story again
- Fixed a bug where editing a story would add extra newlines after existing ones

Changelog for KoboldAI Lite 30 Dec 2022:
- New TTS (Text-To-Speech) feature added! Will read out whatever you send and whatever is generated. Enable in settings.
- Now displays how long the last request took, time elapsed between request and response.
- Slightly increased default temperature

Changelog for KoboldAI Lite 28 Dec 2022:
- Thanks to Henk, KAI Horde Web UI is now rebranded as KoboldAI Lite! There is a new subdomain for it at https://lite.koboldai.net
- Added support for multiple model selection, allowing you to receive generated responses from more than one model. This setting is also remembered in persistent mode and shared stories.
- Added new supported samplers! Top-A, Top-K, Typical and TFS samplers added as Advanced Settings (disabled by default)
- Shared stories now include the game mode (e.g. chat/adventure) and chatname.
- Persistent mode now stores your API key locally if enabled. 
- Url parameters are cleared after loading a shared story. 
- Worker list window size should now scale based on main window size

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