#!/usr/bin/env python3
"""Import only the existing frontend's public client configuration."""
from pathlib import Path
import base64
import json
import os
import sys
from urllib.parse import urlparse
root = Path(__file__).resolve().parents[1]
sources = [root.parent/".env.production.local", root.parent/"frontend/.env.production.local"]
source = Path(sys.argv[1]) if len(sys.argv)>1 else next((path for path in sources if path.is_file()), sources[0])
if not source.is_file():
    sys.exit("Public frontend configuration not found. Pass its .env.production.local path to Scripts/configure.py.")
values={}
for line in source.read_text().splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    key,value=line.split("=",1)
    if key not in {"VITE_SUPABASE_URL","VITE_SUPABASE_PUBLISHABLE_KEY","VITE_API_URL"}: continue
    values[key]=value.strip().strip("\"'")
required={"VITE_SUPABASE_URL","VITE_SUPABASE_PUBLISHABLE_KEY","VITE_API_URL"}
if not required.issubset(values): sys.exit("Public production configuration is incomplete.")
key=values["VITE_SUPABASE_PUBLISHABLE_KEY"]
if not key.startswith("sb_publishable_"):
    try:
        payload=key.split(".")[1]
        role=json.loads(base64.urlsafe_b64decode(payload+"="*((4-len(payload)%4)%4)))["role"]
        if role!="anon": raise ValueError()
    except (ValueError,KeyError,IndexError): sys.exit("Refusing a privileged or invalid client key.")
for name in ("VITE_SUPABASE_URL","VITE_API_URL"):
    u=urlparse(values[name])
    if u.scheme!="https" or not u.hostname or u.username or u.password or u.query or u.fragment:
        sys.exit("Production URLs must use HTTPS without embedded credentials.")
if urlparse(values["VITE_SUPABASE_URL"]).hostname!="xqvexzoswhraqicbmckj.supabase.co":
    sys.exit("Wrong SIMPL project.")
config={"supabaseURL":values["VITE_SUPABASE_URL"],"publishableKey":key,
        "apiURL":values["VITE_API_URL"],"appURL":"https://get-simpl.vercel.app"}
destination=root/"Config/ServiceConfiguration.local.json"
destination.parent.mkdir(exist_ok=True)
os.chmod(destination.parent,0o700)
fd=os.open(destination,os.O_CREAT|os.O_WRONLY|os.O_TRUNC,0o600)
with os.fdopen(fd,"w") as file: json.dump(config,file,indent=2)
os.chmod(destination,0o600)
print("Imported public SIMPL configuration; no account or server credentials copied.")
