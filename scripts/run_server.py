"""Launch script for the ARGUS OSINT Intelligence Engine."""

import argparse
import os
import socket
import sys
from pathlib import Path

# Ensure src is on Python path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "src"))

import uvicorn
from argus.core.config import get_settings


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a TCP port is already bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0


def find_available_port(start_port: int, host: str = "127.0.0.1") -> int:
    """Find the first available port starting from start_port."""
    port = start_port
    while port < 65535:
        if not is_port_in_use(port, host):
            return port
        port += 1
    return start_port


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the ARGUS OSINT Server")
    parser.add_argument("--port", type=int, default=None, help="Port to bind (default: auto-detect)")
    parser.add_argument("--host", type=str, default=None, help="Host to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    settings = get_settings()
    host = args.host or settings.api.host

    requested_port = args.port or int(os.environ.get("ARGUS_PORT", os.environ.get("PORT", settings.api.port)))
    port = find_available_port(requested_port, host)

    if port != requested_port:
        print(f"[*] Port {requested_port} is already in use by another program.")
        print(f"[*] Automatically switched to available port: {port}")

    print("=" * 60)
    print("  ARGUS — OSINT Intelligence Engine")
    print(f"  Web Dashboard & API: http://{host}:{port}")
    print(f"  Storage Data Directory: {settings.app.data_dir}")
    print("=" * 60)

    uvicorn.run(
        "argus.api.main:app",
        host=host,
        port=port,
        reload=False,
    )
