"""Integration tests for Redis ACL Builder.

These tests validate complete API workflows, testing the full request → parse → response cycle.
Unlike unit tests, these catch integration issues between components.
"""

import unittest
import json
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from app import app


class TestIntegrationWorkflows(unittest.TestCase):
    """Test complete user workflows through the API."""

    def setUp(self):
        """Set up test client."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def test_complete_acl_workflow_simple(self):
        """Test complete workflow: parse rule → test command → validate."""
        # Step 1: Parse ACL rule
        parse_response = self.client.post('/api/parse',
                                         json={'rule': '+@read ~cache:*', 'version': 'redis7'})
        self.assertEqual(parse_response.status_code, 200)
        parse_data = json.loads(parse_response.data)
        self.assertTrue(parse_data['success'])

        # Verify granted commands include GET
        granted_commands = parse_data['granted_commands']
        self.assertIn('get', granted_commands)

        # Step 2: Test specific command from granted set
        test_response = self.client.post('/api/test-command',
                                        json={'rule': '+@read ~cache:*', 'command': 'GET', 'version': 'redis7'})
        self.assertEqual(test_response.status_code, 200)
        test_data = json.loads(test_response.data)
        self.assertTrue(test_data['success'])
        self.assertTrue(test_data['is_granted'])

        # Step 3: Test with key pattern
        key_test_response = self.client.post('/api/test-command-key',
                                            json={
                                                'rule': '+@read ~cache:*',
                                                'command': 'GET',
                                                'key': 'cache:user:123',
                                                'version': 'redis7'
                                            })
        self.assertEqual(key_test_response.status_code, 200)
        key_data = json.loads(key_test_response.data)
        self.assertTrue(key_data['success'])
        self.assertTrue(key_data['is_allowed'])
        self.assertTrue(key_data['key_access_granted'])

    def test_complete_acl_workflow_complex_selectors(self):
        """Test workflow with complex selector-based ACL rules."""
        rule = "+@read (+@write -@dangerous)"

        # Parse rule with selector
        parse_response = self.client.post('/api/parse',
                                         json={'rule': rule, 'version': 'redis8'})
        self.assertEqual(parse_response.status_code, 200)
        parse_data = json.loads(parse_response.data)
        self.assertTrue(parse_data['success'])

        # Verify selector was parsed
        self.assertGreater(len(parse_data['parsed_rule']['selectors']), 0)

        # Test read command (granted by root)
        get_response = self.client.post('/api/test-command',
                                       json={'rule': rule, 'command': 'GET', 'version': 'redis8'})
        get_data = json.loads(get_response.data)
        self.assertTrue(get_data['is_granted'])

        # Test write command (granted by selector, but not dangerous)
        set_response = self.client.post('/api/test-command',
                                       json={'rule': rule, 'command': 'SET', 'version': 'redis8'})
        set_data = json.loads(set_response.data)
        self.assertTrue(set_data['is_granted'])

        # Test dangerous write command (denied by selector)
        flushall_response = self.client.post('/api/test-command',
                                            json={'rule': rule, 'command': 'FLUSHALL', 'version': 'redis8'})
        flushall_data = json.loads(flushall_response.data)
        self.assertFalse(flushall_data['is_granted'])

    def test_error_handling_workflow(self):
        """Test that errors propagate correctly through the workflow."""
        # Invalid category - parser should handle it gracefully and just skip it
        invalid_response = self.client.post('/api/parse',
                                           json={'rule': '+@invalid_category', 'version': 'redis7'})
        # Should return error for invalid category
        self.assertEqual(invalid_response.status_code, 400)

        # Invalid version
        bad_version_response = self.client.post('/api/parse',
                                               json={'rule': '+@all', 'version': 'redis99'})
        self.assertEqual(bad_version_response.status_code, 400)
        data = json.loads(bad_version_response.data)
        self.assertTrue(data['error'])

    def test_optimization_workflow(self):
        """Test rule optimization workflow."""
        # Create a rule that can be optimized
        # Use a clear redundancy: granting same commands twice
        inefficient_rule = '+get +set +get +set'

        # Get optimization suggestion
        optimize_response = self.client.post('/api/optimize-rule',
                                            json={'rule': inefficient_rule, 'version': 'redis7'})
        self.assertEqual(optimize_response.status_code, 200)
        data = json.loads(optimize_response.data)
        self.assertTrue(data['success'])

        # Should optimize by removing duplicates or finding category
        # Just verify the API works - optimization algorithm is tested elsewhere
        self.assertIsNotNone(data['optimized_rule'])

        # Verify optimized rule grants same commands
        original_parse = self.client.post('/api/parse',
                                         json={'rule': inefficient_rule, 'version': 'redis7'})
        optimized_parse = self.client.post('/api/parse',
                                          json={'rule': data['optimized_rule'], 'version': 'redis7'})

        original_data = json.loads(original_parse.data)
        optimized_data = json.loads(optimized_parse.data)

        # Should grant same commands
        self.assertEqual(
            set(original_data['granted_commands']),
            set(optimized_data['granted_commands'])
        )

    def test_redundancy_analysis_workflow(self):
        """Test redundancy analysis workflow."""
        redundant_rule = '+@read +@read'

        # Analyze redundancy
        response = self.client.post('/api/analyze-redundancy',
                                   json={'rule': redundant_rule, 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

        # Should detect redundancy
        self.assertGreater(len(data['analysis']['redundant_terms']), 0)
        self.assertIn('+@read', [term['term'] for term in data['analysis']['redundant_terms']])

    def test_command_info_workflow(self):
        """Test command information lookup workflow."""
        # Get info for GET command
        response = self.client.post('/api/command-info',
                                   json={'command': 'GET', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

        # Should return categories
        self.assertGreater(len(data['categories']), 0)
        self.assertIn('read', data['categories'])

    def test_search_commands_workflow(self):
        """Test command search workflow."""
        # Search for 'get' commands
        response = self.client.post('/api/search-commands',
                                   json={'pattern': 'get', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

        # Should find GET and other get commands
        commands = [cmd['command'] for cmd in data['results']]
        self.assertIn('get', commands)

    def test_categories_listing_workflow(self):
        """Test categories listing workflow."""
        # /api/categories is GET, not POST
        response = self.client.get('/api/categories?version=redis7')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

        # Should return all categories
        self.assertGreater(len(data['categories']), 20)
        self.assertIn('read', data['categories'])
        self.assertIn('write', data['categories'])
        self.assertIn('admin', data['categories'])

    def test_redis_version_switching_workflow(self):
        """Test switching between Redis versions preserves correctness."""
        rule = '+@all -@admin'

        # Parse with Redis 7
        redis7_response = self.client.post('/api/parse',
                                          json={'rule': rule, 'version': 'redis7'})
        redis7_data = json.loads(redis7_response.data)

        # Parse with Redis 8
        redis8_response = self.client.post('/api/parse',
                                          json={'rule': rule, 'version': 'redis8'})
        redis8_data = json.loads(redis8_response.data)

        # Both should succeed
        self.assertTrue(redis7_data['success'])
        self.assertTrue(redis8_data['success'])

        # Redis 8 should have more commands (496 vs 311)
        self.assertGreater(
            len(redis8_data['granted_commands']),
            len(redis7_data['granted_commands'])
        )

    def test_key_pattern_glob_matching_workflow(self):
        """Test key pattern glob matching in integrated tester."""
        rule = '+@all ~cache:*'

        # Should allow keys matching pattern
        match_response = self.client.post('/api/test-command-key',
                                         json={
                                             'rule': rule,
                                             'command': 'GET',
                                             'key': 'cache:user:123',
                                             'version': 'redis7'
                                         })
        match_data = json.loads(match_response.data)
        self.assertTrue(match_data['key_access_granted'])

        # Should deny keys not matching pattern
        no_match_response = self.client.post('/api/test-command-key',
                                            json={
                                                'rule': rule,
                                                'command': 'GET',
                                                'key': 'session:abc',
                                                'version': 'redis7'
                                            })
        no_match_data = json.loads(no_match_response.data)
        self.assertFalse(no_match_data['key_access_granted'])


if __name__ == '__main__':
    unittest.main()
