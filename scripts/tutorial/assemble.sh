#!/usr/bin/env bash
# Builds a tutorial video from rendered frames + narration clips.
# Usage: scripts/tutorial/assemble.sh couple|dj <voice-dir> <out.mp4>
# Each frame stays on screen for its narration plus a short pause; a quiet music bed runs underneath.
set -euo pipefail
which="$1"; voice="$2"; out="$3"
frames="scripts/tutorial/out/frames-$which"
tmp="scripts/tutorial/out/seg-$which"; rm -rf "$tmp"; mkdir -p "$tmp"
: > "$tmp/list.txt"
i=0
for png in "$frames"/*.png; do
  id=$(basename "$png" .png)
  wav="$voice/$which-$id.aiff"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$wav" 2>/dev/null || echo 0)
  # a clip that failed to record: keep the slide up long enough to read the subtitle
  dur=$(python3 -c "d=float(\"${dur:-0}\" or 0); print(d if d > 1 else 9)")
  case "$id" in 00-*|99-*) lead=0.6; tail=1.6 ;; *) lead=0.4; tail=0.9 ;; esac
  total=$(python3 -c "print(round($dur+$lead+$tail,2))")
  fo=$(python3 -c "print(round($total-0.3,2))")
  ffmpeg -loglevel error -y -loop 1 -framerate 30 -i "$png" -i "$wav" \
    -filter_complex "[0:v]format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st=$fo:d=0.3[v];[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=$(python3 -c "print(int($lead*1000))")|$(python3 -c "print(int($lead*1000))"),apad,atrim=0:$total[a]" \
    -map "[v]" -map "[a]" -t "$total" -c:v libx264 -preset medium -crf 20 -r 30 -c:a aac -b:a 160k "$tmp/$(printf %03d $i).mp4"
  echo "file '$(printf %03d $i).mp4'" >> "$tmp/list.txt"
  i=$((i+1))
done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$tmp/list.txt" -c copy "$tmp/voice.mp4"
len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp/voice.mp4")
fade=$(python3 -c "print(round($len-4,2))")
ffmpeg -loglevel error -y -i "$tmp/voice.mp4" -stream_loop -1 -i public/demo-audio/golden-hour.mp3 \
  -filter_complex "[1:a]aresample=48000,volume=0.09,afade=t=in:d=2,afade=t=out:st=$fade:d=4,atrim=0:$len[bed];[0:a][bed]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$out"
echo "$out ($(printf %.0f "$len")s)"
