#!/usr/bin/env python3
"""
Redis ACL Builder - Advanced Features Test Suite
Tests for new features added in v1.11.0-beta and comprehensive ACL rule scenarios
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


class TestAdvancedFeatures(unittest.TestCase):
    """Test advanced features added in v1.11.0-beta."""

    def setUp(self):
        """Set up test fixtures."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

        # Set up Redis data and parsers
        self.redis_data = get_redis_data()
        self.redis_data = build_command_indexes(self.redis_data)
        self.parser_redis7 = ACLParser(self.redis_data, 'redis7')
        self.parser_redis8 = ACLParser(self.redis_data, 'redis8')

    def tearDown(self):
        """Clean up test context."""
        self.ctx.pop()


class TestImplicitCategoryDetection(TestAdvancedFeatures):
    """Test implicit fully-granted category detection."""

    def test_single_category_all_commands_granted(self):
        """Test detection when all commands in a single category are individually granted."""
        # Get all geo commands for Redis 7
        geo_commands = list(self.redis_data['redis7']['categories']['geo'])
        rule_terms = [f"+{cmd}" for cmd in geo_commands] + ["~*"]
        rule = " ".join(rule_terms)

        result = self.parser_redis7.parse(rule)

        # Should detect @geo as implicitly fully granted
        self.assertIn('geo', result.get('implicit_categories', {}))

    def test_multiple_categories_all_commands_granted(self):
        """Test detection with multiple categories fully granted via individual commands."""
        # Get all commands from string and bitmap categories
        string_commands = list(self.redis_data['redis7']['categories']['string'])
        bitmap_commands = list(self.redis_data['redis7']['categories']['bitmap'])

        all_commands = string_commands + bitmap_commands
        rule_terms = [f"+{cmd}" for cmd in all_commands] + ["~*"]
        rule = " ".join(rule_terms)

        result = self.parser_redis7.parse(rule)

        # Should detect both categories as implicitly granted
        implicit = result.get('implicit_categories', {})
        self.assertIn('string', implicit)
        self.assertIn('bitmap', implicit)

    def test_partial_category_not_detected(self):
        """Test that partial category grants are not detected as implicit."""
        # Grant only half the geo commands
        geo_commands = list(self.redis_data['redis7']['categories']['geo'])
        partial_commands = geo_commands[:len(geo_commands)//2]

        rule_terms = [f"+{cmd}" for cmd in partial_commands] + ["~*"]
        rule = " ".join(rule_terms)

        result = self.parser_redis7.parse(rule)

        # Should NOT detect geo as implicitly granted
        implicit = result.get('implicit_categories', {})
        self.assertNotIn('geo', implicit)

    def test_mixed_explicit_and_implicit_categories(self):
        """Test rules with both explicit category grants and implicit detection."""
        # Explicit read category + all individual write commands
        write_commands = list(self.redis_data['redis7']['categories']['write'])
        rule_terms = ["+@read"] + [f"+{cmd}" for cmd in write_commands] + ["~*"]
        rule = " ".join(rule_terms)

        result = self.parser_redis7.parse(rule)

        # Should have explicit read and implicit write
        self.assertIn('read', result['granted_categories'])
        implicit = result.get('implicit_categories', {})
        self.assertIn('write', implicit)


class TestAutoSimplification(TestAdvancedFeatures):
    """Test automatic rule simplification features."""

    def test_api_detect_simplification_opportunity(self):
        """Test API can detect when rules can be simplified."""
        # Rule with all geo commands individually granted
        geo_commands = list(self.redis_data['redis7']['categories']['geo'])
        rule_terms = [f"+{cmd}" for cmd in geo_commands] + ["~*"]
        rule = " ".join(rule_terms)

        response = self.client.post('/api/analyze-redundancy',
                                   data=json.dumps({'rule': rule, 'version': 'redis7'}),
                                   content_type='application/json')

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)

        # Should suggest simplification
        self.assertTrue(result.get('has_redundancy', False))
        suggestions = result.get('suggestions', [])
        self.assertTrue(any('geo' in suggestion.lower() for suggestion in suggestions))

    def test_simplification_with_mixed_grant_deny(self):
        """Test simplification detection with mixed grant/deny patterns."""
        # All read commands granted, some blocked
        read_commands = list(self.redis_data['redis7']['categories']['read'])
        rule_terms = [f"+{cmd}" for cmd in read_commands] + ["-get", "-mget"] + ["~*"]
        rule = " ".join(rule_terms)

        response = self.client.post('/api/analyze-redundancy',
                                   data=json.dumps({'rule': rule, 'version': 'redis7'}),
                                   content_type='application/json')

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)

        # Should suggest using category with exceptions
        self.assertTrue(result.get('has_redundancy', False))


