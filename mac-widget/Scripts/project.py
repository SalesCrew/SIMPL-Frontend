#!/usr/bin/env python3
"""Generate native Xcode app and WidgetKit targets without a build dependency."""
from pathlib import Path
import hashlib
import json
import plistlib
import re

ROOT = Path(__file__).resolve().parents[1]
# Regeneration must preserve the team selected in Xcode.
existing_project = ROOT / "SIMPL.xcodeproj/project.pbxproj"
teams = set(re.findall(r'DEVELOPMENT_TEAM\s*=\s*"?([A-Z0-9]{10})"?;', existing_project.read_text())) if existing_project.exists() else set()
objects = {}
def ident(name): return hashlib.sha256(name.encode()).hexdigest()[:24].upper()
def quote(value): return json.dumps(str(value))
def add(name, body):
    key = ident(name); objects[key] = body; return key
def array(values): return "(" + ", ".join(values) + (",)" if values else ")")
refs = {}
paths = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "Sources").rglob("*.swift"))
paths += ["Config/ServiceConfiguration.local.json", "Resources/PrivacyInfo.xcprivacy", "Resources/AppIcon.icns", "Resources/SIMPLMark.png"]
for path in paths:
    kind = "sourcecode.swift" if path.endswith(".swift") else "text.json" if path.endswith(".json") else "image.icns" if path.endswith(".icns") else "image.png" if path.endswith(".png") else "text.xml"
    refs[path] = add(path, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {quote(path)}; sourceTree = "<group>";')
app_product = add("app-product", 'isa = PBXFileReference; explicitFileType = wrapper.application; path = "SIMPL.app"; sourceTree = BUILT_PRODUCTS_DIR;')
widget_product = add("widget-product", 'isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; path = "SIMPLWidget.appex"; sourceTree = BUILT_PRODUCTS_DIR;')
product_group = add("products", f'isa = PBXGroup; children = {array([app_product, widget_product])}; name = Products; sourceTree = "<group>";')
root_group = add("root-group", f'isa = PBXGroup; children = {array(list(refs.values())+[product_group])}; sourceTree = "<group>";')
project_id, app_id, widget_id = ident("project"), ident("app-target"), ident("widget-target")
proxy = add("widget-proxy", f'isa = PBXContainerItemProxy; containerPortal = {project_id}; proxyType = 1; remoteGlobalIDString = {widget_id}; remoteInfo = SIMPLWidget;')
dependency = add("widget-dependency", f'isa = PBXTargetDependency; target = {widget_id}; targetProxy = {proxy};')
embed_file = add("embed-file", f'isa = PBXBuildFile; fileRef = {widget_product}; settings = {{ ATTRIBUTES = (RemoveHeadersOnCopy,); }};')
embed = add("embed-phase", f'isa = PBXCopyFilesBuildPhase; buildActionMask = 2147483647; dstPath = ""; dstSubfolderSpec = 13; files = ({embed_file},); name = "Embed App Extensions"; runOnlyForDeploymentPostprocessing = 0;')
common = {
    "MACOSX_DEPLOYMENT_TARGET": "14.0", "SDKROOT": "macosx", "SWIFT_VERSION": "6.0",
    "ALWAYS_SEARCH_USER_PATHS": "NO", "COPY_PHASE_STRIP": "NO",
    "CODE_SIGN_STYLE": "Automatic", "ENABLE_APP_SANDBOX": "YES",
    "ENABLE_HARDENED_RUNTIME": "YES", "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
    "CURRENT_PROJECT_VERSION": "9", "MARKETING_VERSION": "1.4.2",
    "SIMPL_APP_GROUP": "$(DEVELOPMENT_TEAM).at.salescrew.simpl.shared",
    "SIMPL_KEYCHAIN_GROUP": "$(DEVELOPMENT_TEAM).at.salescrew.simpl.mac.shared",
    "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/../Frameworks",
}
if len(teams) == 1: common["DEVELOPMENT_TEAM"] = next(iter(teams))
def settings_text(values): return "{ " + " ".join(f'{k} = {quote(v)};' for k,v in values.items()) + " }"
def configs(name, settings):
    ids = []
    for variant in ("Debug", "Release"):
        values = dict(settings, SWIFT_OPTIMIZATION_LEVEL="-Onone" if variant == "Debug" else "-O")
        if variant == "Debug": values["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = "DEBUG"
        ids.append(add(name+variant, f'isa = XCBuildConfiguration; buildSettings = {settings_text(values)}; name = {variant};'))
    return add(name+"configs", f'isa = XCConfigurationList; buildConfigurations = {array(ids)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
for name, folder, target_id, product in [("SIMPL", "SIMPLDesktop", app_id, app_product), ("SIMPLWidget", "SIMPLWidgetExtension", widget_id, widget_product)]:
    swift = [p for p in paths if p.endswith(".swift") and ("/SIMPLCore/" in p or "/SIMPLShared/" in p or f"/{folder}/" in p)]
    builds = [add(name+p, f'isa = PBXBuildFile; fileRef = {refs[p]};') for p in swift]
    sources = add(name+"sources", f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {array(builds)}; runOnlyForDeploymentPostprocessing = 0;')
    resource_builds = [add(name+p, f'isa = PBXBuildFile; fileRef = {refs[p]};') for p in paths
                       if p.endswith((".xcprivacy", ".png")) or (name == "SIMPL" and p.endswith(".icns"))]
    resources = add(name+"resources", f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = {array(resource_builds)}; runOnlyForDeploymentPostprocessing = 0;')
    script = 'cp "$SRCROOT/Config/ServiceConfiguration.local.json" "$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/ServiceConfiguration.json"'
    copy_config = add(name+"config-copy", f'isa = PBXShellScriptBuildPhase; buildActionMask = 2147483647; files = (); inputPaths = ("$(SRCROOT)/Config/ServiceConfiguration.local.json",); outputPaths = ("$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/ServiceConfiguration.json",); runOnlyForDeploymentPostprocessing = 0; shellPath = /bin/sh; shellScript = {quote(script)};')
    settings = dict(common, PRODUCT_BUNDLE_IDENTIFIER="at.salescrew.simpl.mac"+(".widget" if folder == "SIMPLWidgetExtension" else ""),
        PRODUCT_NAME=name, INFOPLIST_FILE=f"Resources/{name}-Info.plist", CODE_SIGN_ENTITLEMENTS="Resources/App.entitlements" if name == "SIMPL" else "Resources/Shared.entitlements",
        GENERATE_INFOPLIST_FILE="NO")
    if folder == "SIMPLWidgetExtension":
        settings.update(APPLICATION_EXTENSION_API_ONLY="YES", SKIP_INSTALL="YES",
            LD_RUNPATH_SEARCH_PATHS="$(inherited) @executable_path/../Frameworks @executable_path/../../../../Frameworks")
    config_list = configs(name, settings)
    phases = [sources, resources, copy_config] + ([embed] if name == "SIMPL" else [])
    deps = [dependency] if name == "SIMPL" else []
    objects[target_id] = f'isa = PBXNativeTarget; buildConfigurationList = {config_list}; buildPhases = {array(phases)}; buildRules = (); dependencies = {array(deps)}; name = {name}; productName = {name}; productReference = {product}; productType = {quote("com.apple.product-type.application" if name == "SIMPL" else "com.apple.product-type.app-extension")};'
project_configs = configs("project", {})
objects[project_id] = f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 1600; BuildIndependentTargetsInParallel = YES; TargetAttributes = {{ {app_id} = {{ CreatedOnToolsVersion = 16.0; }}; {widget_id} = {{ CreatedOnToolsVersion = 16.0; }}; }}; }}; buildConfigurationList = {project_configs}; compatibilityVersion = "Xcode 14.0"; developmentRegion = de; hasScannedForEncodings = 0; knownRegions = (de, en, Base); mainGroup = {root_group}; productRefGroup = {product_group}; projectDirPath = ""; projectRoot = ""; targets = ({app_id}, {widget_id},);'
project = ROOT/"SIMPL.xcodeproj"
project.mkdir(exist_ok=True)
(project/"project.pbxproj").write_text("// !$*UTF8*$!\n{\n archiveVersion = 1; classes = {}; objectVersion = 56;\n objects = {\n" + "\n".join(f" {key} = {{ {body} }};" for key,body in objects.items()) + f"\n }};\n rootObject = {project_id};\n}}\n")
scheme_dir=project/"xcshareddata/xcschemes"
scheme_dir.mkdir(parents=True,exist_ok=True)
(scheme_dir/"SIMPL.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
 <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{app_id}" BuildableName="SIMPL.app" BlueprintName="SIMPL" ReferencedContainer="container:SIMPL.xcodeproj"/></BuildActionEntry>
 </BuildActionEntries></BuildAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{app_id}" BuildableName="SIMPL.app" BlueprintName="SIMPL" ReferencedContainer="container:SIMPL.xcodeproj"/></BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"/>
 <AnalyzeAction buildConfiguration="Debug"/>
 <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
resources=ROOT/"Resources"
resources.mkdir(exist_ok=True)
for name, extension in [("SIMPL", False), ("SIMPLWidget", True)]:
    info = {
        "CFBundleDevelopmentRegion":"de", "CFBundleDisplayName":"SIMPL", "CFBundleExecutable":"$(EXECUTABLE_NAME)",
        "CFBundleIdentifier":"$(PRODUCT_BUNDLE_IDENTIFIER)", "CFBundleName":"$(PRODUCT_NAME)",
        "CFBundlePackageType":"XPC!" if extension else "APPL", "CFBundleShortVersionString":"$(MARKETING_VERSION)",
        "CFBundleVersion":"$(CURRENT_PROJECT_VERSION)", "LSMinimumSystemVersion":"14.0",
        "SIMPLAppGroup":"$(SIMPL_APP_GROUP)", "SIMPLKeychainGroup":"$(SIMPL_KEYCHAIN_GROUP)",
    }
    if extension: info["NSExtension"]={"NSExtensionPointIdentifier":"com.apple.widgetkit-extension"}
    else:
        info["NSPrincipalClass"]="NSApplication"
        info["CFBundleIconFile"]="AppIcon"
        info["CFBundleURLTypes"]=[{"CFBundleURLName":"SIMPL","CFBundleURLSchemes":["simplmac"]}]
    (resources/f"{name}-Info.plist").write_bytes(plistlib.dumps(info))
(resources/"Shared.entitlements").write_bytes(plistlib.dumps({
    "com.apple.security.app-sandbox":True, "com.apple.security.network.client":True,
    "com.apple.security.application-groups":["$(SIMPL_APP_GROUP)"], "keychain-access-groups":["$(SIMPL_KEYCHAIN_GROUP)"],
}))
app_entitlements = plistlib.loads((resources/"Shared.entitlements").read_bytes())
app_entitlements["com.apple.security.files.user-selected.read-write"] = True
(resources/"App.entitlements").write_bytes(plistlib.dumps(app_entitlements))
(resources/"PrivacyInfo.xcprivacy").write_bytes(plistlib.dumps({
    "NSPrivacyTracking":False, "NSPrivacyTrackingDomains":[],
    "NSPrivacyCollectedDataTypes":[
        {"NSPrivacyCollectedDataType":category,
         "NSPrivacyCollectedDataTypeLinked":True,
         "NSPrivacyCollectedDataTypeTracking":False,
         "NSPrivacyCollectedDataTypePurposes":["NSPrivacyCollectedDataTypePurposeAppFunctionality"]}
        for category in ("NSPrivacyCollectedDataTypeEmailAddress", "NSPrivacyCollectedDataTypeUserID")
    ],
    "NSPrivacyAccessedAPITypes":[]
}))
print("Created SIMPL.xcodeproj: app + embedded WidgetKit extension.")
