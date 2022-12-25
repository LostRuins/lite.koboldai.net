# [kaihordewebui.github.io](kaihordewebui.github.io)

This is a very quick and very dirty hackjob implementation of a standalone web ui for KoboldAIs Horde, which requires no dependencies, installation or setup.

Simply open the file in any browser, and it should work out of the box. All functionality is in a single static HTML file.

You can run it directly from your desktop or throw it on some web server and serve it there too. E.g. Github pages, nginx, whatever.

I do not apologize for my code quality or how I massacred the UI.

- Concedo

Changelog for 25 Dec 2022:
- Added support for Author Note Template
- Added a rudimentary save and load to file, can read both old and new file formats, and will save to old format 
(Caution: Feature is bare bones. Please backup your story.)
- Added chat mode, toggle it in settings
- Added autoscroll toggle it in settings
- Cleaned up unused CSS classes and tidy up layout, especially for mobile device
- Adjusted settings layout
- Added more descriptive error messages when generation fails