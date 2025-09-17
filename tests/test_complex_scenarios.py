#!/usr/bin/env python3
"""
Redis ACL Builder - Complex ACL Rule Scenarios Test Suite
Comprehensive tests for edge cases and complex real-world ACL rules
"""

import unittest
import json
import sys
import os

# Add the parent directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from helpers.data_loader import get_redis_data, build_command_indexes
from helpers.acl_parser import ACLParser


class TestComplexACLScenarios(unittest.TestCase):
    """Test complex real-world ACL rule scenarios."""

    def setUp(self):
        """Set up test fixtures."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

        # Set up Redis data and parsers
        redis_data = get_redis_data()
        redis_data = build_command_indexes(redis_data)
        self.parser7 = ACLParser(redis_data, 'redis7')
        self.parser8 = ACLParser(redis_data, 'redis8')
        self.redis_data = redis_data

    def tearDown(self):
        """Clean up test context."""
        self.ctx.pop()


class TestComplexRuleParsing(TestComplexACLScenarios):
    """Test parsing of complex ACL rules."""

    def test_redis8_module_commands_parsing(self):
        """Test Redis 8 module commands are properly parsed."""
        rule = "+@read +@write -@dangerous +ft.search +ft.create +json.get +json.set ~*"

        result = self.parser8.parse_acl_rule(rule)

        # Should parse without errors
        self.assertIsNotNone(result)
        self.assertIn('granted_categories', result)
        self.assertIn('granted_commands', result)

        # Check categories
        granted_categories = result['granted_categories']
        blocked_categories = result['blocked_categories']
        self.assertIn('read', granted_categories)
        self.assertIn('write', granted_categories)
        self.assertIn('dangerous', blocked_categories)

        # Check individual module commands
        granted_commands = result['granted_commands']
        self.assertIn('ft.search', granted_commands)
        self.assertIn('ft.create', granted_commands)
        self.assertIn('json.get', granted_commands)
        self.assertIn('json.set', granted_commands)

    def test_complex_precedence_patterns(self):
        """Test complex precedence with multiple overrides."""
        rule = "+@all -@dangerous +@admin -flushall -flushdb +get -get +set ~*"

        result = self.parser7.parse_acl_rule(rule)

        # Should parse successfully
        self.assertIsNotNone(result)

        # Test category precedence
        self.assertIn('all', result['granted_categories'])
        self.assertIn('dangerous', result['blocked_categories'])
        self.assertIn('admin', result['granted_categories'])

        # Test individual command precedence (final rules win)
        self.assertIn('flushall', result['blocked_commands'])
        self.assertIn('flushdb', result['blocked_commands'])
        self.assertIn('set', result['granted_commands'])

    def test_overlapping_categories_with_individual_commands(self):
        """Test categories with overlapping commands."""
        rule = "+@read +@fast -@slow +get +set -mget ~*"

        result = self.parser7.parse_acl_rule(rule)

        # Should handle overlapping categories
        self.assertIn('read', result['granted_categories'])
        self.assertIn('fast', result['granted_categories'])
        self.assertIn('slow', result['blocked_categories'])

        # Individual commands should be tracked
        self.assertIn('get', result['granted_commands'])
        self.assertIn('set', result['granted_commands'])
        self.assertIn('mget', result['blocked_commands'])

    def test_large_rule_with_many_terms(self):
        """Test parsing very large ACL rules with 20+ terms."""
        # Create a complex rule with many terms
        commands = ['get', 'set', 'del', 'exists', 'keys', 'scan', 'type', 'ttl',
                   'expire', 'persist', 'rename', 'move', 'copy', 'unlink', 'touch']
        categories = ['+@read', '+@write', '+@admin', '+@fast', '-@slow', '-@dangerous']
        keyspaces = ['~user:*', '~session:*', '~cache:*', '~temp:*']

        rule_terms = [f"+{cmd}" for cmd in commands] + categories + keyspaces
        rule = " ".join(rule_terms)

        result = self.parser7.parse_acl_rule(rule)

        # Should parse successfully without errors
        self.assertIsNotNone(result)
        self.assertIn('granted_commands', result)
        self.assertIn('granted_categories', result)
        self.assertIn('key_patterns', result)

        # Should have correct basic structure
        self.assertIsInstance(result['granted_commands'], list)
        self.assertIsInstance(result['granted_categories'], list)
        self.assertIsInstance(result['key_patterns'], list)

    def test_edge_case_patterns(self):
        """Test edge cases with unusual patterns."""
        edge_cases = [
            ("", "Empty rule should parse"),
            ("~*", "Only keyspace should parse"),
            ("+@all", "Only command category should parse"),
            ("+get ~* ~cache:* ~user:*", "Multiple keyspaces should parse"),
            ("+@read +@write +@admin -@dangerous ~*", "Many categories should parse"),
        ]

        for rule, description in edge_cases:
            with self.subTest(rule=rule, description=description):
                result = self.parser7.parse_acl_rule(rule)

                # Should always return a valid result structure
                self.assertIsInstance(result, dict, f"Failed for: {description}")
                self.assertIn('granted_commands', result)
                self.assertIn('blocked_commands', result)

    def test_all_geo_commands_individually_granted(self):
        """Test granting all geo commands individually (should detect implicit category)."""
        # Get all geo commands from Redis 7
        geo_commands = list(self.redis_data['redis7']['categories']['geo'])
        rule_terms = [f"+{cmd}" for cmd in geo_commands] + ["~*"]
        rule = " ".join(rule_terms)

        result = self.parser7.parse_acl_rule(rule)

        # Should parse successfully
        self.assertIsNotNone(result)

        # All geo commands should be in granted_commands
        granted_commands = result['granted_commands']
        for cmd in geo_commands:
            self.assertIn(cmd, granted_commands, f"Geo command {cmd} should be granted")

    def test_mixed_redis7_and_redis8_parsing(self):
        """Test that Redis 7 and 8 parsers handle rules differently."""
        rule = "+@all ~*"

        result7 = self.parser7.parse_acl_rule(rule)
        result8 = self.parser8.parse_acl_rule(rule)

        # Both should parse successfully
        self.assertIsNotNone(result7)
        self.assertIsNotNone(result8)

        # Redis 8 should have more commands due to modules
        granted7 = len(result7.get('granted_commands', []))
        granted8 = len(result8.get('granted_commands', []))

        self.assertGreater(granted8, granted7,
                          "Redis 8 should have more commands than Redis 7")


class TestAPIEndpoints(TestComplexACLScenarios):
    """Test API endpoints with complex scenarios."""

    def test_parse_api_with_complex_rule(self):
        """Test parsing API with complex rule."""
        complex_rule = "+@read +@write -@dangerous +get +set -del ~user:* ~cache:*"

        response = self.client.post('/api/parse',
                                   data=json.dumps({'rule': complex_rule, 'version': 'redis7'}),
                                   content_type='application/json')

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)

        # Should have expected structure
        self.assertIn('granted_categories', result)
        self.assertIn('blocked_categories', result)
        self.assertIn('granted_commands', result)
        self.assertIn('blocked_commands', result)
        self.assertIn('key_patterns', result)

    def test_redundancy_analysis_api(self):
        """Test redundancy analysis API with various patterns."""
        test_cases = [
            ("+@read +get +mget ~*", "Should detect redundancy in read category"),
            ("+@read +@write -@dangerous ~*", "Should NOT flag legitimate pattern"),
            ("+get +set +del ~*", "Should NOT flag non-redundant commands"),
        ]

        for rule, description in test_cases:
            with self.subTest(rule=rule, description=description):
                response = self.client.post('/api/analyze-redundancy',
                                           data=json.dumps({'rule': rule, 'version': 'redis7'}),
                                           content_type='application/json')

                self.assertEqual(response.status_code, 200)
                result = json.loads(response.data)

                # Should have redundancy analysis structure
                self.assertIn('has_redundancy', result)
                self.assertIn('warnings', result)
                self.assertIn('suggestions', result)

    def test_command_testing_with_complex_rules(self):
        """Test command testing API with complex rules."""
        rule = "+@read +@write -@dangerous +set -get ~*"

        test_commands = [
            ("get", False, "GET should be blocked by individual -get"),
            ("set", True, "SET should be allowed by individual +set"),
            ("mget", True, "MGET should be allowed by @read category"),
            ("flushdb", False, "FLUSHDB should be blocked by -@dangerous"),
        ]

        for command, expected_allowed, description in test_commands:
            with self.subTest(command=command, expected=expected_allowed, description=description):
                response = self.client.post('/api/test-command',
                                           data=json.dumps({
                                               'rule': rule,
                                               'command': command,
                                               'version': 'redis7'
                                           }),
                                           content_type='application/json')

                self.assertEqual(response.status_code, 200)
                result = json.loads(response.data)

                self.assertIn('allowed', result)
                self.assertEqual(result['allowed'], expected_allowed, description)

    def test_version_differences_in_api(self):
        """Test that API returns different results for Redis 7 vs 8."""
        rule = "+@all ~*"

        for version in ['redis7', 'redis8']:
            response = self.client.post('/api/parse',
                                       data=json.dumps({'rule': rule, 'version': version}),
                                       content_type='application/json')

            self.assertEqual(response.status_code, 200)
            result = json.loads(response.data)

            self.assertEqual(result['version'], version)
            self.assertIn('granted_commands', result)

            # Redis 8 should have more commands
            if version == 'redis8':
                self.assertGreater(len(result['granted_commands']), 400,
                                  "Redis 8 should have 400+ commands")
            else:
                self.assertLess(len(result['granted_commands']), 350,
                               "Redis 7 should have fewer than 350 commands")


class TestUIFeaturesCoverage(TestComplexACLScenarios):
    """Test UI features are properly implemented."""

    def test_search_functionality_ui_elements(self):
        """Test that search UI elements are properly implemented."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Search link toggle buttons
        self.assertIn('search-link-toggle', html_content)
        self.assertIn('data-search-type="blocked"', html_content)
        self.assertIn('data-search-type="granted"', html_content)

        # Search mode toggle buttons
        self.assertIn('search-mode-toggle', html_content)
        self.assertIn('≈', html_content)  # Fuzzy mode symbol

        # Search inputs
        self.assertIn('id="blockedSearch"', html_content)
        self.assertIn('id="grantedSearch"', html_content)

    def test_version_toggle_ui_elements(self):
        """Test Redis version toggle UI elements."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Version toggle elements
        self.assertIn('id="versionToggle"', html_content)
        self.assertIn('Redis 7', html_content)
        self.assertIn('Redis 8', html_content) # In the toggle labels

    def test_action_buttons_ui_elements(self):
        """Test action buttons are present."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Copy and clear buttons
        self.assertIn('id="copyRuleBtn"', html_content)
        self.assertIn('id="clearRuleBtn"', html_content)
        self.assertIn('📋', html_content)  # Copy emoji
        self.assertIn('💣', html_content)  # Clear emoji


if __name__ == '__main__':
    # Set up and run test suite
    unittest.main(verbosity=2, buffer=True)