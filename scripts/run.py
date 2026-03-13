# scripts/run.py
#!/usr/bin/env python3
import os
import sys
import subprocess
import webbrowser
from time import sleep

def main():
    print("🚀 Starting AI Waste Management System...")
    
    # Create necessary directories
    os.makedirs("data/collections", exist_ok=True)
    os.makedirs("ml_models", exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    # Set environment variables
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./waste_management.db"
    
    # Start the server
    print("\n📡 Starting FastAPI server...")
    process = subprocess.Popen([
        "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
    ], cwd="backend")
    
    # Wait for server to start
    print("⏳ Waiting for server to start...")
    sleep(3)
    
    # Open browser
    print("\n🌐 Opening web interface...")
    webbrowser.open("http://localhost:8000")
    
    print("\n✅ System is running!")
    print("📍 Web Interface: http://localhost:8000")
    print("📍 API Docs: http://localhost:8000/docs")
    print("📍 Dashboard: http://localhost:8000/dashboard")
    print("\nPress Ctrl+C to stop the server\n")
    
    try:
        process.wait()
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping server...")
        process.terminate()
        process.wait()
        print("✅ Server stopped")

if __name__ == "__main__":
    main()