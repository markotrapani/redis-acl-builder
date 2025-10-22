#!/usr/bin/env python3
"""
Redis ACL Builder - Test Suite
Comprehensive tests for all application functionality
Updated for monorepo structure and Redis OSS command sets
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
        self.assertGreaterEqual(len(latency_commands), 6,
                               "Redis 7 OSS should have 6+ latency commands")
    
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
        """Test that empty ACL blocks all commands."""
        parsed = self.parser7.parse_acl_rule("")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Empty ACL should block all commands
        self.assertEqual(len(granted), 0)
    
    def test_all_category(self):
        """Test @all category grants all commands."""
        parsed = self.parser7.parse_acl_rule("+@all")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Should grant all 379 Redis 7 commands
        self.assertEqual(len(granted), 379)
    
    def test_category_grant(self):
        """Test granting a specific category."""
        parsed = self.parser7.parse_acl_rule("+@read")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Should grant read commands
        self.assertGreater(len(granted), 80)  # Redis 7 has 91 read commands
        self.assertIn('get', granted)
        self.assertIn('hget', granted)
    
    def test_command_precedence(self):
        """Test that later rules override earlier ones."""
        parsed = self.parser7.parse_acl_rule("+@all -get")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # GET should be blocked despite +@all
        self.assertNotIn('get', granted)

        # Other commands should still be granted
        self.assertIn('set', granted)
        self.assertIn('hget', granted)
    
    def test_individual_command(self):
        """Test granting individual commands."""
        parsed = self.parser7.parse_acl_rule("+get +set")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Only GET and SET should be granted
        self.assertEqual(len(granted), 2)
        self.assertIn('get', granted)
        self.assertIn('set', granted)
    
    def test_mixed_rules(self):
        """Test complex ACL with mixed grant/deny rules."""
        parsed = self.parser7.parse_acl_rule("+@read +@write -del -flushdb")
        granted, _ = self.parser7.evaluate_command_permissions(parsed)

        # Read/write commands should be granted except del and flushdb
        self.assertIn('get', granted)
        self.assertIn('set', granted)
        self.assertNotIn('del', granted)
        self.assertNotIn('flushdb', granted)


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
    
    def test_parse_api(self):
        """Test the /api/parse endpoint."""
        response = self.client.post('/api/parse',
                                   json={'rule': '+@all', 'version': 'redis7'})
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertIn('granted_commands', data)
        self.assertEqual(len(data['granted_commands']), 379)  # Redis 7 OSS has 379 commands
    
    def test_parse_api_validation(self):
        """Test API validation."""
        # Missing required fields
        response = self.client.post('/api/parse', json={})
        self.assertEqual(response.status_code, 400)  # Pydantic validation error
    
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


if __name__ == '__main__':
    unittest.main()
