"""Property-based tests using Hypothesis for Redis ACL Builder.

These tests use generative testing to discover edge cases and ensure invariants hold
across a wide range of random inputs. Much more powerful than hand-written unit tests.

Tests use the Flask API (not internal parser methods) to ensure we're testing
the actual production code paths that users will interact with.
"""

import unittest
import json
import sys
import os
from hypothesis import given, strategies as st, assume, settings, HealthCheck

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from app import app


class TestACLAPIProperties(unittest.TestCase):
    """Property-based tests for ACL API invariants."""

    def setUp(self):
        """Set up Flask test client."""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def parse_rule(self, rule, version='redis7'):
        """Helper to parse rule via API."""
        response = self.client.post('/api/parse', json={'rule': rule, 'version': version})
        if response.status_code == 200:
            return json.loads(response.data)
        return None

    @given(st.lists(st.sampled_from([
        '+@read', '+@write', '+@admin', '+@dangerous', '+@string', '+@list',
        '-@read', '-@write', '-@admin', '-@dangerous', '-@string', '-@list',
        '+get', '+set', '+del', '-get', '-set', '-del',
        '~*', '~cache:*'
    ]), min_size=1, max_size=10))
    @settings(max_examples=200, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_api_never_crashes_on_valid_tokens(self, tokens):
        """Property: API should never crash on any combination of valid tokens."""
        rule = ' '.join(tokens)
        response = self.client.post('/api/parse', json={'rule': rule, 'version': 'redis7'})

        # Should always return 200 or 400 (never 500)
        self.assertIn(response.status_code, [200, 400],
                     f"API crashed with {response.status_code} for rule: {rule}")

    @given(st.lists(st.sampled_from(['+@read', '+@write', '+@string', '+@list', '+@hash']),
                    min_size=1, max_size=5))
    @settings(max_examples=100, deadline=None)
    def test_optimization_preserves_permissions(self, categories):
        """Property: Optimized rule must grant exactly the same commands as original."""
        rule = ' '.join(categories)

        # Parse original rule
        original_data = self.parse_rule(rule)
        if not original_data or not original_data.get('success'):
            return  # Skip invalid rules

        original_granted = set(original_data['granted_commands'])

        # Optimize rule
        opt_response = self.client.post('/api/optimize-rule', json={'rule': rule, 'version': 'redis7'})
        if opt_response.status_code != 200:
            return

        opt_data = json.loads(opt_response.data)
        optimized_rule = opt_data.get('optimized_rule', rule)

        # Parse optimized rule
        optimized_data = self.parse_rule(optimized_rule)
        if not optimized_data or not optimized_data.get('success'):
            self.fail(f"Optimized rule failed to parse: {optimized_rule}")

        optimized_granted = set(optimized_data['granted_commands'])

        # CRITICAL INVARIANT: Must grant exactly the same commands
        self.assertEqual(original_granted, optimized_granted,
                       f"Optimization changed permissions!\n"
                       f"Original: {rule} ({len(original_granted)} commands)\n"
                       f"Optimized: {optimized_rule} ({len(optimized_granted)} commands)")

    @given(st.lists(st.sampled_from(['+get', '+set', '+del', '+mget', '+mset']),
                    min_size=2, max_size=5, unique=True))
    @settings(max_examples=100, deadline=None)
    def test_adding_command_increases_or_maintains_granted_count(self, commands):
        """Property: Adding a command should never decrease granted command count."""
        # Start with first command
        base_rule = commands[0]
        base_data = self.parse_rule(base_rule)
        if not base_data or not base_data.get('success'):
            return

        base_count = len(base_data['granted_commands'])

        # Add each subsequent command
        for cmd in commands[1:]:
            extended_rule = base_rule + ' ' + cmd
            extended_data = self.parse_rule(extended_rule)

            if not extended_data or not extended_data.get('success'):
                continue

            extended_count = len(extended_data['granted_commands'])

            # Count should increase or stay same (duplicates have no effect)
            self.assertGreaterEqual(extended_count, base_count,
                                  f"Adding {cmd} decreased granted commands from {base_count} to {extended_count}")

            base_rule = extended_rule
            base_count = extended_count

    @given(st.text(alphabet='abcdefghijklmnopqrstuvwxyz@+-~%: ', min_size=1, max_size=50))
    @settings(max_examples=500, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_fuzz_random_input_never_crashes(self, random_input):
        """Property: API should handle arbitrary input gracefully (fuzz testing)."""
        # Exclude truly empty input
        assume(random_input.strip())

        response = self.client.post('/api/parse', json={'rule': random_input, 'version': 'redis7'})

        # Should never crash with 500
        self.assertNotEqual(response.status_code, 500,
                          f"API crashed with 500 for input: {random_input}")

    @given(st.sampled_from(['redis7', 'redis8']))
    @settings(max_examples=20, deadline=None)
    def test_empty_rule_blocks_all_commands(self, version):
        """Property: Empty ACL rule should block ALL commands (Redis default)."""
        data = self.parse_rule('', version)

        if not data or not data.get('success'):
            # Empty rule parsing might return validation error
            return

        # Empty rule = no grants, everything blocked
        self.assertEqual(len(data.get('granted_commands', [])), 0,
                        "Empty rule should grant 0 commands")

        # Total available should be all commands for that version
        expected_redis7 = 379  # Updated from 311
        expected_redis8 = 488
        expected_count = expected_redis7 if version == 'redis7' else expected_redis8

        self.assertEqual(data['total_available'], expected_count)

    @given(st.lists(st.sampled_from(['+get', '+set', '+del']), min_size=1, max_size=3))
    @settings(max_examples=50, deadline=None)
    def test_duplicate_commands_have_no_effect(self, commands):
        """Property: Duplicating commands in rule should not change result."""
        unique_rule = ' '.join(commands)
        duplicate_rule = ' '.join(commands * 3)  # Triple each command

        unique_data = self.parse_rule(unique_rule)
        duplicate_data = self.parse_rule(duplicate_rule)

        if not unique_data or not duplicate_data:
            return

        self.assertEqual(
            set(unique_data.get('granted_commands', [])),
            set(duplicate_data.get('granted_commands', [])),
            "Duplicate commands changed the result"
        )

    @given(st.sampled_from(['+@all', '+@read', '+@write', '+@string', '+@list']))
    @settings(max_examples=50, deadline=None)
    def test_redis8_has_more_or_equal_commands(self, category):
        """Property: Redis 8 should have >= commands than Redis 7 for most categories.

        Note: @admin shrank from 65 → 22 in Redis 8 due to category reorganization.
        Testing with categories that grew or stayed the same.
        """
        redis7_data = self.parse_rule(category, 'redis7')
        redis8_data = self.parse_rule(category, 'redis8')

        if not redis7_data or not redis8_data:
            return

        redis7_count = len(redis7_data.get('granted_commands', []))
        redis8_count = len(redis8_data.get('granted_commands', []))

        self.assertGreaterEqual(redis8_count, redis7_count,
                               f"{category}: Redis 8 ({redis8_count}) should have >= Redis 7 ({redis7_count})")

    @given(st.lists(st.sampled_from(['~*', '~cache:*', '~user:*', '~session:*']),
                    min_size=1, max_size=3))
    @settings(max_examples=50, deadline=None)
    def test_key_patterns_do_not_affect_command_grants(self, patterns):
        """Property: Key patterns should not affect which commands are granted."""
        rule_without_keys = '+@all'
        rule_with_keys = '+@all ' + ' '.join(patterns)

        without_data = self.parse_rule(rule_without_keys)
        with_keys_data = self.parse_rule(rule_with_keys)

        if not without_data or not with_keys_data:
            return

        # Key patterns don't affect command permissions
        self.assertEqual(
            set(without_data.get('granted_commands', [])),
            set(with_keys_data.get('granted_commands', [])),
            "Key patterns should not affect command grants"
        )

    @given(st.lists(st.sampled_from(['+@read', '+@write', '+get', '+set', '-del', '-@admin']),
                    min_size=3, max_size=8))
    @settings(max_examples=100, deadline=None)
    def test_redundancy_detection_is_idempotent(self, tokens):
        """Property: Running redundancy analysis twice should give same result."""
        rule = ' '.join(tokens)

        response1 = self.client.post('/api/analyze-redundancy', json={'rule': rule, 'version': 'redis7'})
        response2 = self.client.post('/api/analyze-redundancy', json={'rule': rule, 'version': 'redis7'})

        if response1.status_code != 200 or response2.status_code != 200:
            return

        data1 = json.loads(response1.data)
        data2 = json.loads(response2.data)

        # Results should be identical
        self.assertEqual(
            data1.get('analysis', {}).get('has_redundancy'),
            data2.get('analysis', {}).get('has_redundancy'),
            "Redundancy detection is not idempotent"
        )

    @given(st.lists(st.sampled_from(['+@read', '+@write', '+@admin', '-@read', '-@write', '-@admin']),
                    min_size=2, max_size=6))
    @settings(max_examples=100, deadline=None)
    def test_command_testing_consistent_with_parse(self, tokens):
        """Property: If parse says command is granted, test-command should agree."""
        rule = ' '.join(tokens)

        # Parse to get granted commands
        parse_data = self.parse_rule(rule)
        if not parse_data or not parse_data.get('success'):
            return

        granted_commands = set(parse_data.get('granted_commands', []))

        if not granted_commands:
            return

        # Pick first granted command and test it
        test_command = list(granted_commands)[0].upper()

        test_response = self.client.post('/api/test-command', json={
            'rule': rule,
            'command': test_command,
            'version': 'redis7'
        })

        if test_response.status_code != 200:
            return

        test_data = json.loads(test_response.data)

        # If parse says it's granted, test-command should agree
        self.assertTrue(test_data.get('is_granted', False),
                       f"Parse said {test_command} is granted but test-command disagrees\nRule: {rule}")

    @given(st.sampled_from(['GET', 'SET', 'DEL', 'LPUSH', 'HGET']))
    @settings(max_examples=20, deadline=None)
    def test_command_info_always_returns_categories(self, command):
        """Property: Command info should always return categories for valid commands."""
        response = self.client.post('/api/command-info', json={'command': command, 'version': 'redis7'})

        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertGreater(len(data.get('categories', [])), 0,
                          f"{command} should belong to at least one category")

    @given(st.text(alphabet='abcdefghijklmnopqrstuvwxyz', min_size=1, max_size=10))
    @settings(max_examples=100, deadline=None)
    def test_search_returns_results_for_any_pattern(self, pattern):
        """Property: Search should never crash and should return structured results."""
        response = self.client.post('/api/search-commands', json={
            'pattern': pattern,
            'version': 'redis7'
        })

        # Should never crash
        self.assertNotEqual(response.status_code, 500)

        if response.status_code == 200:
            data = json.loads(response.data)
            self.assertTrue(data.get('success'))
            self.assertIn('results', data)
            self.assertIsInstance(data['results'], list)


if __name__ == '__main__':
    unittest.main()
