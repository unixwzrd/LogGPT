#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "$0")/.." && pwd)
source_png="$repo_dir/LogGPT/LogGPT Extension/icons/LogGPT-download.png"
source_svg="$repo_dir/graphics/LogGPT-Plus.source.svg"
output_svg="$repo_dir/graphics/LogGPT-Plus.svg"
app_icon_dir="$repo_dir/LogGPT/LogGPT/Assets.xcassets/AppIconPlus.appiconset"
extension_icon_dir="$repo_dir/LogGPT/LogGPT Plus Extension/Resources/icons"
base_plus_icon_dir="$repo_dir/LogGPT/LogGPT Extension/icons/plus"
plus_resource_dir="$repo_dir/LogGPT/LogGPT Plus Resources"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

for tool in base64 qlmanage sips; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required macOS tool not found: $tool" >&2
    exit 1
  fi
done

mkdir -p "$app_icon_dir" "$extension_icon_dir" "$base_plus_icon_dir" "$plus_resource_dir"

# Embed the existing 1024px LogGPT artwork so the review/delivery SVG is portable.
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" == *'__LOGGPT_BASE_IMAGE__'* ]]; then
    printf '%s' "${line%%__LOGGPT_BASE_IMAGE__*}data:image/png;base64," >> "$work_dir/LogGPT-Plus.svg"
    base64 -i "$source_png" | tr -d '\n' >> "$work_dir/LogGPT-Plus.svg"
    printf '%s\n' "${line#*__LOGGPT_BASE_IMAGE__}" >> "$work_dir/LogGPT-Plus.svg"
  else
    printf '%s\n' "$line" >> "$work_dir/LogGPT-Plus.svg"
  fi
done < "$source_svg"
mv "$work_dir/LogGPT-Plus.svg" "$output_svg"

# Quick Look renders SVG natively; sips then creates every exact pixel size.
qlmanage -t -s 1024 -o "$work_dir" "$output_svg" >/dev/null
master_png="$work_dir/LogGPT-Plus.svg.png"
if [[ ! -f "$master_png" ]]; then
  echo "Quick Look did not produce the expected master PNG." >&2
  exit 1
fi

render_png() {
  local size=$1
  local destination=$2
  sips -z "$size" "$size" "$master_png" --out "$destination" >/dev/null
}

for size in 16 32 64 128 256 512 1024; do
  render_png "$size" "$app_icon_dir/Icon-${size}-plus.png"
done

for size in 16 32 48 64 96 128 256 512; do
  render_png "$size" "$extension_icon_dir/Icon-${size}.png"
  render_png "$size" "$base_plus_icon_dir/Icon-${size}.png"
done
render_png 32 "$extension_icon_dir/download-icon.png"
render_png 32 "$base_plus_icon_dir/download-icon.png"
render_png 512 "$plus_resource_dir/Icon.png"
render_png 512 "$plus_resource_dir/PlusIcon.png"
cp "$output_svg" "$extension_icon_dir/download-icon.svg"
cp "$output_svg" "$base_plus_icon_dir/download-icon.svg"

echo "Generated the self-contained SVG and LogGPT+ PNG asset sets."
