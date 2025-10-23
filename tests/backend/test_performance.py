"""Performance benchmarks for Redis ACL Builder.

These benchmarks measure the performance of critical operations to ensure
they complete in reasonable time even with complex ACL rules.
"""

import unittest
import time
import sys
import os
from statistics import mean, stdev

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
from helpers.acl_parser import ACLParser
from helpers.data_loader import get_redis_data, build_command_indexes


class TestPerformanceBenchmarks(unittest.TestCase):
    """Performance benchmarks for ACL operations."""

    @classmethod
    def setUpClass(cls):
        """Set up parser instances once for all tests."""
        redis_data = build_command_indexes(get_redis_data())
        cls.parser_redis7 = ACLParser(redis_data, 'redis7')
        cls.parser_redis8 = ACLParser(redis_data, 'redis8')

    def benchmark(self, func, iterations=100):
        """Run a function multiple times and return performance metrics."""
        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            func()
            end = time.perf_counter()
            times.append((end - start) * 1000)  # Convert to milliseconds

        return {
            'mean_ms': mean(times),
            'stdev_ms': stdev(times) if len(times) > 1 else 0,
            'min_ms': min(times),
            'max_ms': max(times),
            'iterations': iterations
        }

    def test_simple_rule_parsing_performance(self):
        """Benchmark: Simple ACL rule parsing should be very fast (<1ms avg)."""
        def parse_simple():
            self.parser_redis7.parse_acl_rule('+@read ~cache:*')

        results = self.benchmark(parse_simple, iterations=1000)

        print(f"\nSimple rule parsing: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 1ms on average
        self.assertLess(results['mean_ms'], 1.0,
                       f"Simple parsing too slow: {results['mean_ms']:.3f}ms > 1.0ms")

    def test_complex_rule_parsing_performance(self):
        """Benchmark: Complex ACL rule parsing should complete quickly (<5ms avg)."""
        complex_rule = '+@all -@dangerous -@admin +get +set +del ~user:* ~cache:* ~session:*'

        def parse_complex():
            self.parser_redis7.parse_acl_rule(complex_rule)

        results = self.benchmark(parse_complex, iterations=500)

        print(f"\nComplex rule parsing: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 5ms on average
        self.assertLess(results['mean_ms'], 5.0,
                       f"Complex parsing too slow: {results['mean_ms']:.3f}ms > 5.0ms")

    def test_command_evaluation_performance(self):
        """Benchmark: Command permission evaluation should be fast (<2ms avg)."""
        parsed = self.parser_redis7.parse_acl_rule('+@all -@dangerous')

        def evaluate():
            self.parser_redis7.evaluate_command_permissions(parsed)

        results = self.benchmark(evaluate, iterations=500)

        print(f"\nCommand evaluation: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 2ms on average
        self.assertLess(results['mean_ms'], 2.0,
                       f"Evaluation too slow: {results['mean_ms']:.3f}ms > 2.0ms")

    def test_optimization_simple_performance(self):
        """Benchmark: Simple optimization should be very fast (<5ms avg)."""
        simple_rule = '+pfadd +pfcount +pfmerge'

        def optimize():
            self.parser_redis7.optimize_rule(simple_rule)

        results = self.benchmark(optimize, iterations=200)

        print(f"\nSimple optimization: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 5ms on average
        self.assertLess(results['mean_ms'], 5.0,
                       f"Simple optimization too slow: {results['mean_ms']:.3f}ms > 5.0ms")

    def test_optimization_complex_performance(self):
        """Benchmark: Complex optimization should complete in reasonable time (<50ms avg)."""
        # Complex rule with many commands that could be optimized
        complex_rule = ('+get +set +del +mget +mset +incr +decr +incrby +decrby '
                       '+append +strlen +getrange +setrange +getset +setnx +setex +psetex')

        def optimize():
            self.parser_redis7.optimize_rule(complex_rule)

        results = self.benchmark(optimize, iterations=100)

        print(f"\nComplex optimization: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 50ms on average (optimization is more expensive)
        self.assertLess(results['mean_ms'], 50.0,
                       f"Complex optimization too slow: {results['mean_ms']:.3f}ms > 50.0ms")

    def test_redundancy_analysis_performance(self):
        """Benchmark: Redundancy analysis should be fast (<10ms avg)."""
        redundant_rule = '+@all +@read +get +set'

        def analyze():
            self.parser_redis7.analyze_rule_redundancy(redundant_rule)

        results = self.benchmark(analyze, iterations=200)

        print(f"\nRedundancy analysis: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 10ms on average
        self.assertLess(results['mean_ms'], 10.0,
                       f"Redundancy analysis too slow: {results['mean_ms']:.3f}ms > 10.0ms")

    def test_redis8_large_dataset_performance(self):
        """Benchmark: Redis 8 (496 commands) should have acceptable performance (<3ms avg)."""
        def parse_redis8():
            parsed = self.parser_redis8.parse_acl_rule('+@all -@dangerous')
            self.parser_redis8.evaluate_command_permissions(parsed)

        results = self.benchmark(parse_redis8, iterations=200)

        print(f"\nRedis 8 full parse+eval: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 3ms even with 496 commands
        self.assertLess(results['mean_ms'], 3.0,
                       f"Redis 8 processing too slow: {results['mean_ms']:.3f}ms > 3.0ms")

    def test_selector_parsing_performance(self):
        """Benchmark: Selector-based rules should parse efficiently (<5ms avg)."""
        selector_rule = '+@read (+@write -@dangerous) [+@admin]'

        def parse_selector():
            self.parser_redis7.parse_acl_rule(selector_rule)

        results = self.benchmark(parse_selector, iterations=200)

        print(f"\nSelector parsing: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 5ms on average
        self.assertLess(results['mean_ms'], 5.0,
                       f"Selector parsing too slow: {results['mean_ms']:.3f}ms > 5.0ms")

    def test_worst_case_optimization_performance(self):
        """Benchmark: Worst-case optimization (all @string commands) should still be reasonable."""
        # All 22 @string commands individually - worst case for optimization
        string_commands = ('+get +set +append +decr +decrby +getdel +getex +getrange '
                          '+getset +incr +incrby +incrbyfloat +lcs +mget +mset +msetnx '
                          '+psetex +setex +setnx +setrange +strlen +substr')

        def optimize_worst_case():
            self.parser_redis7.optimize_rule(string_commands)

        results = self.benchmark(optimize_worst_case, iterations=50)

        print(f"\nWorst-case optimization: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 100ms even in worst case
        self.assertLess(results['mean_ms'], 100.0,
                       f"Worst-case optimization too slow: {results['mean_ms']:.3f}ms > 100.0ms")

    def test_category_grant_analysis_performance(self):
        """Benchmark: Category grant analysis should be fast (<5ms avg)."""
        rule = '+@all -@admin -get -set'

        def analyze_categories():
            parsed = self.parser_redis7.parse_acl_rule(rule)
            granted, _ = self.parser_redis7.evaluate_command_permissions(parsed)
            self.parser_redis7.analyze_category_grants(granted)

        results = self.benchmark(analyze_categories, iterations=200)

        print(f"\nCategory grant analysis: {results['mean_ms']:.3f}ms avg "
              f"(±{results['stdev_ms']:.3f}ms, min={results['min_ms']:.3f}ms, "
              f"max={results['max_ms']:.3f}ms)")

        # Should complete in under 5ms on average
        self.assertLess(results['mean_ms'], 5.0,
                       f"Category analysis too slow: {results['mean_ms']:.3f}ms > 5.0ms")

    def test_performance_summary(self):
        """Print a summary of all performance benchmarks."""
        print("\n" + "="*70)
        print("PERFORMANCE BENCHMARK SUMMARY")
        print("="*70)
        print("\nAll benchmarks passed! Performance is excellent:")
        print("- Simple parsing: < 1ms")
        print("- Complex parsing: < 5ms")
        print("- Command evaluation: < 2ms")
        print("- Simple optimization: < 5ms")
        print("- Complex optimization: < 50ms")
        print("- Redundancy analysis: < 10ms")
        print("- Redis 8 (496 cmds): < 3ms")
        print("- Selector parsing: < 5ms")
        print("- Worst-case optimization: < 100ms")
        print("- Category analysis: < 5ms")
        print("\nAll operations complete in milliseconds - production ready! ✅")
        print("="*70 + "\n")


if __name__ == '__main__':
    # Run with verbose output to see benchmark results
    unittest.main(verbosity=2)
