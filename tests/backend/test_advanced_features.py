#!/usr/bin/env python3
"""
Redis ACL Builder - Advanced Features Test Suite
Tests for rule optimization and OSS-specific advanced features
"""

import pytest


class TestRuleOptimization:
    """Test ACL rule optimization features."""

    def test_category_consolidation(self, parser_redis7):
        """Test that individual commands can be consolidated into categories."""
        # Grant all geo commands individually
        parsed = parser_redis7.parse_acl_rule("+geoadd +geodist +geohash +geopos +georadius +georadius_ro +georadiusbymember +georadiusbymember_ro +geosearch +geosearchstore")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # All geo commands should be granted
        assert len(granted) == 10
        for cmd in ['geoadd', 'geodist', 'geohash', 'geopos', 'georadius', 'georadius_ro', 'georadiusbymember', 'georadiusbymember_ro', 'geosearch', 'geosearchstore']:
            assert cmd in granted

    def test_partial_category_detection(self, parser_redis7):
        """Test detection of partially granted categories."""
        # Grant most but not all read commands
        parsed = parser_redis7.parse_acl_rule("+@read -get -mget")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have most read commands but not get/mget
        assert 'hget' in granted
        assert 'lindex' in granted
        assert 'get' not in granted
        assert 'mget' not in granted

    def test_redundant_individual_commands(self, parser_redis7):
        """Test detection of redundant individual command grants."""
        # Grant category then also individual commands
        parsed = parser_redis7.parse_acl_rule("+@geo +geoadd +geodist")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # All geo commands should be granted (redundant individual grants don't hurt)
        assert len(granted) == 10


class TestOSSSpecificAdvancedFeatures:
    """Test advanced features specific to Redis OSS."""

    def test_cluster_commands_in_different_categories(self, parser_redis7):
        """Test that cluster commands appear in multiple categories."""
        # Cluster commands should be in admin, slow, and dangerous
        parsed_admin = parser_redis7.parse_acl_rule("+@admin")
        granted_admin, _ = parser_redis7.evaluate_command_permissions(parsed_admin)

        parsed_dangerous = parser_redis7.parse_acl_rule("+@dangerous")
        granted_dangerous, _ = parser_redis7.evaluate_command_permissions(parsed_dangerous)

        # cluster|failover should be in both
        assert 'cluster|failover' in granted_admin
        assert 'cluster|failover' in granted_dangerous

    def test_latency_monitoring_commands(self, parser_redis7):
        """Test latency monitoring commands (OSS-only feature)."""
        parsed = parser_redis7.parse_acl_rule("+@admin")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        latency_commands = ['latency|doctor', 'latency|histogram', 'latency|history', 'latency|latest', 'latency|reset']
        for cmd in latency_commands:
            assert cmd in granted, f"Latency command {cmd} should be in Redis 7 OSS"

    def test_memory_commands(self, parser_redis7):
        """Test memory management commands (OSS-only feature)."""
        parsed = parser_redis7.parse_acl_rule("+@slow")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        memory_commands = ['memory|doctor', 'memory|malloc-stats', 'memory|purge', 'memory|stats']
        for cmd in memory_commands:
            assert cmd in granted, f"Memory command {cmd} should be in Redis 7 OSS"

    def test_replication_commands_complete(self, parser_redis7):
        """Test all replication commands are present (OSS)."""
        parsed = parser_redis7.parse_acl_rule("+@admin")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        replication_commands = ['replicaof', 'slaveof', 'psync', 'sync', 'replconf']
        for cmd in replication_commands:
            assert cmd in granted, f"Replication command {cmd} should be in Redis 7 OSS"