class TestEnhancedRedundancy(TestAdvancedFeatures):
    """Test enhanced redundancy detection."""

    def test_legitimate_patterns_not_flagged(self):
        """Test that legitimate patterns like '+@read +@write -@dangerous' are not flagged."""
        rule = "+@read +@write -@dangerous ~*"

        response = self.client.post('/api/analyze-redundancy',
                                   data=json.dumps({'rule': rule, 'version': 'redis7'}),
                                   content_type='application/json')

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)

        # Should NOT flag this as redundant
        self.assertFalse(result.get('has_redundancy', True))

    def test_actual_redundancy_detected(self):
        """Test that actual redundant patterns are still detected."""
        rule = "+@read +get +mget ~*"  # get and mget are already in @read

        response = self.client.post('/api/analyze-redundancy',
                                   data=json.dumps({'rule': rule, 'version': 'redis7'}),
                                   content_type='application/json')

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)

        # Should flag this as redundant
        self.assertTrue(result.get('has_redundancy', False))

    def test_implicit_category_redundancy_detection(self):
        """Test redundancy detection for implicit fully-granted categories."""
        # All string commands + explicit @string
        string_commands = list(self.redis_data['redis7']['categories']['string'])
        rule_terms = ["+@string"] + [f"+{cmd}" for cmd in string_commands] + ["~*"]
        rule = " ".join(rule_terms)

        response = self.client.post('/api/analyze-redundancy',
                                   data=json.dumps({'rule': rule, 'version': 'redis7'}),
                                   content_type='application/json')

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)

        # Should detect redundancy
        self.assertTrue(result.get('has_redundancy', False))


class TestComplexACLScenarios(TestAdvancedFeatures):
    """Test complex real-world ACL rule scenarios."""

    def test_redis8_module_commands_with_categories(self):
        """Test Redis 8 module commands mixed with traditional categories."""
        rule = "+@read +@write -@dangerous +ft.search +ft.create +json.get +json.set ~*"

        result = self.parser_redis8.parse(rule)

        # Should properly handle module commands
        self.assertIn('read', result['granted_categories'])
        self.assertIn('write', result['granted_categories'])
        self.assertIn('dangerous', result['blocked_categories'])

        # Module commands should be in granted_commands
        granted_commands = result['granted_commands']
        self.assertIn('ft.search', granted_commands)
        self.assertIn('ft.create', granted_commands)
        self.assertIn('json.get', granted_commands)
        self.assertIn('json.set', granted_commands)

    def test_complex_precedence_chain(self):
        """Test complex precedence with multiple overrides."""
        rule = "+@all -@dangerous +@admin -flushall -flushdb +get -get +set ~*"

        result = self.parser_redis7.parse(rule)

        # Final state should respect left-to-right precedence
        self.assertIn('all', result['granted_categories'])
        self.assertIn('dangerous', result['blocked_categories'])
        self.assertIn('admin', result['granted_categories'])

        # Individual command overrides
        self.assertIn('flushall', result['blocked_commands'])
        self.assertIn('flushdb', result['blocked_commands'])
        self.assertIn('get', result['blocked_commands'])  # Final -get overrides +get
        self.assertIn('set', result['granted_commands'])

    def test_overlapping_categories_with_individual_commands(self):
        """Test categories with overlapping commands and individual grants."""
        rule = "+@read +@fast -@slow +get +set -mget ~*"

        result = self.parser_redis7.parse(rule)

        # Should handle overlapping categories correctly
        self.assertIn('read', result['granted_categories'])
        self.assertIn('fast', result['granted_categories'])
        self.assertIn('slow', result['blocked_categories'])

        # Individual command precedence
        self.assertIn('get', result['granted_commands'])
        self.assertIn('set', result['granted_commands'])
        self.assertIn('mget', result['blocked_commands'])

    def test_large_rule_with_many_terms(self):
        """Test parsing very large ACL rules with 20+ terms."""
        # Create a rule with many individual commands and categories
        commands = ['get', 'set', 'del', 'exists', 'keys', 'scan', 'type', 'ttl',
                   'expire', 'persist', 'rename', 'move', 'copy', 'unlink', 'touch']
        categories = ['@read', '@write', '@admin', '@fast', '@slow']
        keyspaces = ['~user:*', '~session:*', '~cache:*', '~temp:*']

        rule_terms = [f"+{cmd}" for cmd in commands] + categories + keyspaces + ['-@dangerous', '-flushall']
        rule = " ".join(rule_terms)

        result = self.parser_redis7.parse(rule)

        # Should parse successfully without errors
        self.assertIsNotNone(result)
        self.assertIn('granted_commands', result)
        self.assertIn('granted_categories', result)
        self.assertIn('key_patterns', result)

        # Should have correct counts
        self.assertGreater(len(result['granted_commands']), 10)
        self.assertGreater(len(result['granted_categories']), 3)

    def test_edge_case_empty_and_wildcard_patterns(self):
        """Test edge cases with empty rules and wildcard patterns."""
        test_rules = [
            "",  # Empty rule
            "~*",  # Only keyspace
            "+@all",  # Only command, no keyspace
            "+get ~* ~cache:* ~user:*",  # Multiple keyspaces
            "+@read +@write +@admin +@fast +@slow -@dangerous ~*",  # Many categories
        ]

        for rule in test_rules:
            with self.subTest(rule=rule):
                result = self.parser_redis7.parse(rule)

                # Should always return a valid result structure
                self.assertIsInstance(result, dict)
                self.assertIn('granted_commands', result)
                self.assertIn('blocked_commands', result)


