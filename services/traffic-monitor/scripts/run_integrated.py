"""Run the bundled monitor behind the authenticated blog proxy."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.app import Application, BoundedHTTPServer, handler_for

if sys.version_info < (3, 11):
    raise RuntimeError("Traffic monitor requires Python 3.11 or newer")
key = os.environ["TRAFFIC_BRIDGE_KEY"]
app = Application(os.environ["TRAFFIC_DATA_DIR"], key, user="博客管理员", base="/api/traffic",
                  public_url=os.environ["TRAFFIC_PUBLIC_URL"], secure=True)
server = BoundedHTTPServer(("127.0.0.1", int(os.environ.get("TRAFFIC_PORT", "8098"))), handler_for(app))
print("Integrated traffic monitor ready", flush=True)
try:
    server.serve_forever()
finally:
    server.server_close()
