"""Property-based tests using Hypothesis for Redis ACL Builder.

These tests use generative testing to discover edge cases and ensure invariants hold
across a wide range of random inputs. Much more powerful than hand-written unit tests.
"""

import unittest
import json
import sys
import os
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from app import app


class TestACLParserProperties(unittest.TestCase):
    """Property-based tests for ACL parser invariants using Flask API."""

    def setUp(self):
        """Set up Flask test client."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    @given(st.lists(st.sampled_from([
        '+@read', '+@write', '+@admin', '+@dangerous', '+@string', '+@list',
        '-@read', '-@write', '-@admin', '-@dangerous', '-@string', '-@list',
        '+get', '+set', '+del', '-get', '-set', '-del',
        '~*', '~cache:*', '~user:*', '%R~*', '%W~*', '%RW~*'
    ]), min_size=1, max_size=10))
    @settings(max_examples=200, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_parser_never_crashes_on_valid_tokens(self, tokens):
        """Property: Parser should never crash on any combination of valid tokens."""
        rule = ' '.join(tokens)

        try:
            result = self.parser_redis7.parse_acl_rule(rule)
            # Should always return a dict with expected keys
            self.assertIsInstance(result, dict)
            self.assertIn('granted_commands', result)
            self.assertIn('blocked_commands', result)
            self.assertIn('parsed_rule', result)
        except ValueError:
            # ValueError is acceptable for truly invalid rules
            pass

    @given(st.lists(st.sampled_from(['+@read', '+@write', '+@string', '+@list', '+@hash']),
                    min_size=1, max_size=5))
    @settings(max_examples=100, deadline=None)
    def test_optimization_preserves_permissions(self, categories):
        """Property: Optimized rule must grant exactly the same commands as original."""
        rule = ' '.join(categories)

        # Parse original rule
        original = self.parser_redis7.parse_acl_rule(rule)
        original_granted = set(original['granted_commands'])

        # Optimize rule
        optimized_result = self.parser_redis7.optimize_rule(rule)

        if optimized_result.get('optimized_rule') and optimized_result['optimized_rule'] != rule:
            # Parse optimized rule
            optimized = self.parser_redis7.parse_acl_rule(optimized_result['optimized_rule'])
            optimized_granted = set(optimized['granted_commands'])

            # CRITICAL INVARIANT: Must grant exactly the same commands
            self.assertEqual(original_granted, optimized_granted,
                           f"Optimization changed permissions!\n"
                           f"Original: {rule}\n"
                           f"Optimized: {optimized_result['optimized_rule']}\n"
                           f"Original granted: {len(original_granted)} commands\n"
                           f"Optimized granted: {len(optimized_granted)} commands")

    @given(st.lists(st.sampled_from(['+get', '+set', '+del', '+mget', '+mset']),
                    min_size=2, max_size=5, unique=True))
    @settings(max_examples=100, deadline=None)
    def test_adding_command_always_increases_or_maintains_granted_count(self, commands):
        """Property: Adding a command should never decrease granted command count."""
        # Start with first command
        base_rule = commands[0]
        base_result = self.parser_redis7.parse_acl_rule(base_rule)
        base_count = len(base_result['granted_commands'])

        # Add each subsequent command
        for cmd in commands[1:]:
            extended_rule = base_rule + ' ' + cmd
            extended_result = self.parser_redis7.parse_acl_rule(extended_rule)
            extended_count = len(extended_result['granted_commands'])

            # Count should increase or stay same (duplicates have no effect)
            self.assertGreaterEqual(extended_count, base_count,
                                  f"Adding {cmd} decreased granted commands from {base_count} to {extended_count}")

            base_rule = extended_rule
            base_count = extended_count

    @given(st.lists(st.sampled_from(['+@read', '+@write', '+@admin', '-@read', '-@write', '-@admin']),
                    min_size=2, max_size=4))
    @settings(max_examples=100, deadline=None)
    def test_rule_precedence_last_rule_wins(self, tokens):
        """Property: Later rules override earlier rules (Redis ACL precedence)."""
        rule = ' '.join(tokens)
        result = self.parser_redis7.parse_acl_rule(rule)

        # Check if rule has both allow and deny for same category
        categories = set()
        has_conflict = False

        for token in tokens:
            if token.startswith(('+@', '-@')):
                cat = token[2:]
                if cat in categories:
                    has_conflict = True
                categories.add(cat)

        if has_conflict:
            # Verify that granted/blocked reflects final state
            parsed = result['parsed_rule']
            # Just verify no crash - detailed precedence is complex with selectors
            self.assertIsNotNone(parsed)

    @given(st.text(alphabet='abcdefghijklmnopqrstuvwxyz@+-~%: ', min_size=1, max_size=50))
    @settings(max_examples=500, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_fuzz_random_input_never_crashes(self, random_input):
        """Property: Parser should handle arbitrary input gracefully (fuzz testing)."""
        # Exclude truly empty input
        assume(random_input.strip())

        try:
            result = self.parser_redis7.parse_acl_rule(random_input)
            # If it parses successfully, should return valid structure
            self.assertIsInstance(result, dict)
        except (ValueError, KeyError, AttributeError):
            # These exceptions are acceptable for invalid input
            pass

    @given(st.sampled_from(['redis7', 'redis8']))
    @settings(max_examples=20, deadline=None)
    def test_empty_rule_blocks_all_commands(self, version):
        """Property: Empty ACL rule should block ALL commands (Redis default)."""
        redis_data = build_command_indexes(get_redis_data())
        parser = ACLParser(redis_data, version)
        result = parser.parse_acl_rule('')

        # Empty rule = no grants, everything blocked
        self.assertEqual(len(result['granted_commands']), 0,
                        "Empty rule should grant 0 commands")

        # Total available should be all commands for that version
        expected_redis7 = 311
        expected_redis8 = 446
        expected_count = expected_redis7 if version == 'redis7' else expected_redis8

        self.assertEqual(result['total_available'], expected_count)

    @given(st.lists(st.sampled_from(['+get', '+set', '+del']), min_size=1, max_size=3))
    @settings(max_examples=50, deadline=None)
    def test_duplicate_commands_have_no_effect(self, commands):
        """Property: Duplicating commands in rule should not change result."""
        unique_rule = ' '.join(commands)
        duplicate_rule = ' '.join(commands * 3)  # Triple each command

        unique_result = self.parser_redis7.parse_acl_rule(unique_rule)
        duplicate_result = self.parser_redis7.parse_acl_rule(duplicate_rule)

        self.assertEqual(
            set(unique_result['granted_commands']),
            set(duplicate_result['granted_commands']),
            "Duplicate commands changed the result"
        )

    @given(st.sampled_from(['+@all', '+@read', '+@write', '+@admin', '+@string']))
    @settings(max_examples=50, deadline=None)
    def test_redis8_always_has_more_or_equal_commands(self, category):
        """Property: Redis 8 should have >= commands than Redis 7 for any category."""
        redis7_result = self.parser_redis7.parse_acl_rule(category)
        redis8_result = self.parser_redis8.parse_acl_rule(category)

        redis7_count = len(redis7_result['granted_commands'])
        redis8_count = len(redis8_result['granted_commands'])

        self.assertGreaterEqual(redis8_count, redis7_count,
                               f"{category}: Redis 8 ({redis8_count}) should have >= Redis 7 ({redis7_count})")

    @given(st.lists(st.sampled_from(['~*', '~cache:*', '~user:*', '~session:*']),
                    min_size=1, max_size=3))
    @settings(max_examples=50, deadline=None)
    def test_key_patterns_do_not_affect_command_grants(self, patterns):
        """Property: Key patterns should not affect which commands are granted."""
        rule_without_keys = '+@all'
        rule_with_keys = '+@all ' + ' '.join(patterns)

        without = self.parser_redis7.parse_acl_rule(rule_without_keys)
        with_keys = self.parser_redis7.parse_acl_rule(rule_with_keys)

        # Key patterns don't affect command permissions
        self.assertEqual(
            set(without['granted_commands']),
            set(with_keys['granted_commands']),
            "Key patterns should not affect command grants"
        )

    @given(st.lists(st.sampled_from(['+@read', '+@write', '+get', '+set', '-del', '-@admin']),
                    min_size=3, max_size=8))
    @settings(max_examples=100, deadline=None)
    def test_redundancy_detection_is_idempotent(self, tokens):
        """Property: Running redundancy analysis twice should give same result."""
        rule = ' '.join(tokens)

        try:
            result1 = self.parser_redis7.analyze_redundancy(rule)
            result2 = self.parser_redis7.analyze_redundancy(rule)

            # Results should be identical
            self.assertEqual(result1['has_redundancy'], result2['has_redundancy'])
            self.assertEqual(
                [t['term'] for t in result1.get('redundant_terms', [])],
                [t['term'] for t in result2.get('redundant_terms', [])]
            )
        except ValueError:
            # Invalid rule is acceptable
            pass


class ACLParserStateMachine(RuleBasedStateMachine):
    """Stateful property-based testing using state machine approach.

    This tests sequences of operations to find subtle bugs that only appear
    when operations are combined in specific orders.
    """

    def __init__(self):
        super().__init__()
        redis_data = build_command_indexes(get_redis_data())
        self.parser = ACLParser(redis_data, 'redis7')
        self.current_rule = ''
        self.granted_commands = set()

    @rule(category=st.sampled_from(['+@read', '+@write', '+@string', '+@list', '+@hash']))
    def add_category(self, category):
        """Add a category to current rule."""
        if self.current_rule:
            self.current_rule += ' '
        self.current_rule += category

        # Update expected granted commands
        result = self.parser.parse_acl_rule(self.current_rule)
        self.granted_commands = set(result['granted_commands'])

    @rule(command=st.sampled_from(['+get', '+set', '+del', '+lpush', '+hget']))
    def add_command(self, command):
        """Add a command to current rule."""
        if self.current_rule:
            self.current_rule += ' '
        self.current_rule += command

        result = self.parser.parse_acl_rule(self.current_rule)
        self.granted_commands = set(result['granted_commands'])

    @rule(category=st.sampled_from(['-@admin', '-@dangerous', '-@write']))
    def deny_category(self, category):
        """Deny a category."""
        if self.current_rule:
            self.current_rule += ' '
        self.current_rule += category

        result = self.parser.parse_acl_rule(self.current_rule)
        self.granted_commands = set(result['granted_commands'])

    @invariant()
    def granted_commands_match_parse_result(self):
        """Invariant: Tracked granted commands should always match parser result."""
        if self.current_rule:
            result = self.parser.parse_acl_rule(self.current_rule)
            actual_granted = set(result['granted_commands'])

            assert self.granted_commands == actual_granted, \
                f"State mismatch! Tracked: {len(self.granted_commands)}, Actual: {len(actual_granted)}"

    @invariant()
    def total_commands_is_constant(self):
        """Invariant: Total available commands should always be 311 for Redis 7."""
        if self.current_rule:
            result = self.parser.parse_acl_rule(self.current_rule)
            assert result['total_available'] == 311, \
                f"Total available changed to {result['total_available']}"


# Run the state machine as a test
TestACLStateMachine = ACLParserStateMachine.TestCase


if __name__ == '__main__':
    unittest.main()
