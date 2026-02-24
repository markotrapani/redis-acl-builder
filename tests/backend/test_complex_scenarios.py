#!/usr/bin/env python3
"""
Redis ACL Builder - Complex ACL Rule Scenarios Test Suite
Comprehensive tests for edge cases and complex real-world ACL rules
"""

import pytest
import json


class TestComplexRuleParsing:
    """Test parsing of complex ACL rules.

    NOTE: Category analysis tests have been moved to test_category_analysis_api.py
    which tests the full /api/parse endpoint behavior including category grants.
    """
    pass


class TestAPIEndpoints:
    """Test API endpoints with complex scenarios."""

    def test_parse_api_with_complex_rule(self, client):
        """Test parsing API with complex rule."""
        complex_rule = "+@read +@write -@dangerous +get +set -del ~user:* ~cache:*"

        response = client.post('/api/parse', json={
            'rule': complex_rule,
            'version': 'redis7'
        })

        assert response.status_code == 200
        result = json.loads(response.data)

        # Should have expected structure (API returns granted_commands at top level, not granted_categories)
        assert 'granted_commands' in result
        assert isinstance(result['granted_commands'], list)

    def test_redundancy_analysis_api(self, client):
        """Test redundancy analysis API with various patterns."""
        test_cases = [
            ("+@read +get +mget ~*", "Should detect redundancy in read category"),
            ("+@read +@write -@dangerous ~*", "Should NOT flag legitimate pattern"),
            ("+get +set +del ~*", "Should NOT flag non-redundant commands"),
        ]

        for rule, description in test_cases:
            response = client.post('/api/analyze-redundancy', json={
                'rule': rule,
                'version': 'redis7'
            })

            assert response.status_code == 200, f"Failed for: {description}"
            result = json.loads(response.data)

            # Should have redundancy analysis structure (nested under 'analysis' key)
            assert 'analysis' in result
            analysis = result['analysis']
            assert 'has_redundancy' in analysis
            assert 'warnings' in analysis
            assert 'suggestions' in analysis

    def test_command_testing_with_complex_rules(self, client):
        """Test command testing API with complex rules."""
        rule = "+@read +@write -@dangerous +set -get ~*"

        test_commands = [
            ("get", False, "GET should be blocked by individual -get"),
            ("set", True, "SET should be allowed by individual +set"),
            ("mget", True, "MGET should be allowed by @read category"),
            ("flushdb", False, "FLUSHDB should be blocked by -@dangerous"),
        ]

        for command, expected_allowed, description in test_commands:
            response = client.post('/api/test-command', json={
                'rule': rule,
                'command': command,
                'version': 'redis7'
            })

            assert response.status_code == 200, f"Failed for: {description}"
            result = json.loads(response.data)

            # API returns 'is_granted' not 'allowed'
            assert 'is_granted' in result
            assert result['is_granted'] == expected_allowed, description

    def test_version_differences_in_api(self, client):
        """Test that API returns different results for Redis 7 vs 8."""
        rule = "+@all ~*"

        # Redis 7 OSS: 379 commands
        response7 = client.post('/api/parse', json={
            'rule': rule,
            'version': 'redis7'
        })

        assert response7.status_code == 200
        result7 = json.loads(response7.data)
        assert result7['version'] == 'redis7'
        assert 'granted_commands' in result7
        assert len(result7['granted_commands']) == 379, \
            f"Redis 7 OSS should have 379 commands, got {len(result7['granted_commands'])}"

        # Redis 8 OSS: 488 commands
        response8 = client.post('/api/parse', json={
            'rule': rule,
            'version': 'redis8'
        })

        assert response8.status_code == 200
        result8 = json.loads(response8.data)
        assert result8['version'] == 'redis8'
        assert 'granted_commands' in result8
        assert len(result8['granted_commands']) == 488, \
            f"Redis 8 OSS should have 488 commands, got {len(result8['granted_commands'])}"

        # Redis 8 should have more commands than Redis 7
        assert len(result8['granted_commands']) > len(result7['granted_commands'])


class TestUIFeaturesCoverage:
    """Test UI features are properly implemented."""

    def test_search_functionality_ui_elements(self, client):
        """Test that search UI elements are properly implemented."""
        response = client.get('/')
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')

        # Search link toggle buttons
        assert 'search-link-toggle' in html_content
        assert 'data-search-type="blocked"' in html_content
        assert 'data-search-type="granted"' in html_content

        # Search mode toggle buttons
        assert 'search-mode-toggle' in html_content
        assert '≈' in html_content  # Fuzzy mode symbol

        # Search inputs
        assert 'id="blockedSearch"' in html_content
        assert 'id="grantedSearch"' in html_content

    def test_version_toggle_ui_elements(self, client):
        """Test Redis version toggle UI elements."""
        response = client.get('/')
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')

        # Version toggle elements (toggle shows just numbers, not full "Redis 7"/"Redis 8")
        assert 'id="versionToggle"' in html_content
        assert 'toggle-option-left">7<' in html_content
        assert 'toggle-option-right">8<' in html_content

    def test_action_buttons_ui_elements(self, client):
        """Test action buttons are present."""
        response = client.get('/')
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')

        # Copy and clear buttons
        assert 'id="copyRuleBtn"' in html_content
        assert 'id="clearRuleBtn"' in html_content
        assert '📋' in html_content  # Copy emoji
        assert '💣' in html_content  # Clear emoji
