#!/bin/bash
# Script to clean up Safari Extension icon resources and manifests
# Run this from your LogGPT project root: bash cleanup_safari_extension_icons.sh

set -e

PROJECT_ROOT="$(pwd)"
EXT_ICONS_DIR="$PROJECT_ROOT/LogGPT/LogGPT Extension/icons"
CANONICAL_ICONS_DIR="$PROJECT_ROOT/icons"
ASSET_ICONS=(
  "Icon-16.png"
  "Icon-32.png"
  "Icon-48.png"
  "Icon-64.png"
  "Icon-96.png"
  "Icon-128.png"
  "Icon-256.png"
  "Icon-512.png"
)

# 1. Remove obsolete/duplicate icon directories
if [ -d "$EXT_ICONS_DIR" ]; then
  echo "Removing obsolete icon directory: $EXT_ICONS_DIR"
  rm -rf "$EXT_ICONS_DIR"
else
  echo "No obsolete icon directory found at $EXT_ICONS_DIR."
fi

# 2. Move only the required icons to the asset catalog (AppIcon.appiconset), using canonical location
ASSET_DIR="$PROJECT_ROOT/LogGPT/LogGPT/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ASSET_DIR"
for icon in "${ASSET_ICONS[@]}"; do
  if [ -f "$CANONICAL_ICONS_DIR/$icon" ]; then
    cp "$CANONICAL_ICONS_DIR/$icon" "$ASSET_DIR/$icon"
    echo "Copied $icon to AppIcon.appiconset."
  else
    echo "WARNING: $icon is missing in $CANONICAL_ICONS_DIR!"
  fi
done

# 3. Remove references to missing icons from manifest.json (robust version)
MANIFESTS=("$PROJECT_ROOT/manifest.json" "$PROJECT_ROOT/manifest-v2.json" "$PROJECT_ROOT/manifest-v3.json")
for manifest in "${MANIFESTS[@]}"; do
  if [ -s "$manifest" ]; then
    # Check if root is a JSON object
    if jq -e 'type == "object"' "$manifest" > /dev/null 2>&1; then
      cp "$manifest" "$manifest.bak"
      jq 'if has("icons") then .icons |= with_entries(select(.value | test("^icons/Icon-.*\\.png$"))) else . end' "$manifest.bak" > "$manifest"
      echo "Cleaned icon references in $manifest."
    else
      echo "Skipping $manifest: not a JSON object."
    fi
  else
    echo "Skipping $manifest: file is empty or missing."
  fi
done

# 4. Remove manifest references to missing SVGs
for manifest in "${MANIFESTS[@]}"; do
  if [ -f "$manifest" ]; then
    sed -i.bak '/download-icon.min.svg/d' "$manifest"
    echo "Removed SVG references in $manifest."
  fi
done

# 5. Clean Xcode build folder
BUILD_DIR="$PROJECT_ROOT/LogGPT/build"
if [ -d "$BUILD_DIR" ]; then
  rm -rf "$BUILD_DIR"
  echo "Cleaned Xcode build folder."
fi

# 6. Clean Xcode DerivedData for this project
DERIVED_DATA_DIR=~/Library/Developer/Xcode/DerivedData
if [ -d "$DERIVED_DATA_DIR" ]; then
  echo "Cleaning DerivedData for LogGPT..."
  find "$DERIVED_DATA_DIR" -maxdepth 1 -type d -name 'LogGPT-*' -exec rm -rf {} +
  echo "Cleaned DerivedData for LogGPT."
else
  echo "No DerivedData directory found."
fi

# 7. Summary
echo "Cleanup complete. Please open Xcode, clean build folder (Shift+Cmd+K), and rebuild your extension."