class TestUIFeatures(TestAdvancedFeatures):
    """Test UI-specific features."""

    def test_search_toggle_buttons_present(self):
        """Test that search link toggle buttons are present in the UI."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Check for search link toggle buttons
        self.assertIn('search-link-toggle', html_content)
        self.assertIn('data-search-type="blocked"', html_content)
        self.assertIn('data-search-type="granted"', html_content)
        self.assertIn('⛓️‍💥', html_content)  # Unlinked emoji

    def test_search_mode_toggle_buttons_present(self):
        """Test that fuzzy/exact search mode toggles are present."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Check for search mode toggle buttons
        self.assertIn('search-mode-toggle', html_content)
        self.assertIn('≈', html_content)  # Fuzzy mode emoji

    def test_version_toggle_functionality(self):
        """Test Redis version toggle between 7 and 8."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Check version toggle is present
        self.assertIn('versionToggle', html_content)
        self.assertIn('Redis 7', html_content)

        # Test parsing with both versions via API
        rule = "+@all ~*"

        for version in ['redis7', 'redis8']:
            response = self.client.post('/api/parse',
                                       data=json.dumps({'rule': rule, 'version': version}),
                                       content_type='application/json')

            self.assertEqual(response.status_code, 200)
            result = json.loads(response.data)
            self.assertEqual(result['version'], version)


if __name__ == '__main__':
    # Set up test suite
    suite = unittest.TestSuite()

    # Add all test classes
    test_classes = [
        TestImplicitCategoryDetection,
        TestAutoSimplification,
        TestEnhancedRedundancy,
        TestComplexACLScenarios,
        TestUIFeatures
    ]

    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        suite.addTests(tests)

    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2, buffer=True)
    result = runner.run(suite)

    # Print summary
    print(f"\n{'='*80}")
    print(f"🔐 Redis ACL Builder - Advanced Features Test Suite")
    print(f"{'='*80}")
    print(f"✅ Tests run: {result.testsRun}")
    print(f"✅ Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    if result.failures:
        print(f"❌ Failures: {len(result.failures)}")
    if result.errors:
        print(f"💥 Errors: {len(result.errors)}")

    success_rate = ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100) if result.testsRun > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    print(f"{'='*80}")

    if result.failures or result.errors:
        print("❌ Some tests failed. Please check the output above.")
        sys.exit(1)
    else:
        print("🎉 All advanced feature tests passed!")
        sys.exit(0)