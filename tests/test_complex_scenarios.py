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
    """Test parsing of complex ACL rules.

    NOTE: Category analysis tests have been moved to test_category_analysis_api.py
    which tests the full /api/parse endpoint behavior including category grants.
    """
    pass


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

        # Should have expected structure (API returns granted_commands at top level, not granted_categories)
        self.assertIn('granted_commands', result)
        self.assertTrue(isinstance(result['granted_commands'], list))

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

                # Should have redundancy analysis structure (nested under 'analysis' key)
                self.assertIn('analysis', result)
                analysis = result['analysis']
                self.assertIn('has_redundancy', analysis)
                self.assertIn('warnings', analysis)
                self.assertIn('suggestions', analysis)

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

                # API returns 'is_granted' not 'allowed'
                self.assertIn('is_granted', result)
                self.assertEqual(result['is_granted'], expected_allowed, description)

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

        # Version toggle elements (toggle shows just numbers, not full "Redis 7"/"Redis 8")
        self.assertIn('id="versionToggle"', html_content)
        self.assertIn('toggle-option-left">7<', html_content)
        self.assertIn('toggle-option-right">8<', html_content)

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