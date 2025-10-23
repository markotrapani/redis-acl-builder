"""
Pytest tests for API validation with Pydantic models
"""

import pytest
import json


class TestPydanticValidation:
    """Test Pydantic validation in API endpoints"""

    @pytest.mark.parametrize("endpoint,payload,expected_error", [
        # Invalid version tests
        ('/api/parse', {'rule': '+@read', 'version': 'redis9'}, 'Invalid Redis version'),
        ('/api/test-command', {'rule': '+@read', 'command': 'GET', 'version': 'invalid'}, 'Invalid Redis version'),

        # Empty command tests
        ('/api/test-command', {'rule': '+@read', 'command': '', 'version': 'redis7'}, 'String should have at least 1 character'),
        ('/api/test-command', {'rule': '+@read', 'command': '   ', 'version': 'redis7'}, 'Command cannot be empty'),

        # Empty key tests (for test-command-key endpoint)
        ('/api/test-command-key', {'rule': '+@read ~*', 'command': 'GET', 'key': '', 'version': 'redis7'}, 'String should have at least 1 character'),
        ('/api/test-command-key', {'rule': '+@read ~*', 'command': 'GET', 'key': '   ', 'version': 'redis7'}, 'Key cannot be empty'),

        # Empty pattern tests
        ('/api/search-commands', {'pattern': '', 'version': 'redis7'}, 'String should have at least 1 character'),
        ('/api/search-commands', {'pattern': '   ', 'version': 'redis7'}, 'Search pattern cannot be empty'),

        # Missing required fields
        ('/api/test-command', {'rule': '+@read', 'version': 'redis7'}, 'Field required'),
    ])
    def test_validation_errors(self, client, endpoint, payload, expected_error):
        """Test that Pydantic validation catches invalid inputs"""
        response = client.post(endpoint, json=payload)
        assert response.status_code == 400

        data = json.loads(response.data)
        assert data['error'] is True
        assert expected_error in data['message']

    def test_valid_parse_request(self, client):
        """Test valid parse request passes validation"""
        response = client.post('/api/parse', json={
            'rule': '+@read',
            'version': 'redis8'
        })
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True
        assert 'granted_commands' in data

    def test_valid_test_command_request(self, client):
        """Test valid test-command request passes validation"""
        response = client.post('/api/test-command', json={
            'rule': '+@read',
            'command': 'GET',
            'version': 'redis8'
        })
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True
        assert data['command'] == 'GET'
        assert data['is_granted'] is True

    def test_valid_search_request_with_limit(self, client):
        """Test valid search request with custom limit"""
        response = client.post('/api/search-commands', json={
            'pattern': 'get',
            'limit': 10,
            'version': 'redis8'
        })
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['success'] is True
        assert len(data['results']) <= 10

    @pytest.mark.parametrize("limit", [0, -1, 1001])
    def test_invalid_search_limits(self, client, limit):
        """Test that invalid search limits are rejected"""
        response = client.post('/api/search-commands', json={
            'pattern': 'get',
            'limit': limit,
            'version': 'redis8'
        })
        assert response.status_code == 400

    def test_default_version_is_redis8(self, client):
        """Test that default version is redis8 when not specified"""
        response = client.post('/api/parse', json={'rule': '+@read'})
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['version'] == 'redis8'

    def test_command_normalization(self, client):
        """Test that commands are normalized (trimmed)"""
        response = client.post('/api/test-command', json={
            'rule': '+@read',
            'command': '  GET  ',
            'version': 'redis8'
        })
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['command'] == 'GET'

    def test_pattern_normalization(self, client):
        """Test that search patterns are normalized (trimmed)"""
        response = client.post('/api/search-commands', json={
            'pattern': '  get  ',
            'version': 'redis8'
        })
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data['pattern'] == 'get'

    def test_no_json_data(self, client):
        """Test that missing JSON data is rejected"""
        response = client.post('/api/parse', data='not json')
        assert response.status_code == 400

        data = json.loads(response.data)
        assert 'Invalid request data' in data['message'] or 'Content-Type' in data['message']

    def test_categories_get_endpoint_validation(self, client):
        """Test GET endpoint validation for categories"""
        # Valid version
        response = client.get('/api/categories?version=redis8')
        assert response.status_code == 200

        # Invalid version
        response = client.get('/api/categories?version=redis9')
        assert response.status_code == 400

        data = json.loads(response.data)
        assert 'Invalid Redis version' in data['message']
