# Generate PNG icons from icon.svg
#
# Run on a machine with imagemagick or rsvg-convert installed:
#
#   rsvg-convert -w 192 -h 192 public/icon.svg -o public/icon-192.png
#   rsvg-convert -w 512 -h 512 public/icon.svg -o public/icon-512.png
#   rsvg-convert -w 180 -h 180 public/icon.svg -o public/apple-icon.png
#
# Or with imagemagick:
#
#   magick public/icon.svg -resize 192x192 public/icon-192.png
#   magick public/icon.svg -resize 512x512 public/icon-512.png
#   magick public/icon.svg -resize 180x180 public/apple-icon.png
#
# These PNGs are referenced from manifest.json and the root layout's icons config.
# Until generated, the SVG icon serves as a fallback for all browsers.
