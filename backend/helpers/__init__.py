
"""
Redis ACL Builder - Helper Modules Package

This package contains helper modules for the Redis ACL Builder:
- data_loader: Redis command and category data management
- acl_parser: ACL rule parsing and evaluation logic
"""

# Note: We don't import the modules here to avoid circular imports
# and potential issues with Flask app initialization.
# The main app.py will import directly from the modules as needed.

__version__ = "2.7.22-beta"
__author__ = "Redis ACL Builder"