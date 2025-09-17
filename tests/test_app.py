#!/usr/bin/env python3
"""
Redis ACL Builder - Test Suite
Comprehensive tests for all application functionality
"""

import unittest
import json
import sys
import os

# Add the parent directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import application modules from the organized structure
from app import app
from helpers.data_loader import get_redis_data, build_command_indexes
from helpers.acl_parser import ACLParser


class TestDataLoader(unittest.TestCase):
    """Test the Redis data loading functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.redis_data = get_redis_data()
        self.redis_data = build_command_indexes(self.redis_data)
    
    def test_data_structure(self):
        """Test that Redis data has correct structure."""
        self.assertIn('redis7', self.redis_data)
        self.assertIn('redis8', self.redis_data)
        
        for version in ['redis7', 'redis8']:
            self.assertIn('categories', self.redis_data[version])
            self.assertIn('commands', self.redis_data[version])
    
    def test_redis7_categories(self):
        """Test Redis 7 has expected categories."""
        expected_categories = {
            'keyspace', 'read', 'write', 'set', 'sortedset', 'list', 'hash',
            'string', 'bitmap', 'hyperloglog', 'geo', 'stream', 'pubsub',
            'admin', 'fast', 'slow', 'blocking', 'dangerous', 'connection',
            'transaction', 'scripting'
        }
        
        actual_categories = set(self.redis_data['redis7']['categories'].keys())
        self.assertEqual(actual_categories, expected_categories)
    
    def test_redis8_additional_categories(self):
        """Test Redis 8 has additional module categories."""
        redis8_categories = set(self.redis_data['redis8']['categories'].keys())
        redis7_categories = set(self.redis_data['redis7']['categories'].keys())
        
        # Redis 8 should have all Redis 7 categories plus new ones
        self.assertTrue(redis7_categories.issubset(redis8_categories))
        
        # Check for expected new categories in Redis 8
        new_categories = {'json', 'timeseries', 'search', 'bloom', 'cuckoo', 'cms', 'topk', 'tdigest'}
        self.assertTrue(new_categories.issubset(redis8_categories))
    
    def test_command_indexing(self):
        """Test that command indexing works correctly."""
        # Test that common commands exist in both versions
        for version in ['redis7', 'redis8']:
            commands = self.redis_data[version]['commands']
            
            # Test basic commands exist
            self.assertIn('get', commands)
            self.assertIn('set', commands)
            self.assertIn('hget', commands)
            
            # Test that GET is in expected categories
            get_categories = commands['get']
            self.assertIn('read', get_categories)
            self.assertIn('string', get_categories)
            self.assertIn('fast', get_categories)
    
    def test_data_consistency(self):
        """Test data consistency between categories and command index."""
        for version in ['redis7', 'redis8']:
            categories = self.redis_data[version]['categories']
            commands = self.redis_data[version]['commands']
            
            # Every command in categories should be in command index
            for category, cmd_list in categories.items():
                for cmd in cmd_list:
                    self.assertIn(cmd, commands, f"Command {cmd} from category {category} not in command index")
                    self.assertIn(category, commands[cmd], f"Category {category} not listed for command {cmd}")


class TestACLParser(unittest.TestCase):
    """Test the ACL parsing functionality."""
    
    def setUp(self):
        """Set up test parser."""
        redis_data = get_redis_data()
        redis_data = build_command_indexes(redis_data)
        self.parser7 = ACLParser(redis_data, 'redis7')
        self.parser8 = ACLParser(redis_data, 'redis8')
    
    def test_empty_rule(self):
        """Test parsing empty rule (should block all per Redis ACL specification)."""
        parsed = self.parser7.parse_acl_rule("")
        self.assertEqual(len(parsed['command_rules']), 0)
        self.assertEqual(len(parsed['key_rules']), 0)
        
        granted, explanations = self.parser7.evaluate_command_permissions(parsed)
        # Empty rules should block all commands (Redis default "deny by default" behavior)
        self.assertEqual(len(granted), 0)  # No commands granted with empty rule
    
    def test_basic_category_rules(self):
        """Test basic category allow/deny rules."""
        # Test +@read
        parsed = self.parser7.parse_acl_rule("+@read")
        granted, explanations = self.parser7.evaluate_command_permissions(parsed)
        
        self.assertIn('get', granted)
        self.assertIn('hget', granted)
        self.assertNotIn('set', granted)  # SET is write, not read
        
        # Test explanation
        self.assertIn('get', explanations)
        self.assertIn('+@read', explanations['get'])
    
    def test_command_precedence(self):
        """Test left-to-right rule precedence."""
        # Grant read, then deny GET specifically
        parsed = self.parser7.parse_acl_rule("+@read -get")
        granted, explanations = self.parser7.evaluate_command_permissions(parsed)
        
        self.assertNotIn('get', granted)  # Should be denied
        self.assertIn('mget', granted)    # Should still be granted
        
        # Check explanation shows override
        self.assertIn('get', explanations)
        self.assertIn('-get', explanations['get'])
        self.assertIn('overrides', explanations['get'])
    
    def test_individual_commands(self):
        """Test individual command grants."""
        parsed = self.parser7.parse_acl_rule("+get +set +hget")
        granted, explanations = self.parser7.evaluate_command_permissions(parsed)
        
        self.assertIn('get', granted)
        self.assertIn('set', granted)
        self.assertIn('hget', granted)
        self.assertNotIn('del', granted)  # Not explicitly granted
        
        # Should have only 3 commands
        self.assertEqual(len(granted), 3)
    
    def test_all_category(self):
        """Test @all special category."""
        parsed = self.parser7.parse_acl_rule("+@all -@dangerous")
        granted, explanations = self.parser7.evaluate_command_permissions(parsed)
        
        # Should have most commands
        self.assertGreater(len(granted), 248)  # Expect ~80% of commands
        
        # But not dangerous ones
        self.assertNotIn('flushdb', granted)
        self.assertNotIn('flushall', granted)
        self.assertIn('get', granted)  # Safe command should be there
    
    def test_key_patterns(self):
        """Test key pattern parsing."""
        parsed = self.parser7.parse_acl_rule("+@read ~user:* ~session:*")
        
        self.assertEqual(len(parsed['key_rules']), 2)
        patterns = [rule['pattern'] for rule in parsed['key_rules']]
        self.assertIn('user:*', patterns)
        self.assertIn('session:*', patterns)
    
    def test_command_testing(self):
        """Test individual command testing."""
        parsed = self.parser7.parse_acl_rule("+@read")
        
        # Test allowed command
        is_granted, explanation, categories = self.parser7.test_command_access('GET', parsed)
        self.assertTrue(is_granted)
        self.assertIn('read', categories)
        
        # Test denied command
        is_granted, explanation, categories = self.parser7.test_command_access('SET', parsed)
        self.assertFalse(is_granted)
        
        # Test non-existent command
        is_granted, explanation, categories = self.parser7.test_command_access('NONEXISTENT', parsed)
        self.assertFalse(is_granted)
        self.assertIn('not found', explanation)
    
    def test_rule_validation(self):
        """Test rule validation functionality."""
        # Valid rule
        is_valid, errors = self.parser7.validate_rule_syntax("+@read +get")
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
        
        # Invalid category
        is_valid, errors = self.parser7.validate_rule_syntax("+@nonexistent")
        self.assertFalse(is_valid)
        self.assertGreater(len(errors), 0)
        self.assertIn('nonexistent', ' '.join(errors))
    
    def test_search_commands(self):
        """Test command search functionality."""
        # Test wildcard search
        results = self.parser7.search_commands('h*')
        self.assertIn('hget', results)
        self.assertIn('hset', results)
        self.assertNotIn('get', results)
        
        # Test substring search
        results = self.parser7.search_commands('get')
        self.assertIn('get', results)
        self.assertIn('hget', results)
        self.assertIn('mget', results)
    
    def test_category_info(self):
        """Test category information retrieval."""
        info = self.parser7.get_category_info()
        
        self.assertIn('read', info)
        self.assertIn('write', info)
        self.assertIsInstance(info['read'], int)
        self.assertGreater(info['read'], 50)  # read category should have 50+ commands
    
    def test_impact_summary(self):
        """Test rule impact summary."""
        parsed = self.parser7.parse_acl_rule("+@read")
        summary = self.parser7.get_rule_impact_summary(parsed)
        
        self.assertIn('total_granted', summary)
        self.assertIn('total_commands', summary)
        self.assertIn('category_impact', summary)
        self.assertIn('read', summary['category_impact'])
        
        # Read category should be 100% granted
        read_impact = summary['category_impact']['read']
        self.assertEqual(read_impact['percentage'], 100.0)

    def test_redis8_search_category(self):
        """Test that Redis 8 search commands are properly handled."""
        parsed = self.parser8.parse_acl_rule("+@search")
        granted, explanations = self.parser8.evaluate_command_permissions(parsed)
        
        # Check that search commands are granted
        search_commands = [cmd for cmd in granted if cmd.startswith('ft.')]
        self.assertGreater(len(search_commands), 0, "Should grant FT.* commands")
    
        # Check specific command
        self.assertIn('ft.search', granted)  # Note: might need to check exact case


class TestFlaskApp(unittest.TestCase):
    """Test the Flask application endpoints."""
    
    def setUp(self):
        """Set up test client."""
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.ctx = app.app_context()
        self.ctx.push()
    
    def tearDown(self):
        """Clean up test context."""
        self.ctx.pop()
    
    def test_home_page(self):
        """Test home page loads."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Redis Enterprise ACL Builder', response.data)
    
    def test_health_endpoint(self):
        """Test health check endpoint."""
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertIn('redis_versions', data)
        self.assertIn('total_commands', data)
    
    def test_parse_api(self):
        """Test ACL rule parsing API."""
        # Test valid rule
        response = self.client.post('/api/parse', 
            json={'rule': '+@read', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('granted_commands', data)
        self.assertGreater(data['total_granted'], 50)
        
        # Test empty rule - should block all commands per Redis ACL specification
        response = self.client.post('/api/parse', 
            json={'rule': '', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['total_granted'], 0)  # Empty rule blocks all commands
    
    def test_test_command_api(self):
        """Test command testing API."""
        # Test allowed command
        response = self.client.post('/api/test-command', 
            json={'rule': '+@read', 'command': 'GET', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['is_granted'])
        self.assertIn('read', data['categories'])
        
        # Test denied command
        response = self.client.post('/api/test-command', 
            json={'rule': '+@read', 'command': 'SET', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertFalse(data['is_granted'])
    
    def test_validate_rule_api(self):
        """Test rule validation API."""
        # Test valid rule
        response = self.client.post('/api/validate-rule', 
            json={'rule': '+@read +get', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['is_valid'])
        self.assertEqual(len(data['errors']), 0)
        
        # Test invalid rule
        response = self.client.post('/api/validate-rule', 
            json={'rule': '+@nonexistent', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertFalse(data['is_valid'])
        self.assertGreater(len(data['errors']), 0)
    
    def test_command_info_api(self):
        """Test command info API."""
        response = self.client.post('/api/command-info', 
            json={'command': 'GET', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['exists'])
        self.assertIn('read', data['categories'])
        self.assertIn('string', data['categories'])
    
    def test_search_commands_api(self):
        """Test command search API."""
        response = self.client.post('/api/search-commands', 
            json={'pattern': 'h*', 'version': 'redis7', 'limit': 10})
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertGreater(len(data['results']), 0)
        self.assertLessEqual(len(data['results']), 10)
        
        # Check result format
        result = data['results'][0]
        self.assertIn('command', result)
        self.assertIn('categories', result)
    
    def test_categories_api(self):
        """Test categories API."""
        response = self.client.get('/api/categories?version=redis7')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('categories', data)
        self.assertIn('category_info', data)
        self.assertIn('read', data['categories'])
        self.assertIn('write', data['categories'])
    
    def test_error_handling(self):
        """Test API error handling."""
        # Test missing data
        response = self.client.post('/api/parse')
        self.assertEqual(response.status_code, 400)
        
        # Test invalid version
        response = self.client.post('/api/parse', 
            json={'rule': '+@read', 'version': 'invalid'})
        self.assertEqual(response.status_code, 400)
        
        # Test 404
        response = self.client.get('/nonexistent')
        self.assertEqual(response.status_code, 404)
    
    def test_redis_version_differences(self):
        """Test differences between Redis versions."""
        # Test Redis 7
        response7 = self.client.get('/api/categories', 
            query_string={'version': 'redis7'})
        data7 = json.loads(response7.data)
        
        # Test Redis 8
        response8 = self.client.get('/api/categories', 
            query_string={'version': 'redis8'})
        data8 = json.loads(response8.data)
        
        # Redis 8 should have more categories
        self.assertGreater(data8['total_categories'], data7['total_categories'])
        
        # Redis 8 should have JSON category
        self.assertIn('json', data8['categories'])
        self.assertNotIn('json', data7['categories'])
    
    def test_analyze_redundancy_api(self):
        """Test ACL rule redundancy analysis API."""
        # Test redundant rule
        response = self.client.post('/api/analyze-redundancy', 
            json={'rule': '+@all -@all', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('analysis', data)
        
        # Test with invalid version
        response = self.client.post('/api/analyze-redundancy', 
            json={'rule': '+@all', 'version': 'invalid'})
        self.assertEqual(response.status_code, 400)
        
        # Test with missing JSON data
        response = self.client.post('/api/analyze-redundancy')
        self.assertEqual(response.status_code, 400)
    
    def test_refactored_error_handling(self):
        """Test the refactored shared validation functions."""
        # Test all endpoints with invalid JSON
        endpoints = ['/api/parse', '/api/test-command', '/api/command-info', 
                    '/api/search-commands', '/api/validate-rule', '/api/analyze-redundancy']
        
        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(endpoint, data='invalid json', 
                                          content_type='application/json')
                self.assertEqual(response.status_code, 400)
                data = json.loads(response.data)
                self.assertTrue(data['error'])
                self.assertIn('Invalid or missing JSON data', data['message'])
    
    def test_configuration_constants(self):
        """Test that configuration constants are properly used."""
        # Test health endpoint reflects proper configuration
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertIn('redis_versions', data)
        self.assertIn('total_commands', data)
    
    def test_search_limit_configuration(self):
        """Test that search limit uses configuration constant."""
        # Test search with large pattern should respect limit
        response = self.client.post('/api/search-commands', 
            json={'pattern': '*', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Should have limited results (default 50 or configured limit)
        self.assertLessEqual(len(data['results']), 50)
        self.assertIn('showing', data)
        self.assertIn('total_matches', data)


class TestUserInterface(unittest.TestCase):
    """Test user interface structure and functionality."""
    
    def setUp(self):
        """Set up test client."""
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.ctx = app.app_context()
        self.ctx.push()
    
    def tearDown(self):
        """Clean up test context."""
        self.ctx.pop()
    
    def test_copy_clear_buttons_presence_and_positioning(self):
        """Test that Copy and Clear buttons are present and correctly positioned."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')

        # Check for Copy and Clear button IDs and emojis
        self.assertIn('id="copyRuleBtn"', html_content)
        self.assertIn('id="clearRuleBtn"', html_content)
        self.assertIn('📋', html_content)  # Copy emoji
        self.assertIn('💣', html_content)  # Clear emoji

        # Check buttons are in correct position (in version-info section, before textarea)
        copy_pos = html_content.find('id="copyRuleBtn"')
        examples_pos = html_content.find('Quick Examples')
        textarea_pos = html_content.find('id="aclRule"')
        version_info_pos = html_content.find('class="version-info"')

        # Verify buttons are positioned correctly relative to other elements
        self.assertTrue(version_info_pos < copy_pos < textarea_pos,
                       "Copy button should be in version-info section before textarea")
        self.assertTrue(textarea_pos < examples_pos,
                       "Textarea should be before Quick Examples")
    
    def test_version_toggle_design_consistency(self):
        """Test that version toggle uses final design without A/B testing artifacts."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html_content = response.data.decode('utf-8')
        
        # Should not contain A/B testing elements
        self.assertNotIn('Test Inverted Version Colors', html_content)
        self.assertNotIn('styleToggle', html_content)
        self.assertNotIn('inverted-toggle', html_content)


class TestIntegration(unittest.TestCase):
    """Integration tests for complete workflows."""
    
    def setUp(self):
        """Set up integration test environment."""
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.ctx = app.app_context()
        self.ctx.push()
    
    def tearDown(self):
        """Clean up integration test context."""
        self.ctx.pop()
    
    def test_complete_workflow(self):
        """Test complete ACL building workflow."""
        # 1. Parse a rule
        parse_response = self.client.post('/api/parse', 
            json={'rule': '+@read +@write -@dangerous', 'version': 'redis7'})
        self.assertEqual(parse_response.status_code, 200)
        parse_data = json.loads(parse_response.data)
        
        # 2. Test specific commands
        test_commands = ['GET', 'SET', 'HGET', 'FLUSHDB']
        for cmd in test_commands:
            test_response = self.client.post('/api/test-command',
                json={'rule': '+@read +@write -@dangerous', 'command': cmd, 'version': 'redis7'})
            self.assertEqual(test_response.status_code, 200)
            test_data = json.loads(test_response.data)
            
            if cmd == 'FLUSHDB':
                self.assertFalse(test_data['is_granted'])  # Should be denied (dangerous)
            else:
                self.assertTrue(test_data['is_granted'])   # Should be granted
        
        # 3. Validate the rule
        validate_response = self.client.post('/api/validate-rule',
            json={'rule': '+@read +@write -@dangerous', 'version': 'redis7'})
        self.assertEqual(validate_response.status_code, 200)
        validate_data = json.loads(validate_response.data)
        self.assertTrue(validate_data['is_valid'])
    
    def test_complex_rule_scenarios(self):
        """Test complex real-world ACL scenarios."""
        scenarios = [
            {
                'rule': '+@all -@dangerous -@admin',
                'should_allow': ['GET', 'SET', 'HGET', 'ZADD'],
                'should_deny': ['sort', 'flushall', 'monitor']
            },
            {
                'rule': '+@read +@write -FLUSHDB -FLUSHALL',
                'should_allow': ['GET', 'SET', 'DEL'],
                'should_deny': ['FLUSHDB', 'FLUSHALL']
            },
            {
                'rule': '+@string +@hash +@list',
                'should_allow': ['GET', 'SET', 'HGET', 'LPUSH'],
                'should_deny': ['ZADD', 'SADD']  # sorted set and set operations
            }
        ]
        
        for scenario in scenarios:
            rule = scenario['rule']
            
            # Test allowed commands
            for cmd in scenario['should_allow']:
                response = self.client.post('/api/test-command',
                    json={'rule': rule, 'command': cmd, 'version': 'redis7'})
                data = json.loads(response.data)
                self.assertTrue(data['is_granted'], 
                    f"Command {cmd} should be allowed by rule: {rule}")
            
            # Test denied commands
            for cmd in scenario['should_deny']:
                response = self.client.post('/api/test-command',
                    json={'rule': rule, 'command': cmd, 'version': 'redis7'})
                data = json.loads(response.data)
                self.assertFalse(data['is_granted'], 
                    f"Command {cmd} should be denied by rule: {rule}")


def run_tests():
    """Run all tests and provide summary."""
    print("=" * 80)
    print("🔐 Redis ACL Builder - Test Suite")
    print("=" * 80)
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestDataLoader,
        TestACLParser, 
        TestFlaskApp,
        TestUserInterface,
        TestIntegration
    ]
    
    for test_class in test_classes:
        tests = loader.loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(
        verbosity=2,
        stream=sys.stdout,
        descriptions=True,
        failfast=False
    )
    
    print(f"\n🧪 Running {suite.countTestCases()} tests...\n")
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 80)
    print("📊 Test Summary")
    print("=" * 80)
    print(f"✅ Tests run: {result.testsRun}")
    print(f"✅ Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    
    if result.failures:
        print(f"❌ Failures: {len(result.failures)}")
    
    if result.errors:
        print(f"🔥 Errors: {len(result.errors)}")
    
    if result.skipped:
        print(f"⏭️  Skipped: {len(result.skipped)}")
    
    success_rate = ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun) * 100
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    print("=" * 80)
    
    if result.wasSuccessful():
        print("🎉 All tests passed! Redis ACL Builder is working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Please check the output above.")
        return 1


if __name__ == '__main__':
    sys.exit(run_tests())