"""
Enhanced pytest tests for ACL Parser with fixtures and parametrization
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

    def test_all_category(self, parser_redis7):
        """Test @all special category"""
        parsed = parser_redis7.parse_acl_rule("+@all -@dangerous")
        granted, _ = parser_redis7.evaluate_command_permissions(parsed)

        # Should have most commands
        assert len(granted) > 248

        # But not dangerous ones
        assert 'flushdb' not in granted
        assert 'flushall' not in granted
        assert 'get' in granted

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

    def test_nonexistent_command(self, parser_redis7):
        """Test non-existent command"""
        parsed = parser_redis7.parse_acl_rule("+@read")
        is_granted, explanation, categories, selector_index = parser_redis7.test_command_access('NONEXISTENT', parsed)

        assert is_granted is False
        assert 'not found' in explanation


class TestRuleValidation:
    """Test rule validation functionality"""

    @pytest.mark.parametrize("rule,expected_valid", [
        ("+@read +get", True),
        ("+@write -set", True),
        ("+get +set +del", True),
        ("+@read ~user:*", True),
        ("+@nonexistent", False),
        ("+@read +@invalid", False),
        ("+nonexistentcmd", False),
    ])
    def test_rule_validation(self, parser_redis7, rule, expected_valid):
        """Test rule validation with various inputs"""
        is_valid, errors = parser_redis7.validate_rule_syntax(rule)
        assert is_valid == expected_valid

        if not expected_valid:
            assert len(errors) > 0


class TestSearchCommands:
    """Test command search functionality"""

    @pytest.mark.parametrize("pattern,should_include,should_exclude", [
        ("h*", ["hget", "hset"], ["get", "set"]),
        ("get", ["get", "hget", "mget"], ["set", "del"]),
        ("*set", ["set", "hset", "mset"], ["get", "del"]),
    ])
    def test_command_search(self, parser_redis7, pattern, should_include, should_exclude):
        """Test command search with patterns"""
        results = parser_redis7.search_commands(pattern)

        for cmd in should_include:
            assert cmd in results

        for cmd in should_exclude:
            assert cmd not in results


class TestCategoryInfo:
    """Test category information retrieval"""

    def test_category_info(self, parser_redis7):
        """Test category information retrieval"""
        info = parser_redis7.get_category_info()

        assert 'read' in info
        assert 'write' in info
        assert isinstance(info['read'], int)
        assert info['read'] > 50

    @pytest.mark.parametrize("version_parser,expected_categories", [
        ("parser_redis7", ['keyspace', 'read', 'write', 'set', 'sortedset', 'list', 'hash']),
        ("parser_redis8", ['keyspace', 'read', 'write', 'json', 'search', 'timeseries']),
    ])
    def test_version_specific_categories(self, request, version_parser, expected_categories):
        """Test that different Redis versions have expected categories"""
        parser = request.getfixturevalue(version_parser)
        info = parser.get_category_info()

        for cat in expected_categories:
            assert cat in info, f"Expected category {cat} not found in {version_parser}"


class TestImpactSummary:
    """Test rule impact summary"""

    def test_impact_summary(self, parser_redis7):
        """Test rule impact summary"""
        parsed = parser_redis7.parse_acl_rule("+@read")
        summary = parser_redis7.get_rule_impact_summary(parsed)

        assert 'total_granted' in summary
        assert 'total_commands' in summary
        assert 'category_impact' in summary
        assert 'read' in summary['category_impact']

        # Read category should be 100% granted
        read_impact = summary['category_impact']['read']
        assert read_impact['percentage'] == 100.0


class TestRedis8Features:
    """Test Redis 8 specific features"""

    def test_redis8_search_category(self, parser_redis8):
        """Test that Redis 8 search commands are properly handled"""
        parsed = parser_redis8.parse_acl_rule("+@search")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # Check that search commands are granted
        search_commands = [cmd for cmd in granted if cmd.startswith('ft.')]
        assert len(search_commands) > 0, "Should grant FT.* commands"

        # Check specific command
        assert 'ft.search' in granted

    @pytest.mark.parametrize("category,expected_prefix", [
        ("@json", "json."),
        ("@search", "ft."),
        ("@timeseries", "ts."),
        ("@bloom", "bf."),
    ])
    def test_redis8_module_categories(self, parser_redis8, category, expected_prefix):
        """Test Redis 8 module categories"""
        parsed = parser_redis8.parse_acl_rule(f"+{category}")
        granted, _ = parser_redis8.evaluate_command_permissions(parsed)

        # Check that module commands are granted
        module_commands = [cmd for cmd in granted if cmd.startswith(expected_prefix)]
        assert len(module_commands) > 0, f"Should grant {expected_prefix}* commands"


class TestDataConsistency:
    """Test data consistency across versions"""

    def test_command_exists_in_both_versions(self, parser_redis7, parser_redis8):
        """Test that common commands exist in both versions"""
        common_commands = ['get', 'set', 'hget', 'hset', 'del']

        for cmd in common_commands:
            categories7 = parser_redis7.get_command_categories(cmd)
            categories8 = parser_redis8.get_command_categories(cmd)

            assert len(categories7) > 0, f"Command {cmd} not found in Redis 7"
            assert len(categories8) > 0, f"Command {cmd} not found in Redis 8"

    def test_redis8_has_more_commands(self, parser_redis7, parser_redis8):
        """Test that Redis 8 has more commands than Redis 7"""
        redis7_info = parser_redis7.get_category_info()
        redis8_info = parser_redis8.get_category_info()

        total_redis7 = sum(redis7_info.values())
        total_redis8 = sum(redis8_info.values())

        assert total_redis8 > total_redis7, "Redis 8 should have more commands than Redis 7"