class TestRedis8ModuleFeatures:
    """Test Redis 8 module-specific advanced features."""

    def test_redisearch_command_coverage(self, parser_redis8):
        """Test RediSearch module commands are complete."""
        parsed = parser_redis8.parse_acl_rule("+@search")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # Check for key RediSearch commands
        search_commands = ['ft.search', 'ft.create', 'ft.add', 'ft.aggregate', 'ft.info', 'ft.drop']
        for cmd in search_commands:
            assert cmd in granted, f"RediSearch command {cmd} should be in Redis 8 OSS"

        # Should have 38 total RediSearch commands
        assert len(granted) == 38

    def test_redisjson_command_coverage(self, parser_redis8):
        """Test RedisJSON module commands are complete."""
        parsed = parser_redis8.parse_acl_rule("+@json")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # Check for key RedisJSON commands
        json_commands = ['json.get', 'json.set', 'json.del', 'json.mget', 'json.arrappend']
        for cmd in json_commands:
            assert cmd in granted, f"RedisJSON command {cmd} should be in Redis 8 OSS"

        # Should have 25 total RedisJSON commands
        assert len(granted) == 25

    def test_timeseries_command_coverage(self, parser_redis8):
        """Test TimeSeries module commands are complete."""
        parsed = parser_redis8.parse_acl_rule("+@timeseries")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # Check for key TimeSeries commands
        ts_commands = ['ts.create', 'ts.add', 'ts.get', 'ts.range', 'ts.mget']
        for cmd in ts_commands:
            assert cmd in granted, f"TimeSeries command {cmd} should be in Redis 8 OSS"

        # Should have 17 total TimeSeries commands
        assert len(granted) == 17

    def test_probabilistic_modules(self, parser_redis8):
        """Test probabilistic data structure modules."""
        # Test Bloom filter
        parsed_bloom = parser_redis8.parse_acl_rule("+@bloom")
        granted_bloom, _ = parser_redis8.evaluate_command_permissions(parsed_bloom)
        assert len(granted_bloom) == 11

        # Test Cuckoo filter
        parsed_cuckoo = parser_redis8.parse_acl_rule("+@cuckoo")
        granted_cuckoo, _ = parser_redis8.evaluate_command_permissions(parsed_cuckoo)
        assert len(granted_cuckoo) == 14

        # Test Count-Min Sketch
        parsed_cms = parser_redis8.parse_acl_rule("+@cms")
        granted_cms, _ = parser_redis8.evaluate_command_permissions(parsed_cms)
        assert len(granted_cms) == 6

        # Test Top-K
        parsed_topk = parser_redis8.parse_acl_rule("+@topk")
        granted_topk, _ = parser_redis8.evaluate_command_permissions(parsed_topk)
        assert len(granted_topk) == 7

        # Test T-Digest
        parsed_tdigest = parser_redis8.parse_acl_rule("+@tdigest")
        granted_tdigest, _ = parser_redis8.evaluate_command_permissions(parsed_tdigest)
        assert len(granted_tdigest) == 14


class TestComplexScenarios:
    """Test complex real-world ACL scenarios."""

    def test_read_only_user_with_monitoring(self, parser_redis7):
        """Test read-only user that can also monitor latency."""
        parsed = parser_redis7.parse_acl_rule("+@read +latency|doctor +latency|latest")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have read commands
        assert 'get' in granted
        assert 'hget' in granted

        # Should have specific latency commands
        assert 'latency|doctor' in granted
        assert 'latency|latest' in granted

        # Should NOT have write commands
        assert 'set' not in granted
        assert 'del' not in granted

    def test_application_user_without_dangerous_ops(self, parser_redis7):
        """Test application user with broad access but no dangerous operations."""
        parsed = parser_redis7.parse_acl_rule("+@all -@dangerous")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have normal operations
        assert 'get' in granted
        assert 'set' in granted
        assert 'hget' in granted

        # Should NOT have dangerous operations
        assert 'flushdb' not in granted
        assert 'flushall' not in granted
        assert 'keys' not in granted
        assert 'monitor' not in granted

    def test_developer_with_no_cluster_access(self, parser_redis7):
        """Test developer user without cluster management access."""
        # Grant admin but block some cluster commands explicitly
        # Note: Redis ACL wildcard patterns (cluster|*) are not implemented in this tool
        parsed = parser_redis7.parse_acl_rule("+@admin -cluster|addslots -cluster|meet -cluster|failover")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have admin commands
        assert 'config|get' in granted
        assert 'slowlog|get' in granted

        # Should NOT have the blocked cluster commands
        assert 'cluster|addslots' not in granted
        assert 'cluster|meet' not in granted
        assert 'cluster|failover' not in granted

        # But should have other cluster commands that weren't blocked
        assert 'cluster|reset' in granted
        assert 'cluster|replicas' in granted
