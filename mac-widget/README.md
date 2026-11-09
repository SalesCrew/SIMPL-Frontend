# SIMPL for Mac

Native SwiftUI application with menu-bar access and a WidgetKit extension. Requires macOS 14 or newer and Xcode; no additional Swift packages.

## Inkognito filter

The Projects sidebar includes **Inkognito** when its existing Development label is available. This entry matches only that label ID, across original projects. A matching title or column does not count. It creates no board project and changes no labels or cards. The global unread inbox retains its existing cross-workspace behavior.

## Build and install

Import only the frontend's existing public client configuration:

```sh
python3 Scripts/configure.py /path/to/frontend/.env.production.local
```

The importer accepts only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_API_URL`, rejects privileged keys, and writes an ignored local configuration. Never provide a backend secret or a session token. When this directory is inside the frontend repository, the default configuration path is `../.env.production.local`.

Generate the project and select your existing Apple signing team:

```sh
python3 Scripts/project.py
open SIMPL.xcodeproj
```

Quit the installed SIMPL app before installing a signed update:

```sh
./setup.command YOUR_TEAM_ID
```

The setup script builds Release, verifies the signature, backs up the previous installed bundle and registers the updated widget. App and Keychain groups must retain the same signing team to preserve the existing account. Personal Team provisioning requires periodic renewal.

## Verification

```sh
Scripts/test.sh
Scripts/preview.sh
```

Tests and design preview use isolated fixture data. The live application uses the signed-in caller and existing Supabase permissions. Account credentials stay in Data Protection Keychain; local configuration, private caches, provisioning profiles, build artifacts and internal verification notes are excluded from Git.

Version 1.4.2, build 9 adds the label-only Inkognito sidebar filter. Website source is in the parent directory; the API is maintained in SalesCrew/SIMPL-Backend.
