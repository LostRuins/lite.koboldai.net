# [kaihordewebui.github.io](kaihordewebui.github.io)

This is a very quick and very dirty hackjob implementation of a standalone web ui for KoboldAIs Horde, which requires no dependencies, installation or setup.

Simply open the file in any browser, and it should work out of the box. All functionality is in a single static HTML file.

You can run it directly from your desktop or throw it on some web server and serve it there too. E.g. Github pages, nginx, whatever.

I do not apologize for my code quality or how I massacred the UI.

- Concedo

Changelog for KAI Horde Web UI v3 at 27 Dec 2022:
- Added a popup table to display current list of Workers and their capabilities (click on Volunteers or volunteer name).
- Added an optional workaround hack attempting to fix Horde misdirecting prompts to incorrect models by explicitly requesting Worker IDs (toggleable, not foolproof)
- Allow user to manually abort a text generation after 10 seconds if a response was not received.
- Added a share feature which allows you to instantly share any story via a special URL. The entire context, memory and authors note is compacted using LZMA compression and converted to a URL safe base64 format which others can import with a single click.
- Opening a shared URL will automaticlly load the story, fill in context, AN and memory, and select the correct model.
- Change to minified bootstrap for smaller filesize

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