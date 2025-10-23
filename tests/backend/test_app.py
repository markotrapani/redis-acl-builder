#!/usr/bin/env python3
"""
Redis ACL Builder - Comprehensive Test Suite
ALL tests from v1.25.0-beta restored and updated for:
- Monorepo structure (backend/ imports)
- Redis OSS command sets (379 for Redis 7, 446 for Redis 8)
- Current ACL parser API (parse + evaluate pattern)
- Current Flask API (Pydantic models)
"""

import unittest
import json
import sys
import os

# Add the backend directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'backend'))

# Import application modules from the monorepo structure
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

    def test_redis7_command_count(self):
        """Test Redis 7 OSS has correct number of commands (379 total)."""
        redis7_commands = set()
        for category, cmds in self.redis_data['redis7']['categories'].items():
            for cmd in cmds:
                redis7_commands.add(cmd.lower())

        # Redis 7 OSS has 379 unique commands
        self.assertEqual(len(redis7_commands), 379,
                        f"Expected 379 Redis 7 OSS commands, got {len(redis7_commands)}")

    def test_redis8_additional_categories(self):
        """Test Redis 8 has additional module categories."""
        redis8_categories = set(self.redis_data['redis8']['categories'].keys())
        redis7_categories = set(self.redis_data['redis7']['categories'].keys())

        # Redis 8 should have all Redis 7 categories plus new ones
        self.assertTrue(redis7_categories.issubset(redis8_categories))

        # Check for expected new categories in Redis 8
        new_categories = {'json', 'timeseries', 'search', 'bloom', 'cuckoo', 'cms', 'topk', 'tdigest'}
        self.assertTrue(new_categories.issubset(redis8_categories))

    def test_redis8_command_count(self):
        """Test Redis 8 OSS has correct number of commands (446 total)."""
        redis8_commands = set()
        for category, cmds in self.redis_data['redis8']['categories'].items():
            for cmd in cmds:
                redis8_commands.add(cmd.lower())

        # Redis 8 OSS has 446 unique commands
        self.assertEqual(len(redis8_commands), 446,
                        f"Expected 446 Redis 8 OSS commands, got {len(redis8_commands)}")

    def test_redis7_oss_cluster_commands(self):
        """Test Redis 7 OSS includes cluster commands (not in Enterprise)."""
        admin_category = self.redis_data['redis7']['categories']['admin']

        # Check for cluster commands that Enterprise blocks
        cluster_commands = [cmd for cmd in admin_category if cmd.startswith('cluster|')]
        self.assertEqual(len(cluster_commands), 17,
                        "Redis 7 OSS should have 17 cluster commands")

        # Verify specific critical cluster commands exist
        self.assertIn('cluster|addslots', admin_category)
        self.assertIn('cluster|meet', admin_category)
        self.assertIn('cluster|failover', admin_category)

    def test_redis7_oss_replication_commands(self):
        """Test Redis 7 OSS includes replication commands (not in Enterprise)."""
        admin_category = self.redis_data['redis7']['categories']['admin']

        # Check for replication commands that Enterprise blocks
        replication_commands = ['replicaof', 'slaveof', 'psync', 'sync']
        for cmd in replication_commands:
            self.assertIn(cmd, admin_category,
                         f"Redis 7 OSS should include {cmd} command")

    def test_redis7_oss_latency_commands(self):
        """Test Redis 7 OSS includes latency monitoring commands."""
        admin_category = self.redis_data['redis7']['categories']['admin']

        # Check for latency monitoring commands
        latency_commands = [cmd for cmd in admin_category if cmd.startswith('latency|')]
        self.assertGreater(len(latency_commands), 5,
                          "Redis 7 OSS should have latency monitoring commands")

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

    def test_empty_acl(self):
        """Test parsing empty rule (should block all per Redis ACL specification)."""
        parsed = self.parser7.parse_acl_rule("")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Empty ACL should block all commands
        self.assertEqual(len(granted), 0)

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

        # Should grant most commands, but not dangerous ones
        # Redis 7 has 379 commands total, minus ~75 dangerous commands = ~304
        self.assertGreater(len(granted), 300)
        self.assertLess(len(granted), 379)

        # But not dangerous ones
        self.assertNotIn('flushdb', granted)
        self.assertNotIn('flushall', granted)
        self.assertIn('get', granted)  # Safe command should be there

    def test_category_grant(self):
        """Test granting a specific category."""
        parsed = self.parser7.parse_acl_rule("+@read")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Should grant read commands
        self.assertGreater(len(granted), 80)  # Redis 7 has 91 read commands
        self.assertIn('get', granted)
        self.assertIn('hget', granted)

    def test_all_category_redis7(self):
        """Test @all category grants all Redis 7 commands."""
        parsed = self.parser7.parse_acl_rule("+@all")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Should grant all 379 Redis 7 OSS commands
        self.assertEqual(len(granted), 379)

    def test_mixed_rules(self):
        """Test complex ACL with mixed grant/deny rules."""
        parsed = self.parser7.parse_acl_rule("+@read +@write -del -flushdb")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Read/write commands should be granted except del and flushdb
        self.assertIn('get', granted)
        self.assertIn('set', granted)
        self.assertNotIn('del', granted)
        self.assertNotIn('flushdb', granted)

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
        is_granted, explanation, categories, selector_index = self.parser7.test_command_access('GET', parsed)
        self.assertTrue(is_granted)
        self.assertIn('read', categories)

        # Test denied command
        is_granted, explanation, categories, selector_index = self.parser7.test_command_access('SET', parsed)
        self.assertFalse(is_granted)

        # Test non-existent command
        is_granted, explanation, categories, selector_index = self.parser7.test_command_access('NONEXISTENT', parsed)
        self.assertFalse(is_granted)
        self.assertIn('not found', explanation.lower())

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
        self.assertTrue(any('nonexistent' in err.lower() for err in errors))

    def test_search_commands(self):
        """Test command search functionality."""
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
        self.assertIn('ft.search', granted)

    # ====== Selector Tests (Redis 7.0+) ======

    def test_selector_basic_parsing(self):
        """Test basic selector parsing."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")

        # Check root permissions
        self.assertGreater(len(parsed['command_rules']), 0)
        self.assertEqual(len(parsed['key_rules']), 1)
        self.assertEqual(parsed['key_rules'][0]['pattern'], 'user:*')

        # Check selectors
        self.assertEqual(len(parsed['selectors']), 1)
        selector = parsed['selectors'][0]
        self.assertGreater(len(selector['command_rules']), 0)
        self.assertEqual(len(selector['key_rules']), 1)
        self.assertEqual(selector['key_rules'][0]['pattern'], 'logs:*')

    def test_selector_command_access_root(self):
        """Test command granted by root permissions."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")
        is_granted, explanation, categories, selector_index = self.parser8.test_command_access('GET', parsed)

        self.assertTrue(is_granted)
        self.assertIsNone(selector_index)  # Granted by root, not selector
        self.assertIn('@read', explanation)

    def test_selector_command_access_selector(self):
        """Test command granted by selector."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")
        is_granted, explanation, categories, selector_index = self.parser8.test_command_access('SET', parsed)

        self.assertTrue(is_granted)
        self.assertEqual(selector_index, 0)  # Granted by first selector
        self.assertIn('Selector #1', explanation)
        self.assertIn('@write', explanation)

    def test_selector_key_isolation_root(self):
        """Test key access isolation - root command with root key."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")

        # GET (root) on user:123 (root key) - should succeed
        is_allowed, reason, pattern, perm_type = self.parser8.test_key_access('user:123', 'GET', parsed, None)

        self.assertTrue(is_allowed)
        self.assertEqual(pattern, 'user:*')
        self.assertEqual(perm_type, 'read-write')

    def test_selector_key_isolation_selector(self):
        """Test key access isolation - selector command with selector key."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")

        # SET (selector) on logs:error (selector key) - should succeed
        is_allowed, reason, pattern, perm_type = self.parser8.test_key_access('logs:error', 'SET', parsed, 0)

        self.assertTrue(is_allowed)
        self.assertEqual(pattern, 'logs:*')
        self.assertIn('Selector #1', reason)

    def test_selector_key_isolation_mismatch_root_cmd_selector_key(self):
        """Test key access isolation - root command with selector key (should fail)."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")

        # GET (root) on logs:error (selector key) - should fail
        is_allowed, reason, pattern, perm_type = self.parser8.test_key_access('logs:error', 'GET', parsed, None)

        self.assertFalse(is_allowed)
        self.assertIsNone(pattern)
        self.assertIn('root', reason.lower())

    def test_selector_key_isolation_mismatch_selector_cmd_root_key(self):
        """Test key access isolation - selector command with root key (should fail)."""
        parsed = self.parser8.parse_acl_rule("+@read ~user:* (+@write ~logs:*)")

        # SET (selector) on user:123 (root key) - should fail
        is_allowed, reason, pattern, perm_type = self.parser8.test_key_access('user:123', 'SET', parsed, 0)

        self.assertFalse(is_allowed)
        self.assertIsNone(pattern)
        self.assertIn('Selector #1', reason)

    def test_selector_multiple_selectors(self):
        """Test multiple selectors."""
        parsed = self.parser8.parse_acl_rule("+@read (~@write ~logs:*) (+@dangerous ~config:*)")

        self.assertEqual(len(parsed['selectors']), 2)

        # Test command from second selector - FLUSHDB is in @dangerous
        is_granted, explanation, categories, selector_index = self.parser8.test_command_access('FLUSHDB', parsed)
        self.assertTrue(is_granted)
        self.assertEqual(selector_index, 1)  # Second selector (index 1)
        self.assertIn('Selector #2', explanation)

    def test_selector_validation_balanced_parens(self):
        """Test selector validation - balanced parentheses."""
        is_valid, errors = self.parser8.validate_rule_syntax("+@read (~@write")

        self.assertFalse(is_valid)
        self.assertTrue(any('Unmatched' in err or 'parenthesis' in err.lower() for err in errors))

    def test_selector_validation_nested(self):
        """Test selector validation - nested selectors not allowed."""
        is_valid, errors = self.parser8.validate_rule_syntax("+@read ((+@write))")

        self.assertFalse(is_valid)
        self.assertTrue(any('Nested' in err or 'nested' in err.lower() for err in errors))

    def test_selector_validation_empty(self):
        """Test selector validation - empty selector."""
        is_valid, errors = self.parser8.validate_rule_syntax("+@read ()")

        self.assertFalse(is_valid)
        self.assertTrue(any('Empty' in err or 'empty' in err.lower() for err in errors))

    def test_selector_validation_invalid_category(self):
        """Test selector validation - invalid category in selector."""
        is_valid, errors = self.parser8.validate_rule_syntax("+@read (+@invalidcategory)")

        self.assertFalse(is_valid)
        self.assertTrue(any('Selector #1' in err and 'Unknown category' in err for err in errors))

    def test_selector_with_advanced_key_permissions(self):
        """Test selectors with advanced key permissions (%R~, %W~, %RW~)."""
        parsed = self.parser8.parse_acl_rule("+@all ~app:* (+@read %R~analytics:*)")

        # Check selector has read-only key pattern
        selector = parsed['selectors'][0]
        self.assertEqual(len(selector['key_rules']), 1)
        self.assertEqual(selector['key_rules'][0]['permission'], 'read-only')
        self.assertEqual(selector['key_rules'][0]['pattern'], 'analytics:*')

    def test_selector_with_deny_category(self):
        """Test selector with category deny rules."""
        # Selector with category grant and deny
        parsed = self.parser8.parse_acl_rule("+@all (+@write -@dangerous)")

        # Selector should have both allow and deny rules
        selector = parsed['selectors'][0]
        self.assertGreater(len(selector['command_rules']), 0)

        # Should have both allow (@write) and deny (-@dangerous) rules
        rule_types = [rule['type'] for rule in selector['command_rules']]
        self.assertIn('allow', rule_types)
        self.assertIn('deny', rule_types)

    def test_selector_with_deny_command(self):
        """Test selector with individual command deny rules."""
        # Selector granting @write but denying specific dangerous command
        parsed = self.parser8.parse_acl_rule("+@read (+@write -del -flushdb)")

        selector = parsed['selectors'][0]

        # Should have deny rules for specific commands
        deny_commands = [rule for rule in selector['command_rules']
                        if rule['type'] == 'deny' and rule['target'] == 'command']
        self.assertGreater(len(deny_commands), 0)

        # Should have deny for del and flushdb
        denied_values = [rule['value'] for rule in deny_commands]
        self.assertIn('del', denied_values)
        self.assertIn('flushdb', denied_values)

    def test_pubsub_channel_patterns(self):
        """Test parsing of pub/sub channel patterns (&channel:*)."""
        parsed = self.parser8.parse_acl_rule("+@pubsub &channel:* &logs:*")

        # Should have 2 channel patterns
        self.assertEqual(len(parsed['channel_rules']), 2)
        self.assertEqual(parsed['channel_rules'][0]['pattern'], 'channel:*')
        self.assertEqual(parsed['channel_rules'][1]['pattern'], 'logs:*')
        self.assertEqual(parsed['channel_rules'][0]['type'], 'allow')

    def test_pubsub_channel_with_commands(self):
        """Test mixing pub/sub patterns with command permissions."""
        parsed = self.parser8.parse_acl_rule("+@pubsub &notifications:* +publish")

        # Should have channel pattern and specific command
        self.assertEqual(len(parsed['channel_rules']), 1)
        self.assertEqual(parsed['channel_rules'][0]['pattern'], 'notifications:*')
        self.assertGreater(len(parsed['command_rules']), 0)

    def test_advanced_key_permissions_read_only(self):
        """Test %R~ (read-only) key permission parsing."""
        parsed = self.parser8.parse_acl_rule("+@read %R~user:*")

        self.assertEqual(len(parsed['key_rules']), 1)
        self.assertEqual(parsed['key_rules'][0]['permission'], 'read-only')
        self.assertEqual(parsed['key_rules'][0]['pattern'], 'user:*')
        self.assertEqual(parsed['key_rules'][0]['type'], 'allow')

    def test_advanced_key_permissions_write_only(self):
        """Test %W~ (write-only) key permission parsing."""
        parsed = self.parser8.parse_acl_rule("+@write %W~logs:*")

        self.assertEqual(len(parsed['key_rules']), 1)
        self.assertEqual(parsed['key_rules'][0]['permission'], 'write-only')
        self.assertEqual(parsed['key_rules'][0]['pattern'], 'logs:*')

    def test_advanced_key_permissions_read_write(self):
        """Test %RW~ (read-write) key permission parsing."""
        parsed = self.parser8.parse_acl_rule("+@all %RW~data:*")

        self.assertEqual(len(parsed['key_rules']), 1)
        self.assertEqual(parsed['key_rules'][0]['permission'], 'read-write')
        self.assertEqual(parsed['key_rules'][0]['pattern'], 'data:*')

    def test_mixed_key_permission_types(self):
        """Test mixing different key permission types in one rule."""
        parsed = self.parser8.parse_acl_rule("+@all ~cache:* %R~stats:* %W~logs:*")

        # Should have 3 key patterns with different permissions
        self.assertEqual(len(parsed['key_rules']), 3)
        permissions = [rule['permission'] for rule in parsed['key_rules']]
        self.assertIn('read-write', permissions)  # Default ~
        self.assertIn('read-only', permissions)   # %R~
        self.assertIn('write-only', permissions)  # %W~

    def test_redundancy_deny_all_with_following_commands(self):
        """Test redundancy detection: -@all followed by commands."""
        analysis = self.parser8.analyze_rule_redundancy("-@all +get +set")

        # -@all should be detected as redundant (overridden by subsequent +commands)
        self.assertGreater(len(analysis['redundant_terms']), 0)
        redundant = [r['term'] for r in analysis['redundant_terms']]
        self.assertIn('-@all', redundant)

    def test_redundancy_deny_all_with_only_key_patterns(self):
        """Test redundancy detection: -@all with only key patterns."""
        analysis = self.parser8.analyze_rule_redundancy("-@all ~cache:*")

        # -@all should be detected as meaningless with only key patterns
        self.assertGreater(len(analysis['redundant_terms']), 0)
        redundant_types = [r.get('type') for r in analysis['redundant_terms']]
        # Should detect as meaningless or redundant
        self.assertTrue(any('redundant' in str(t) or 'meaningless' in str(t)
                           for t in redundant_types if t))

    def test_redundancy_complex_overrides(self):
        """Test redundancy detection with complex override patterns."""
        analysis = self.parser8.analyze_rule_redundancy("+@read +get -get +get")

        # Should detect redundant patterns (get added/removed/added again)
        self.assertGreater(len(analysis['redundant_terms']), 0)

    def test_invalid_key_permission_syntax(self):
        """Test handling of invalid key permission syntax."""
        # Invalid key permission syntax should be silently skipped (defensive code)
        parsed = self.parser8.parse_acl_rule("+@read %INVALID~pattern")

        # Should still have @read permissions
        self.assertGreater(len(parsed['command_rules']), 0)
        # Invalid key permission should not crash, just be ignored


