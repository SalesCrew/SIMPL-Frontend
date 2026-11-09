#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
task_python="$(command -v python3)"
"$task_python" Scripts/configure.py
"$task_python" Scripts/project.py
if ! xcrun --find appintentsmetadataprocessor >/dev/null 2>&1 && [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
    export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
if ! xcrun --find appintentsmetadataprocessor >/dev/null 2>&1; then
    print "Install full Xcode from the App Store and launch it once."
    print "Then open SIMPL.xcodeproj and choose your Apple signing team for both targets."
    exit 1
fi
if [[ $# -eq 0 ]]; then
    open SIMPL.xcodeproj
    print "Choose your Apple signing team in both targets, then Run the SIMPL scheme."
    print "Or run: ./setup.command YOUR_TEAM_ID"
    exit 0
fi
if [[ ! "$1" =~ '^[A-Z0-9]{10}$' ]]; then
    print "Expected a 10-character Apple Developer Team ID."
    exit 1
fi
xcodebuild -project SIMPL.xcodeproj -scheme SIMPL -configuration Release \
    -derivedDataPath build/DerivedData -destination 'platform=macOS' \
    DEVELOPMENT_TEAM="$1" -allowProvisioningUpdates build
"$task_python" Scripts/install.py
open "$HOME/Applications/SIMPL.app"
print "Sign in if needed, then right-click the desktop → Edit Widgets → SIMPL."
