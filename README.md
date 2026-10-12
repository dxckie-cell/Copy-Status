# Copy-Status

A Revenge / Bunny / Kettu plugin that lets you select and copy a user's custom status text on their profile, the same way CopyBios does for bios.

Discord doesn't let you select the custom status bubble on a profile. CopyStatus fixes that: long-press the status, select the text, and copy it.

## How it works

The plugin keeps track of the custom status texts Discord already has loaded (from presence data). Whenever a piece of text on screen exactly matches one of them, it is made selectable. It doesn't depend on any one Discord component name, so it should survive most Discord updates.

## Install

Paste this URL into your Discord client's Plugins page:

> https://dxckie-cell.github.io/Copy-Status/CopyStatus/

## Usage

1. Open a profile that has a custom status.
2. Long-press the status bubble.
3. Select the text and copy it.

## Notes

- A status only becomes selectable once Discord has loaded it, so it can take a few seconds for a profile you've just opened.
- Only custom status text is affected. Nothing else in the app is changed.
