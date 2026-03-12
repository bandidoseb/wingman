#!/bin/bash
mkdir -p /tmp/wingman.iconset
sips -z 1024 1024 "$(dirname "$0")/../public/Wingman.png" --out /tmp/wingman.iconset/icon_512x512@2x.png
sips -z 512 512 "$(dirname "$0")/../public/Wingman.png" --out /tmp/wingman.iconset/icon_512x512.png
sips -z 256 256 "$(dirname "$0")/../public/Wingman.png" --out /tmp/wingman.iconset/icon_256x256.png
sips -z 128 128 "$(dirname "$0")/../public/Wingman.png" --out /tmp/wingman.iconset/icon_128x128.png
iconutil -c icns /tmp/wingman.iconset -o "$(dirname "$0")/../build/icon.icns"
echo "Done! icon.icns created in build/"
