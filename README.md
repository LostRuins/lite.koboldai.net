#Kobold AI Lite
# [lite.koboldai.net](https://lite.koboldai.net)

This is a standalone Web UI for KoboldAIs Horde, which requires no dependencies, installation or setup.

Simply open it in any browser, and it should work out of the box. All functionality is in a single static HTML file.

You can run it directly from your desktop or throw it on some web server and serve it there too. E.g. Github pages, nginx, whatever.

- Concedo

Changelog of KoboldAI Lite 28 Mar 2023:
- Added token pseudo-streaming for Kobold-based APIs, allowing a request to be divided into multiple smaller requests for faster responses. This works very similar to **Token Streaming** in the main kobold client. Note that there is a small performance impact, your request will take approximately 20% longer if it is enabled. You can toggle it when selecting a custom endpoint. Token Streaming is not available when using horde models.
- Clickable image summaries, select an image to view prompt used to generate. Also allows deleting old images from this UI.
- Improved edit mode text merging, now remembers the newest chunk even if it's a sentence fragment.
- Proper support for localhost mode, disabling all horde models when local flag is set. 

Changelog of KoboldAI Lite 23 Mar 2023:
- Integrated spellbook by Scale AI as a custom endpoint.
- Added support for specifying a fixed port in local mode, using the URL parameters local=1&port=(port)
- Added autosave upon ending of edit mode.
- Save file hint remembers last known filename when opening.

Changelog of KoboldAI Lite 13 Mar 2023:
- Added support for the new replacement_filter on image horde! This should hopefully reduce frustration from being flagged for false positives when generating images. 
- Added Horde registration signup link visible for anonymous users.
- Added a toggle to avoid autopicking NSFW models when loading a scenario.
- Added support for gpt-3.5-turbo as a custom OpenAI endpoint
- Increased horde polling speed slightly, and a greater increase for custom endpoints - this should make custom endpoints much more responsive.
- Added tooltip for sampler order.
- Fixed empty responses from OpenAI by biasing against <|endoftext|>
- Added a new TavernAI preset that duplicates the settings TavernAI uses. 

Changelog of KoboldAI Lite 11 Mar 2023:
- Added support for TavernAI character formats! Both importing PNG cards and JSON files are fully supported. Just load it like you would load a story normally.
- Added support for importing Pygmalion / Oobabooga Text Generation Characters.
- Added support for OpenAI API (Use at your own risk)
- Added display for token budget remaining
- Increased volume of beep on complete.
- Increased default size of memory input window and made widths dynamic on mobile screens.
- Added model name to post-gen worker kudos summary.
- Added url parameter scenario hotlink shortcut to a premade scenario (Credit: @mikeX)
- Added option for Author's Note strength
- Added 'local=1' param for running locally.

Changelog of KoboldAI Lite 9 Mar 2023:
- Added a new feature - Quick Play Scenarios! Created 11 brand new *ORIGINAL* scenario prompts for use in KoboldAI. A mix of different types and genres, story, adventure and chat, were created from scratch for this showcase, so feel free to use any of them in your adventures! 
- You can launch scenarios from the top menu bar. Each scenario comes preloaded with everything you need to jump right in - and optionally allows Kobold Lite to automatically select a suitable AI model for you. There is also a search input to filter through the scenarios, and a dropdown to select a scenario type.
- Added support for importing custom aetherroom.club scenarios! Simply key in the prompt number or enter the URL, and Kobold Lite will do the rest. 
- Another attempt at fixing the autocomplete bug in chat mode.
- Heard some early feedback that the colors on the scenario cards were too flashy. Please do let me know if I should change it.
- If you have a quality scenario prompt, and wish see it added here, please do let me know! Either message me in the KoboldAI Discord or on Reddit with a .json file containing the story. Do note that all prompt text cannot contain copyrighted material, except where permitted by fair use law. *Scenarios should be original content. Please do not suggest anything that you don't have rights to or permission for, that breaks our ToS, or that could potentially get DMCA takedowns.*


Changelog of KoboldAI Lite 5 Mar 2023:
- Added customizable prompt prefixes for generating images with stable horde! This appends a user selected prefix to all of the prompts when generating images on Stable Horde, it can be useful to automatically add a specific style to the images you want (e.g. Pencil Sketch, Anime)
- Added proper handling for cancelling a pending text generation request.
- 'Abort' option appearance delay reduced to 4 seconds, down from 10 seconds.
- Explicitly disabled autocomplete for aesthetic chat mode input.
- Improved disclaimer message, converted to a popup
- UI made a bit more responsive in rescaling sizes for small screens. Disabled flexbox approach as it was breaking on some browsers.
- Various fixes and UI tweaks to improve appearance
- Added manually calculated speed for models
- Preset samplers orders changed to follow main client, new preset "Inverted Mirror" added.

Changelog of KoboldAI Lite 2 Mar 2023:
- Added option to beep when generation is completed.
- Highlight previously selected models and workers when revisiting the AI panel.
- KoboldAI Lite is now released under AGPL License
- Fixed chatmode parsing bugs
- Removed some of the unpopular samplers as it was too cluttered

