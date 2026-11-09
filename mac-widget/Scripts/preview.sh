#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")/.."
swift build --build-system native --product SIMPLDesktop
task_app="$PWD/build/SIMPL Design Preview.app"
mkdir -p "$task_app/Contents/MacOS" "$task_app/Contents/Resources"
cp .build/debug/SIMPLDesktop "$task_app/Contents/MacOS/SIMPLDesktop"
cp Resources/AppIcon.icns "$task_app/Contents/Resources/AppIcon.icns"
cp Resources/SIMPLMark.png "$task_app/Contents/Resources/SIMPLMark.png"
/usr/libexec/PlistBuddy -c "Clear dict" "$task_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add CFBundleIdentifier string at.salescrew.simpl.preview" "$task_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add CFBundleExecutable string SIMPLDesktop" "$task_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add CFBundleName string SIMPL Preview" "$task_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add CFBundlePackageType string APPL" "$task_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add CFBundleIconFile string AppIcon" "$task_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add NSPrincipalClass string NSApplication" "$task_app/Contents/Info.plist"
codesign --force --sign - "$task_app"
open -n "$task_app" --args --preview --reset-preview
