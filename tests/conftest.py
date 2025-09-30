"""
Pytest configuration and shared fixtures
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from helpers.data_loader import get_redis_data, build_command_indexes
from helpers.acl_parser import ACLParser


@pytest.fixture(scope='session')
def redis_data():
    """Load Redis data once for entire test session"""
    data = get_redis_data()
    return build_command_indexes(data)


@pytest.fixture(scope='session')
def parser_redis7(redis_data):
    """Create Redis 7 parser instance"""
    return ACLParser(redis_data, 'redis7')


@pytest.fixture(scope='session')
def parser_redis8(redis_data):
    """Create Redis 8 parser instance"""
    return ACLParser(redis_data, 'redis8')


@pytest.fixture
def flask_app():
    """Create Flask app for testing"""
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(flask_app):
    """Create test client"""
    return flask_app.test_client()


@pytest.fixture
def app_context(flask_app):
    """Create application context"""
    with flask_app.app_context():
        yield
