#!/usr/bin/env bash
# Renders the hand-motion check as a real-speed video: .preview/hand-motion.mp4
# Frames are captured on a fake clock (one per 1/30 s of game time), so the
# video plays at true 1x speed however slowly this machine renders.
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/build.js
MOTION_VIDEO=1 node tools/preview.js motion
ffmpeg -loglevel error -y -framerate 30 -i .preview/motion/%04d.png \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -crf 20 .preview/hand-motion.mp4
echo "wrote .preview/hand-motion.mp4"
