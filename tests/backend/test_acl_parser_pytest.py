"""
Enhanced pytest tests for ACL Parser with fixtures and parametrization
Updated for Redis OSS command sets (Redis 7: 379 commands, Redis 8: 496 commands)
"""

import pytest


class TestACLParserBasics:
    """Test basic ACL parser functionality"""

    def test_empty_rule(self, parser_redis7):
        """Test parsing empty rule (should block all per Redis ACL specification)"""
        parsed = parser_redis7.parse_acl_rule("")
        assert len(parsed['command_rules']) == 0
        assert len(parsed['key_rules']) == 0

        granted, explanations = parser_redis7.evaluate_command_permissions(parsed)
        # Empty rules should block all commands (Redis default "deny by default" behavior)
        assert len(granted) == 0

    @pytest.mark.parametrize("rule,expected_commands", [
        ("+@read", ["get", "hget", "mget"]),
        ("+@write", ["set", "hset", "mset"]),
        ("+@string", ["get", "set", "append"]),
    ])
    def test_basic_category_rules(self, parser_redis7, rule, expected_commands):
        """Test basic category allow rules"""
        parsed = parser_redis7.parse_acl_rule(rule)
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        for cmd in expected_commands:
            assert cmd in granted

    @pytest.mark.parametrize("rule,allowed,denied", [
        ("+@read -get", ["mget", "hget"], ["get", "set"]),
        ("+@all -@dangerous", ["get", "set"], ["flushdb", "flushall"]),
        ("+get +set -set", ["get"], ["set", "del"]),
    ])
    def test_command_precedence(self, parser_redis7, rule, allowed, denied):
        """Test left-to-right rule precedence"""
        parsed = parser_redis7.parse_acl_rule(rule)
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        for cmd in allowed:
            assert cmd in granted, f"Expected {cmd} to be granted"

        for cmd in denied:
            assert cmd not in granted, f"Expected {cmd} to be denied"

    def test_individual_commands(self, parser_redis7):
        """Test individual command grants"""
        parsed = parser_redis7.parse_acl_rule("+get +set +hget")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        assert 'get' in granted
        assert 'set' in granted
        assert 'hget' in granted
        assert 'del' not in granted
        assert len(granted) == 3

    def test_all_category_redis7(self, parser_redis7):
        """Test @all special category for Redis 7 OSS (379 commands)"""
        parsed = parser_redis7.parse_acl_rule("+@all")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Redis 7 OSS has 379 commands
        assert len(granted) == 379

    def test_all_category_redis8(self, parser_redis8):
        """Test @all special category for Redis 8 OSS (494 commands)"""
        parsed = parser_redis8.parse_acl_rule("+@all")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # Redis 8 OSS has 494 commands (496 total minus 2 internal underscore-prefixed: _ft.debug, _ft.config)
        assert len(granted) == 494

    def test_dangerous_category_exclusion(self, parser_redis7):
        """Test excluding dangerous category"""
        parsed = parser_redis7.parse_acl_rule("+@all -@dangerous")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have most commands but not dangerous ones
        assert 'get' in granted
        assert 'set' in granted
        
        # Dangerous commands should be blocked
        assert 'flushdb' not in granted
        assert 'flushall' not in granted
        assert 'keys' not in granted  # keys is dangerous in OSS

    def test_redis7_cluster_commands(self, parser_redis7):
        """Test Redis 7 OSS includes cluster commands (not in Enterprise)"""
        parsed = parser_redis7.parse_acl_rule("+@admin")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Cluster commands that Enterprise blocks
        assert 'cluster|addslots' in granted
        assert 'cluster|meet' in granted
        assert 'cluster|failover' in granted

    def test_redis7_replication_commands(self, parser_redis7):
        """Test Redis 7 OSS includes replication commands"""
        parsed = parser_redis7.parse_acl_rule("+@admin")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Replication commands that Enterprise blocks
        assert 'replicaof' in granted
        assert 'psync' in granted
        assert 'sync' in granted

    def test_redis8_module_commands(self, parser_redis8):
        """Test Redis 8 includes module commands"""
        parsed = parser_redis8.parse_acl_rule("+@search")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # RediSearch commands
        assert 'ft.search' in granted
        assert 'ft.create' in granted

    def test_key_patterns(self, parser_redis7):
        """Test key pattern parsing"""
        parsed = parser_redis7.parse_acl_rule("+@read ~user:* ~session:*")

        assert len(parsed['key_rules']) == 2
        patterns = [rule['pattern'] for rule in parsed['key_rules']]
        assert 'user:*' in patterns
        assert 'session:*' in patterns


