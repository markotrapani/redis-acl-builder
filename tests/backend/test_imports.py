#!/usr/bin/env python3
"""
Import Test Script - Diagnose import issues
"""
import sys
import os
from importlib.metadata import version

def run_import_diagnostics():
    print("🔍 Redis ACL Builder - Import Diagnostics")
    print("=" * 50)
    
    # Check current directory
    current_dir = os.getcwd()
    print(f"📁 Current directory: {current_dir}")
    
    # Check if we're in the right place
    expected_files = [
        'backend/app.py',
        'backend/helpers',
        'tests/backend',
        'frontend/static',
        'frontend/templates'
    ]
    missing_files = []
    
    for file in expected_files:
        if os.path.exists(file):
            print(f"✅ Found: {file}")
        else:
            print(f"❌ Missing: {file}")
            missing_files.append(file)
    
    if missing_files:
        print(f"\n⚠️  Missing files/directories: {missing_files}")
        print("Please ensure you're running from the project root directory.")
        return False
    
    print("\n📦 Testing Python imports...")
    print("-" * 30)
    
    # Add backend directory to Python path
    backend_dir = os.path.join(current_dir, 'backend')
    sys.path.insert(0, backend_dir)
    
    # Test basic imports
    try:
        import flask
        flask_version = version("flask")
        print(f"✅ Flask {flask_version} imported successfully")
    except ImportError as e:
        print(f"❌ Flask import failed: {e}")
        return False
    
    # Test helpers directory structure
    helpers_dir = os.path.join(backend_dir, 'helpers')
    helpers_init = os.path.join(helpers_dir, '__init__.py')
    data_loader = os.path.join(helpers_dir, 'data_loader.py')
    acl_parser = os.path.join(helpers_dir, 'acl_parser.py')
    
    print(f"\n🔍 Checking helpers directory:")
    print(f"  📁 helpers/: {'✅' if os.path.isdir(helpers_dir) else '❌'}")
    print(f"  📄 __init__.py: {'✅' if os.path.exists(helpers_init) else '❌'}")
    print(f"  📄 data_loader.py: {'✅' if os.path.exists(data_loader) else '❌'}")
    print(f"  📄 acl_parser.py: {'✅' if os.path.exists(acl_parser) else '❌'}")
    
    # Test helper imports
    try:
        from helpers.data_loader import get_redis_data, build_command_indexes
        print("✅ helpers.data_loader imported successfully")
    except ImportError as e:
        print(f"❌ helpers.data_loader import failed: {e}")
        print("   Try creating an empty helpers/__init__.py file")
        return False
    
    try:
        from helpers.acl_parser import ACLParser
        print("✅ helpers.acl_parser imported successfully")
    except ImportError as e:
        print(f"❌ helpers.acl_parser import failed: {e}")
        return False
    
    # Test data loading
    try:
        print("\n📊 Testing data loading...")
        redis_data = get_redis_data()
        redis_data = build_command_indexes(redis_data)
        print(f"✅ Redis data loaded: {len(redis_data['redis7']['commands'])} Redis 7 commands")
        print(f"✅ Redis data loaded: {len(redis_data['redis8']['commands'])} Redis 8 commands")
    except Exception as e:
        print(f"❌ Data loading failed: {e}")
        return False
    
    # Test ACL parser
    try:
        parser = ACLParser(redis_data, 'redis7')
        parsed = parser.parse_acl_rule("+@read")
        print("✅ ACL parser working correctly")
    except Exception as e:
        print(f"❌ ACL parser failed: {e}")
        return False
    
    print("\n🎉 All imports successful!")
    print("✅ Ready to run: python backend/app.py")
    print("✅ Ready to test: pytest tests/backend/")
    
    return True


def test_imports():
    """Pytest entrypoint for import diagnostics."""
    assert run_import_diagnostics()

if __name__ == '__main__':
    success = run_import_diagnostics()
    if not success:
        print(f"\n❌ Import test failed. Please fix the issues above.")
        print(f"💡 Make sure you're in the project root directory with this structure:")
        print(f"   redis_acl_builder/")
        print(f"   ├── app.py")
        print(f"   ├── helpers/")
        print(f"   │   ├── __init__.py")
        print(f"   │   ├── data_loader.py") 
        print(f"   │   └── acl_parser.py")
        print(f"   └── tests/")
        print(f"       └── test_app.py")
        sys.exit(1)
    else:
        print(f"\n✅ All good! Your Redis ACL Builder is ready to run.")
        sys.exit(0)
