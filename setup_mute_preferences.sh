#!/bin/bash
# Quick Start Script for Device Mute Preferences
# This script sets up the database table and runs basic tests

set -e  # Exit on error

echo "════════════════════════════════════════════════════════"
echo "  Device Mute Preferences - Quick Start"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    exit 1
fi

# Check if required Python packages are installed
echo "📦 Checking dependencies..."
python3 -c "import sqlalchemy" 2>/dev/null || {
    echo "❌ Error: SQLAlchemy not installed"
    echo "   Run: pip install sqlalchemy"
    exit 1
}

python3 -c "import psycopg2" 2>/dev/null || {
    echo "❌ Error: psycopg2 not installed"
    echo "   Run: pip install psycopg2-binary"
    exit 1
}

echo "✓ Dependencies OK"
echo ""

# Step 1: Create database table
echo "─────────────────────────────────────────────────────────"
echo "Step 1: Creating database table"
echo "─────────────────────────────────────────────────────────"
python3 create_mute_preferences_table.py
echo ""

# Step 2: Check if server is running
echo "─────────────────────────────────────────────────────────"
echo "Step 2: Checking server status"
echo "─────────────────────────────────────────────────────────"
if curl -s http://localhost:8000/api/v1/devices > /dev/null 2>&1; then
    echo "✓ Server is running"
    echo ""
    
    # Step 3: Run tests
    echo "─────────────────────────────────────────────────────────"
    echo "Step 3: Running tests"
    echo "─────────────────────────────────────────────────────────"
    python3 test_mute_preferences.py
    echo ""
    
    echo "════════════════════════════════════════════════════════"
    echo "✅ Setup complete! All tests passed."
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "📱 Next steps:"
    echo "   1. Update your mobile app to use the new endpoints"
    echo "   2. See MUTE_PREFERENCES_GUIDE.md for integration details"
    echo "   3. See IMPLEMENTATION_SUMMARY.md for API examples"
    echo ""
else
    echo "⚠️  Server is not running on http://localhost:8000"
    echo ""
    echo "To start the server, run:"
    echo "  uvicorn app:app --reload --host 0.0.0.0 --port 8000"
    echo ""
    echo "Then run this script again to test."
    echo ""
    echo "Or run tests manually:"
    echo "  python3 test_mute_preferences.py"
    echo ""
fi

echo "📚 Documentation:"
echo "   • IMPLEMENTATION_SUMMARY.md - Quick reference"
echo "   • MUTE_PREFERENCES_GUIDE.md - Complete guide"
echo "   • ARCHITECTURE_DIAGRAM.md   - System design"
echo ""
