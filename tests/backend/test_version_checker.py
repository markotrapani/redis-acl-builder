"""Tests for version_checker module."""

import unittest
from unittest.mock import patch, Mock
from helpers import version_checker


class TestVersionChecker(unittest.TestCase):
    """Test Docker Hub version checking functionality."""

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_update_available(self, mock_get):
        """Test when a newer version is available."""
        # Mock successful Docker Hub API response with newer version
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'results': [
                {'name': 'latest'},
                {'name': 'v2.5.0-beta'},  # Newer than current
                {'name': 'v2.4.0-beta'},
                {'name': 'not-a-version'}  # Should be skipped
            ]
        }
        mock_get.return_value = mock_response

        result = version_checker.check_docker_updates()

        # Should detect update is available
        self.assertTrue(result['update_available'])
        self.assertEqual(result['latest_version'], 'v2.5.0-beta')
        self.assertIn('docker pull', result['docker_pull_command'])
        self.assertIn('v2.5.0-beta', result['docker_pull_command'])
        self.assertFalse('error' in result)

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_no_update_available(self, mock_get):
        """Test when current version is latest."""
        # Mock Docker Hub response with older versions only
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'results': [
                {'name': 'latest'},
                {'name': 'v2.0.0-beta'},  # Older than current
                {'name': 'v1.0.0-beta'}
            ]
        }
        mock_get.return_value = mock_response

        result = version_checker.check_docker_updates()

        # Should indicate no update available
        self.assertFalse(result['update_available'])
        self.assertFalse('error' in result)

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_api_error(self, mock_get):
        """Test handling of Docker Hub API errors."""
        # Mock failed API response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        result = version_checker.check_docker_updates()

        # Should return error information
        self.assertIn('error', result)
        self.assertIn('Docker Hub API error', result['error'])
        self.assertIn('current_version', result)

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_timeout(self, mock_get):
        """Test handling of network timeout."""
        # Mock timeout exception
        import requests
        mock_get.side_effect = requests.exceptions.Timeout()

        result = version_checker.check_docker_updates()

        # Should return timeout error
        self.assertIn('error', result)
        self.assertIn('timeout', result['error'].lower())

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_network_error(self, mock_get):
        """Test handling of network errors."""
        # Mock network exception
        import requests
        mock_get.side_effect = requests.exceptions.RequestException("Connection failed")

        result = version_checker.check_docker_updates()

        # Should return network error
        self.assertIn('error', result)
        self.assertIn('Network error', result['error'])

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_no_tags(self, mock_get):
        """Test handling when no tags are returned."""
        # Mock response with no tags
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'results': []}
        mock_get.return_value = mock_response

        result = version_checker.check_docker_updates()

        # Should return error about no tags
        self.assertIn('error', result)
        self.assertIn('No Docker tags found', result['error'])

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_no_valid_versions(self, mock_get):
        """Test handling when all tags are invalid versions."""
        # Mock response with only invalid version tags
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'results': [
                {'name': 'latest'},
                {'name': 'not-a-version'},
                {'name': 'another-invalid-tag'}
            ]
        }
        mock_get.return_value = mock_response

        result = version_checker.check_docker_updates()

        # Should return error about no valid versions
        self.assertIn('error', result)
        self.assertIn('No valid version tags found', result['error'])

    @patch('helpers.version_checker.requests.get')
    def test_check_docker_updates_exception_handling(self, mock_get):
        """Test handling of unexpected exceptions."""
        # Mock unexpected exception
        mock_get.side_effect = Exception("Unexpected error")

        result = version_checker.check_docker_updates()

        # Should return error with exception message
        self.assertIn('error', result)
        self.assertIn('Unexpected error', result['error'])

    @patch('helpers.version_checker.requests.get')
    def test_docker_commands_format(self, mock_get):
        """Test that Docker commands are correctly formatted."""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'results': [
                {'name': 'v2.5.0-beta'}
            ]
        }
        mock_get.return_value = mock_response

        result = version_checker.check_docker_updates()

        # Check pull command format
        self.assertIn('docker pull markotrapani608/redis-acl-builder:v2.5.0-beta',
                     result['docker_pull_command'])

        # Check upgrade command format
        self.assertIn('docker rm -f redis-acl-builder',
                     result['docker_upgrade_command'])
        self.assertIn('docker run -d', result['docker_upgrade_command'])
        self.assertIn('--name redis-acl-builder', result['docker_upgrade_command'])
        self.assertIn('-p 7380:7380', result['docker_upgrade_command'])
        self.assertIn('markotrapani608/redis-acl-builder:v2.5.0-beta',
                     result['docker_upgrade_command'])

    @patch('helpers.__version__', 'invalid-version-@@@@')
    @patch('helpers.version_checker.requests.get')
    def test_invalid_current_version(self, mock_get):
        """Test handling of invalid current version format."""
        # This should trigger the version parsing exception (lines 35-37)
        result = version_checker.check_docker_updates()

        # Should return error about invalid version format
        self.assertIn('error', result)
        self.assertIn('Invalid current version format', result['error'])
        self.assertIn('current_version', result)


if __name__ == '__main__':
    unittest.main()
