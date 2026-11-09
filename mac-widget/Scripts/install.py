#!/usr/bin/env python3
"""Install a verified local update, retaining a recoverable copy of the old app."""
from pathlib import Path
import datetime
import os
import plistlib
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
source = root / 'build/DerivedData/Build/Products/Release/SIMPL.app'
target = Path.home() / 'Applications/SIMPL.app'

def bundle(path):
    with (path / 'Contents/Info.plist').open('rb') as handle:
        return plistlib.load(handle)

if bundle(source).get('CFBundleIdentifier') != 'at.salescrew.simpl.mac':
    raise SystemExit('The build is not the expected SIMPL app.')
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(source)], check=True)
# Avoid replacing an executable currently in use by the companion.
command = str(target / 'Contents/MacOS/SIMPL')
for line in subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True).splitlines():
    parts = line.strip().split(None, 1)
    if len(parts) == 2 and (parts[1] == command or parts[1].startswith(command + ' ')):
        raise SystemExit('Quit the installed SIMPL app before updating.')
target.parent.mkdir(parents=True, exist_ok=True)
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup = root / 'build/Backups' / f'SIMPL-{stamp}.zip'
stage = target.parent / f'.SIMPL-stage-{stamp}.app'
old = target.parent / f'.SIMPL-old-{stamp}.bundle'
if target.exists():
    if bundle(target).get('CFBundleIdentifier') != 'at.salescrew.simpl.mac':
        raise SystemExit('An unrelated app exists at the installation path.')
    backup.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ditto', '-c', '-k', '--keepParent', str(target), str(backup)], check=True)
subprocess.run(['ditto', str(source), str(stage)], check=True)
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(stage)], check=True)
try:
    if target.exists(): target.rename(old)
    stage.rename(target)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(target)], check=True)
except Exception:
    if target.exists(): shutil.rmtree(target)
    if old.exists(): old.rename(target)
    raise
if old.exists(): shutil.rmtree(old)  # The old version is recoverable from backup.
subprocess.run(['/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', '-f', str(target)], check=True)
subprocess.run(['pluginkit', '-a', str(target / 'Contents/PlugIns/SIMPLWidget.appex')], check=True)
# Ask an obsolete extension instance to exit; macOS starts the updated one.
extension = str(target / 'Contents/PlugIns/SIMPLWidget.appex/Contents/MacOS/SIMPLWidget')
for line in subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True).splitlines():
    parts = line.strip().split(None, 1)
    if len(parts) == 2 and parts[1].startswith(extension + ' '):
        import signal
        try: os.kill(int(parts[0]), signal.SIGTERM)
        except ProcessLookupError: pass
print(f'Installed SIMPL {bundle(target).get("CFBundleShortVersionString")} at {target}')
if backup.exists(): print(f'Previous version saved at {backup}')