class TestFlaskApp(unittest.TestCase):
    """Test Flask application endpoints."""

    def setUp(self):
        """Set up test client."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def test_index_page(self):
        """Test that index page loads."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Redis ACL Builder', response.data)

    def test_health_endpoint(self):
        """Test health check endpoint."""
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertIn('redis_versions', data)
        self.assertIn('total_commands', data)

    def test_parse_api(self):
        """Test the /api/parse endpoint."""
        response = self.client.post('/api/parse',
                                   json={'rule': '+@all', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertIn('granted_commands', data)
        self.assertEqual(len(data['granted_commands']), 379)  # Redis 7 OSS has 379 commands

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
        """Test the /api/categories endpoint."""
        response = self.client.get('/api/categories?version=redis7')
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        # API returns dict with categories list and metadata
        self.assertIn('categories', data)
        self.assertIn('total_categories', data)
        self.assertTrue(isinstance(data['categories'], list))
        self.assertEqual(data['total_categories'], 21)  # Redis 7 has 21 categories
        self.assertEqual(len(data['categories']), 21)

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
        response7 = self.client.get('/api/categories?version=redis7')
        data7 = json.loads(response7.data)

        # Test Redis 8
        response8 = self.client.get('/api/categories?version=redis8')
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

    def test_parse_api_validation(self):
        """Test API validation."""
        # Missing required fields
        response = self.client.post('/api/parse', json={})
        self.assertEqual(response.status_code, 400)  # Pydantic validation error

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
                self.assertIn('Invalid request data', data['message'])

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

    def test_optimize_rule_api(self):
        """Test the /api/optimize-rule endpoint."""
        # Test rule that can be optimized
        response = self.client.post('/api/optimize-rule',
            json={'rule': '+pfadd +pfcount +pfmerge', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('optimized_rule', data)
        self.assertIn('savings', data)

        # The optimized rule should be shorter (pfadd+pfcount+pfmerge = @hyperloglog)
        if data['savings'] > 0:
            self.assertLess(data['optimized_term_count'], data['original_term_count'])

    def test_optimize_rule_already_optimal(self):
        """Test optimize-rule with already optimal rule."""
        # Single category is already optimal
        response = self.client.post('/api/optimize-rule',
            json={'rule': '+@read', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['savings'], 0)
        self.assertEqual(data['optimized_rule'], '+@read')
        self.assertIn('already optimal', data['explanation'].lower())

    def test_optimize_rule_with_key_patterns(self):
        """Test that optimization preserves key patterns."""
        # Rule with commands that can be optimized + key pattern
        response = self.client.post('/api/optimize-rule',
            json={'rule': '+pfadd +pfcount +pfmerge ~cache:*', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # Key pattern should be preserved in optimized rule
        self.assertIn('~cache:*', data['optimized_rule'])

    def test_optimize_rule_with_advanced_key_permissions(self):
        """Test that optimization preserves advanced key permissions."""
        response = self.client.post('/api/optimize-rule',
            json={'rule': '+pfadd +pfcount +pfmerge %R~stats:*', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # Advanced key permission should be preserved
        self.assertIn('%R~stats:*', data['optimized_rule'])

    def test_optimize_rule_complex_scenario(self):
        """Test optimization with mixed categories and exclusions."""
        response = self.client.post('/api/optimize-rule',
            json={'rule': '+@transaction -multi -exec +watch +unwatch', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # Should find an optimization (might be category-based or command-based)
        self.assertIn('optimized_rule', data)

    def test_test_command_key_api(self):
        """Test the /api/test-command-key endpoint (integrated command+key testing)."""
        # Test command with key access granted
        response = self.client.post('/api/test-command-key',
            json={
                'rule': '+@read ~user:*',
                'command': 'GET',
                'key': 'user:123',
                'version': 'redis7'
            })
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['is_allowed'])
        self.assertTrue(data['command_granted'])
        self.assertTrue(data['key_access_granted'])
        self.assertEqual(data['matched_pattern'], 'user:*')

        # Test command granted but key access denied
        response = self.client.post('/api/test-command-key',
            json={
                'rule': '+@read ~user:*',
                'command': 'GET',
                'key': 'product:456',
                'version': 'redis7'
            })
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertFalse(data['is_allowed'])  # Overall denied
        self.assertTrue(data['command_granted'])  # Command is OK
        self.assertFalse(data['key_access_granted'])  # But key is not


class TestErrorHandling(unittest.TestCase):
    """Test error handling across API endpoints."""

    def setUp(self):
        """Set up test client."""
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_parse_api_invalid_category_error(self):
        """Test parse API with invalid category (ValueError path)."""
        response = self.client.post('/api/parse',
            json={'rule': '+@invalid_category_xyz', 'version': 'redis7'})

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertTrue(data['error'])
        self.assertIn('message', data)
        self.assertIn('invalid_category_xyz', data['message'].lower())

    def test_optimize_rule_invalid_syntax_graceful_handling(self):
        """Test optimize-rule API gracefully handles invalid syntax."""
        response = self.client.post('/api/optimize-rule',
            json={'rule': '+@read ((nested', 'version': 'redis7'})

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # Should have explanation about the error
        self.assertIn('explanation', data)
        self.assertIn('Unbalanced parentheses', data['explanation'])
        # Should have 0 savings since optimization failed
        self.assertEqual(data['savings'], 0)

    def test_test_command_key_invalid_command_graceful_handling(self):
        """Test test-command-key API gracefully handles invalid command."""
        response = self.client.post('/api/test-command-key',
            json={
                'rule': '+@read ~*',
                'command': 'INVALID_COMMAND_XYZ',
                'key': 'test:key',
                'version': 'redis7'
            })

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # Should indicate command is not allowed
        self.assertFalse(data['is_allowed'])
        self.assertFalse(data['command_granted'])
        # Should have helpful error message
        self.assertIn('reason', data)
        self.assertIn('not found', data['reason'])

    def test_validate_rule_malformed_selector_validation_errors(self):
        """Test validate-rule API returns validation errors for malformed selectors."""
        response = self.client.post('/api/validate-rule',
            json={'rule': '+@read ((unbalanced', 'version': 'redis7'})

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        # Should indicate rule is invalid
        self.assertFalse(data['is_valid'])
        # Should have specific error messages
        self.assertIn('errors', data)
        self.assertGreater(len(data['errors']), 0)
        # Check for specific validation errors
        errors_str = ' '.join(data['errors'])
        self.assertIn('parenthes', errors_str.lower())

    def test_command_info_unknown_command(self):
        """Test command-info API with unknown command (returns exists=False)."""
        response = self.client.post('/api/command-info',
            json={'command': 'TOTALLY_FAKE_COMMAND', 'version': 'redis7'})

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertFalse(data['exists'])  # Command doesn't exist
        self.assertEqual(data['categories'], [])

    def test_search_commands_with_zero_limit(self):
        """Test search-commands with invalid limit=0 (validation error)."""
        response = self.client.post('/api/search-commands',
            json={'pattern': 'get', 'version': 'redis7', 'limit': 0})

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertTrue(data['error'])
        self.assertIn('message', data)

    def test_search_commands_with_negative_limit(self):
        """Test search-commands with invalid limit=-1 (validation error)."""
        response = self.client.post('/api/search-commands',
            json={'pattern': 'get', 'version': 'redis7', 'limit': -1})

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertTrue(data['error'])
        self.assertIn('message', data)


class TestUserInterface(unittest.TestCase):
    """Test user interface structure and functionality."""

    def setUp(self):
        """Set up test client."""
        app.config['TESTING'] = True
        self.client = app.test_client()

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
        textarea_pos = html_content.find('id="aclRule"')
        version_info_pos = html_content.find('class="version-info"')

        # Verify buttons are positioned correctly relative to other elements
        self.assertTrue(version_info_pos < copy_pos < textarea_pos,
                       "Copy button should be in version-info section before textarea")

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


if __name__ == '__main__':
    unittest.main(verbosity=2)