class TestCommandTesting:
    """Test command testing functionality"""

    @pytest.mark.parametrize("rule,command,expected_granted,expected_categories", [
        ("+@read", "GET", True, ["read"]),
        ("+@read", "SET", False, []),
        ("+@read -get", "GET", False, []),
        ("+@read -get", "MGET", True, ["read"]),
    ])
    def test_command_access(self, parser_redis7, rule, command, expected_granted, expected_categories):
        """Test individual command access testing"""
        parsed = parser_redis7.parse_acl_rule(rule)
        is_granted, explanation, categories, selector_index = parser_redis7.test_command_access(command, parsed)

        assert is_granted == expected_granted
        for cat in expected_categories:
            assert cat in categories


class TestRedisVersionDifferences:
    """Test differences between Redis 7 and Redis 8"""

    def test_redis8_has_more_commands(self, parser_redis7, parser_redis8):
        """Test that Redis 8 has more commands than Redis 7"""
        parsed7 = parser_redis7.parse_acl_rule("+@all")
        granted7, _ = parser_redis7.evaluate_command_permissions(parsed7)

        parsed8 = parser_redis8.parse_acl_rule("+@all")
        granted8, _ = parser_redis8.evaluate_command_permissions(parsed8)

        # Redis 8 should have 115 more commands than Redis 7 (494 - 379 = 115)
        # (496 total minus 2 internal underscore-prefixed: _ft.debug, _ft.config)
        assert len(granted8) > len(granted7)
        assert len(granted8) - len(granted7) == 115

    def test_redis8_has_additional_categories(self, redis_data):
        """Test Redis 8 has additional module categories"""
        redis7_cats = set(redis_data['redis7']['categories'].keys())
        redis8_cats = set(redis_data['redis8']['categories'].keys())

        # Redis 8 should have all Redis 7 categories
        assert redis7_cats.issubset(redis8_cats)

        # Redis 8 should have these additional categories
        new_categories = {'json', 'timeseries', 'search', 'bloom', 'cuckoo', 'cms', 'topk', 'tdigest'}
        assert new_categories.issubset(redis8_cats)


class TestComplexRules:
    """Test complex ACL rules"""

    def test_multiple_category_exclusions(self, parser_redis7):
        """Test ACL with multiple exclusions"""
        parsed = parser_redis7.parse_acl_rule("+@all -@dangerous -@admin -@slow")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have some commands
        assert len(granted) > 50

        # But not these categories
        assert 'flushdb' not in granted
        assert 'monitor' not in granted
        assert 'keys' not in granted

    def test_category_with_command_overrides(self, parser_redis7):
        """Test category grants with individual command overrides"""
        parsed = parser_redis7.parse_acl_rule("+@read +@write -del -flushdb -get")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have read/write commands
        assert 'mget' in granted
        assert 'set' in granted

        # But not these overridden ones
        assert 'del' not in granted
        assert 'flushdb' not in granted
        assert 'get' not in granted


class TestOSSvsEnterprise:
    """Test OSS-specific commands that Enterprise blocks"""

    def test_cluster_commands_in_oss(self, parser_redis7):
        """Verify cluster commands exist in OSS data"""
        parsed = parser_redis7.parse_acl_rule("+@slow")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # These cluster commands should be present in OSS
        cluster_commands = [
            'cluster|addslots', 'cluster|meet', 'cluster|failover',
            'cluster|replicate', 'cluster|reset', 'cluster|myshardid'
        ]
        for cmd in cluster_commands:
            assert cmd in granted, f"{cmd} should be in Redis 7 OSS"

    def test_latency_commands_in_oss(self, parser_redis7):
        """Verify latency monitoring commands exist in OSS data"""
        parsed = parser_redis7.parse_acl_rule("+@admin")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Latency commands should be present
        latency_commands = [
            'latency|doctor', 'latency|histogram', 'latency|history',
            'latency|latest', 'latency|reset'
        ]
        for cmd in latency_commands:
            assert cmd in granted, f"{cmd} should be in Redis 7 OSS"

    def test_module_management_in_oss(self, parser_redis7):
        """Verify module management commands exist in OSS data"""
        parsed = parser_redis7.parse_acl_rule("+@admin")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Module management commands
        module_commands = ['module|load', 'module|unload', 'module|loadex']
        for cmd in module_commands:
            assert cmd in granted, f"{cmd} should be in Redis 7 OSS"
