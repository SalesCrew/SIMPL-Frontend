#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")/.."
task_developer="${DEVELOPER_DIR:-$(xcode-select -p)}"
if [[ "$task_developer" == *CommandLineTools ]]; then
    swift test --build-system native --disable-xctest \
        -Xswiftc -F -Xswiftc "$task_developer/Library/Developer/Frameworks" \
        -Xswiftc -load-plugin-library -Xswiftc "$task_developer/usr/lib/swift/host/plugins/testing/libTestingMacros.dylib" \
        -Xlinker -rpath -Xlinker "$task_developer/Library/Developer/Frameworks"
else
    swift test --disable-xctest
fi
