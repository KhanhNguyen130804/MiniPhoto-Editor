# Day 2 import fixtures

- `jpeg-orientation-1.jpg` … `jpeg-orientation-8.jpg`: synthetic 64×48 quadrant JPEGs with EXIF orientation values 1–8, generated locally for the spike. The source quadrants are red, green, blue and yellow; orientations 5–8 are expected to decode as 48×64.
- `png-alpha.png`: synthetic 3×1 PNG with alpha values 0, 128 and 255.
- `corrupt.jpg`: 12-byte invalid image payload used to check decode failure handling.
- `webp-static.webp`: static WebP “A Wild Cherry” by Benjamin Gimmel, downloaded from the [Google WebP Gallery](https://developers.google.com/speed/webp/gallery1). The gallery identifies this image as licensed under CC BY-SA 3.0. Attribution: Benjamin Gimmel; license: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

The synthetic files are test inputs, not product assets. Run `npm.cmd run dev -- --host 127.0.0.1`, open `http://127.0.0.1:5173/tests/manual/day2-import.html`, and select either decoder path in the manual harness.
