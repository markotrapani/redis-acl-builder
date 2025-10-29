"""
Keyspace pattern optimization logic for Redis ACL rules.

This module provides functionality to analyze and optimize Redis keyspace
patterns (~patterns) in ACL rules by detecting redundant patterns that can be
simplified.
"""

import re
import random
import string
from typing import List, Dict, Set, Tuple


class PatternOptimizer:
    """Analyzes and optimizes Redis keyspace patterns."""

    # Redis glob pattern special characters
    GLOB_CHARS = {'*', '?', '[', ']', '\\'}

    @staticmethod
    def is_universal_pattern(pattern: str) -> bool:
        """
        Check if pattern matches all keys.

        Args:
            pattern: Redis glob pattern

        Returns:
            True if pattern is universal (*), False otherwise
        """
        return pattern == '*'

    @staticmethod
    def glob_to_regex(pattern: str) -> str:
        """
        Convert Redis glob pattern to Python regex.

        Redis glob patterns support:
        - * matches any sequence of characters
        - ? matches any single character
        - [abc] matches any character in the set
        - [a-z] matches any character in the range
        - [^abc] matches any character NOT in the set
        - \* matches literal asterisk (escaped)

        Args:
            pattern: Redis glob pattern string

        Returns:
            Python regex pattern string
        """
        regex = ''
        i = 0
        while i < len(pattern):
            char = pattern[i]

            if char == '\\' and i + 1 < len(pattern):
                # Escaped character - match literally
                next_char = pattern[i + 1]
                regex += re.escape(next_char)
                i += 2
            elif char == '*':
                # Match any sequence
                regex += '.*'
                i += 1
            elif char == '?':
                # Match single character
                regex += '.'
                i += 1
            elif char == '[':
                # Character class - find matching ]
                end = pattern.find(']', i + 1)
                if end == -1:
                    # Invalid pattern - treat [ as literal
                    regex += re.escape(char)
                    i += 1
                else:
                    # Include the character class as-is
                    char_class = pattern[i:end + 1]
                    regex += char_class
                    i = end + 1
            else:
                # Regular character - escape for regex
                regex += re.escape(char)
                i += 1

        return f'^{regex}$'

    @staticmethod
    def _generate_sample_keys(pattern: str, count: int) -> List[str]:
        """
        Generate sample keys that match the given pattern.

        Simplified implementation for common cases.

        Args:
            pattern: Redis glob pattern
            count: Number of sample keys to generate

        Returns:
            List of sample key strings
        """
        keys = []

        if pattern == '*':
            # Generate random keys
            for _ in range(count):
                length = random.randint(1, 20)
                key = ''.join(
                    random.choices(
                        string.ascii_letters + string.digits + ':-_',
                        k=length
                    )
                )
                keys.append(key)
        elif '*' in pattern and pattern.count('*') == 1:
            # Simple wildcard pattern
            parts = pattern.split('*')
            prefix = parts[0]
            suffix = parts[1] if len(parts) > 1 else ''

            for _ in range(count):
                middle_length = random.randint(0, 10)
                middle = ''.join(
                    random.choices(
                        string.ascii_letters + string.digits,
                        k=middle_length
                    )
                )
                keys.append(f"{prefix}{middle}{suffix}")
        else:
            # Complex pattern - generate variations
            # For MVP, return the pattern itself as a sample
            keys = [pattern]

        return keys

    @staticmethod
    def pattern_makes_redundant(
        broader: str,
        specific: str,
        sample_size: int = 1000
    ) -> bool:
        """
        Check if broader pattern makes specific pattern redundant.

        Uses heuristic approach:
        1. Universal pattern (*) makes everything redundant
        2. If broader is prefix of specific, broader likely covers it
        3. Generate sample keys matching specific pattern and test against
           broader pattern

        Args:
            broader: Potentially broader pattern
            specific: Potentially redundant pattern
            sample_size: Number of sample keys to test (default: 1000)

        Returns:
            True if broader makes specific redundant, False otherwise
        """
        # Universal pattern makes everything redundant
        if PatternOptimizer.is_universal_pattern(broader):
            return True

        # If patterns are identical, neither makes the other redundant
        if broader == specific:
            return False

        # Convert to regex
        try:
            broader_regex = re.compile(
                PatternOptimizer.glob_to_regex(broader)
            )
            specific_regex = re.compile(
                PatternOptimizer.glob_to_regex(specific)
            )
        except re.error:
            # Invalid regex - can't determine redundancy
            return False

        # Heuristic 1: Prefix matching (most common case)
        # Example: abc* makes abc:123* redundant
        if '*' in broader and '*' in specific:
            broader_prefix = broader.split('*')[0]
            specific_prefix = specific.split('*')[0]
            if specific_prefix.startswith(broader_prefix):
                # Broader prefix likely covers specific
                return True

        # Heuristic 2: Sample-based testing
        # Generate keys that match specific pattern and test against broader
        sample_keys = PatternOptimizer._generate_sample_keys(
            specific,
            sample_size
        )
        matches = sum(1 for key in sample_keys if broader_regex.match(key))

        # If broader matches 95%+ of specific's keys, consider it redundant
        threshold = 0.95
        return (matches / len(sample_keys)) >= threshold

    @staticmethod
    def optimize_patterns(patterns: List[str]) -> Dict:
        """
        Optimize a list of keyspace patterns.

        Args:
            patterns: List of keyspace patterns (without ~ prefix)

        Returns:
            Dictionary with optimization results:
            {
                'original': [...],
                'optimized': [...],
                'redundancies': [
                    {
                        'pattern': 'abc:123:*',
                        'made_redundant_by': 'abc:*'
                    },
                    ...
                ],
                'savings': 2  # number of patterns eliminated
            }
        """
        if not patterns:
            return {
                'original': [],
                'optimized': [],
                'redundancies': [],
                'savings': 0
            }

        # Check for universal pattern
        if '*' in patterns:
            return {
                'original': patterns,
                'optimized': ['*'],
                'redundancies': [
                    {
                        'pattern': p,
                        'made_redundant_by': '*'
                    }
                    for p in patterns if p != '*'
                ],
                'savings': len(patterns) - 1
            }

        redundancies = []
        redundant_patterns = set()

        # Check each pattern against all others
        for i, pattern1 in enumerate(patterns):
            if pattern1 in redundant_patterns:
                continue

            for j, pattern2 in enumerate(patterns):
                if i == j or pattern2 in redundant_patterns:
                    continue

                # Check if pattern1 makes pattern2 redundant
                if PatternOptimizer.pattern_makes_redundant(pattern1, pattern2):
                    redundancies.append({
                        'pattern': pattern2,
                        'made_redundant_by': pattern1
                    })
                    redundant_patterns.add(pattern2)

        # Build optimized list
        optimized = [p for p in patterns if p not in redundant_patterns]

        return {
            'original': patterns,
            'optimized': optimized,
            'redundancies': redundancies,
            'savings': len(patterns) - len(optimized)
        }