Changelog of KoboldAI Lite 25 Feb 2023:
- **Massive overhaul** of horde integration. Now Lite supports the new merge with combined stable horde! 
- But even better, it's also backwards compatible. Now KoboldAI Lite *also* supports **multiple Horde clusters** from both types together. It is able to retrieve model and worker lists from any number of different Horde clusters, and combine them into a unified list, automatically dispatching requests and receiving responses from the correct endpoints. 
- If your selected API key is incompatible with the selected cluster, it will instead use the anonymous key. 
- Each model and worker on each cluster is annotated with a symbol, if a worker is duplicated on multiple clusters you can use this to tell them apart.
- Added text chunk highlighting in edit mode, selecting the cursor on text in edit mode will now highlight the parent chunk.
- Display the horde username when selecting API key, and shows which cluster it belongs to
- Hide API keys when not selected (as a password field)
- Added a dynamic favicon that changes when text is finished generating
- Added a popup to allow an easy way for users to deactivate maintenance mode from inside kobold lite. Now, when you input your API key, if it detects that you have a worker that has been set to maintenace mode, it will show a popup asking if you wish to bring your worker back online.
- Minor regression fixes for bugs during image loading in edit mode, and API key selection errors.
- Adventure prompt injection is now optional, and can be toggled in settings
- Added a toggle to make world info keys case sensitive
- Removed support for legacy V1 submit endpoint as the new horde does not have it.

Changelog of KoboldAI Lite 18 Feb 2023:
- New and improved Adventure Mode! Now you will be able to switch between Adventure and Story writing with a button toggle, similar to old main client UI.
- Adventure mode now adds some context modification to improve coherency and get better responses. Try it!
- The latest Retry action can now be undone if you don't like the newest result or press it by mistake

Changelog of KoboldAI Lite 15 Feb 2023:
- Added mouseover text showing the prompt that was used to generate each image. Prompt is not saved, it's only visible in current session.
- Reworked the workers info table, added jobs done information, added maintenance color for workers.
- Added indicator for trusted workers in worker table (Kudos highlighted in purple)
- Added a toggle to control image saving in json files
- Saved settings now combine with unconfigured defaults instead of overwriting them
- Fixed author note not saving in some scenarios
- Added a cancel button for world info editing, which reverts pending changes
- Allow clicking checkbox label to toggle edit mode and enter sends
- Fixed images not parsing correctly, made Stable Diffsion 1.5 the default Add Img model, disabled debug console by default
- Increased default temperature, but lowered default rep pen slightly
- Added extra shortcut to display worker list
- Added support for generating images within new chat ui
- Added custom endpoint selection in offline mode, allowing usage even if the entire kobold horde goes down
- Added an option to keep AI selected or not when starting a new game
- Improved overwrite checks when opening a file or sharelink with embedded settings

Changelog of KoboldAI Lite 5 Feb 2023:
- Slight tweaks to the new chat UI to improve usability
- Added ability to **export settings** into saved files and shared urls
- Added custom sampler orders in settings, now that horde has support for them

Changelog of KoboldAI Lite 4 Feb 2023:
- Added a brand new ***AESTHETIC*** messenger-style UI for chat mode, which you can toggle in the settings. Fully compatible with all horde models including Pygmalion, it also allows **out-of-turn** chatting, where you can undo the AI's output to add on to your earlier messages, or simply send an empty message to let the AI continue speaking twice in a row. This new chat mode is now the default, but you can easily toggle between this UI and the classic UI in settings.
- Improved iOS support, allowing most iPhones and iPads to save and load story files. Please let me know if you encounter issues.
- Minor improvements in sharing stories (length checks and image exclusions).
- Additional stopping tokens for adventure mode added.
- Tweaks to reduce chance of memory being truncated from context due to excessive length.

Changelog of KoboldAI Lite 1 Feb 2023:
- Added support to connect to custom remote KAI instances (e.g. trycloudflare, localtunnel, ngrok). So you can use Lite to connect to any colab / kaggle hosted url, or your own PC via *remote_play.bat*. 
*Note that direct localhost connection is not currently supported. You must use a tunnel.*
- Changed the PWA manifest base url to a relative path.

Changelog of KoboldAI Lite 29 Jan 2023:
- Added Offline Mode, allowing you to load, edit and save your stories even when not connected to horde.
- Added an extra sampler preset for good default settings for NeoX-20B.
- Improve chat mode, sends the botname in context for better support with Pygmalion models.
- Added image prompt sanitization for stable horde, an optional filter that replaces high risk keywords relating to CSAM. It can be disabled with the flag `?nofilter=1` added to the url.
- Changed PWA Manifest to Standalone.
- Added confirmation window when overwriting from a shared story.

Changelog of KoboldAI Lite 24 Jan 2023:
- Added support to install KAI Lite as a **Progressive Web App** (adds desktop shortcuts, app icons and fullscreen UI layout). This means you'll be able to *install* the KoboldAI Lite as a shortcut on your home screen or desktop, and run it in a standalone window.
- Added a curated list of quick settings presets, taken from UI2. Includes Kobold exclusives like Chasm's *Godlike* and xen0's *Light Breeze*, as well as classic configs from NAI like *Genesis* and *Storywriter*. Will support custom sampler orders once Horde backend implements it.
- Added support for rep pen range and rep pen slope. Custom sampler orders are on the way, pending Horde backend changes.
- Waiting spinner now changes appearance based on estimated queue length, allowing you to estimate the text generation time. Green circle means generation is almost ready, and red means there is a long queue.
- "Lock-in Workers" has been replaced with "Manually Select Worker", which allows you to pick exactly which workers are used to generate text. Multiple workers can be selected from this new menu.
- Improved edit mode, upon saving now it splits your undo stack into paragraphs instead of everything in one action.
- World Info improvements, ignoring secondary keys if they are invalid or empty.
- Trim whitespace can now be toggled in settings.
- Added more tooltips for some settings.
- Increased height of model selection window.


Changelog of KoboldAI Lite 21 Jan 2023:
- Added World Info support, with compatible loading from v1 and v2 saves, and saving to v1 format. It should work exactly like world info in the main v1 client.
- Fixed a bug that allowed HTML inside images to also be edited when edit text was enabled.
- Prevented action buttons from being selected before an AI model was chosen

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