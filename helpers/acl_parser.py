#!/usr/bin/env python3
"""
Redis ACL Parser - Parse and evaluate Redis ACL rules
"""

from typing import Dict, List, Set, Tuple, Any
import fnmatch
import re

class ACLParser:
    """Parse and evaluate Redis ACL rules."""
    
    def __init__(self, redis_data: Dict, redis_version: str = 'redis7'):
        """
        Initialize ACL parser with Redis data.
        
        Args:
            redis_data: Complete Redis command and category data
            redis_version: Redis version ('redis7' or 'redis8')
        """
        self.redis_version = redis_version
        self.data = redis_data[redis_version]
        
        if not self.data.get('commands'):
            raise ValueError(f"Command index not built for {redis_version}")
    
    def parse_acl_rule(self, rule: str) -> Dict[str, Any]:
        """
        Parse ACL rule into structured format.
        
        Args:
            rule: ACL rule string (e.g., "+@read -flushdb ~user:*")
            
        Returns:
            Parsed rule structure with command_rules and key_rules
        """
        parsed = {
            'command_rules': [],  # [{'type': 'allow/deny', 'target': 'command/category', 'value': str}]
            'key_rules': [],      # [{'type': 'allow/deny', 'pattern': str}]
            'raw_rule': rule.strip()
        }
        
        if not rule.strip():
            return parsed
        
        # Split by whitespace and process each token
        tokens = rule.strip().split()
        
        for token in tokens:
            token = token.strip()
            if not token:
                continue
                
            if token.startswith(('+', '-')):
                # Command/category rule
                action = 'allow' if token[0] == '+' else 'deny'
                target = token[1:]
                
                if target.startswith('@'):
                    # Category rule
                    category = target[1:].lower()
                    if category == 'all':
                        # Special case: +@all or -@all - apply to all categories
                        for cat in self.data['categories'].keys():
                            parsed['command_rules'].append({
                                'type': action,
                                'target': 'category',
                                'value': cat,
                                'original_token': token
                            })
                    elif category in self.data['categories']:
                        parsed['command_rules'].append({
                            'type': action,
                            'target': 'category',
                            'value': category,
                            'original_token': token
                        })
                    else:
                        # Invalid category - still record it for error reporting
                        parsed['command_rules'].append({
                            'type': action,
                            'target': 'category',
                            'value': category,
                            'original_token': token,
                            'error': f"Unknown category: {category}"
                        })
                else:
                    # Individual command rule
                    command = target.lower()
                    parsed['command_rules'].append({
                        'type': action,
                        'target': 'command',
                        'value': command,
                        'original_token': token
                    })
            
            elif token.startswith('~'):
                # Key pattern rule
                pattern = token[1:]
                parsed['key_rules'].append({
                    'type': 'allow',  # ~ always allows access to keys
                    'pattern': pattern,
                    'original_token': token
                })
        
        return parsed
    
    def evaluate_command_permissions(self, parsed_rule: Dict[str, Any]) -> Tuple[Set[str], Dict[str, str]]:
        """
        Evaluate which commands are granted by the ACL rule.
        
        Args:
            parsed_rule: Output from parse_acl_rule()
            
        Returns:
            Tuple of (granted_commands, explanations)
                granted_commands: Set of command names that are allowed
                explanations: Dict mapping command -> explanation string
        """
        # Start with empty permissions (Redis default is no access)
        # Empty ACL rule should block all commands
        if not parsed_rule['command_rules']:
            # No rules = block all commands
            granted = set()
            explanations = {}
            return granted, explanations
        
        granted = set()
        explanations = {}
        rule_history = {}  # Track which rule affected each command
        
        # Process command rules left-to-right (Redis precedence)
        for i, rule in enumerate(parsed_rule['command_rules']):
            if rule.get('error'):
                continue  # Skip invalid rules
                
            if rule['target'] == 'category':
                category = rule['value']
                if category in self.data['categories']:
                    category_commands = set(self.data['categories'][category])
                    
                    if rule['type'] == 'allow':
                        granted.update(category_commands)
                        for cmd in category_commands:
                            explanations[cmd] = f"Granted by {rule['original_token']}"
                            rule_history[cmd] = i
                    else:  # deny
                        granted.difference_update(category_commands)
                        for cmd in category_commands:
                            explanations[cmd] = f"Denied by {rule['original_token']}"
                            if cmd in rule_history:
                                explanations[cmd] += f" (overrides previous rule)"
                            rule_history[cmd] = i
            
            elif rule['target'] == 'command':
                command = rule['value']
                if rule['type'] == 'allow':
                    granted.add(command)
                    explanations[command] = f"Granted by {rule['original_token']}"
                    rule_history[command] = i
                else:  # deny
                    granted.discard(command)
                    explanation = f"Denied by {rule['original_token']}"
                    if command in rule_history:
                        explanation += f" (overrides previous rule)"
                    explanations[command] = explanation
                    rule_history[command] = i

        return granted, explanations
    
    def test_command_access(self, command: str, parsed_rule: Dict[str, Any]) -> Tuple[bool, str, List[str]]:
        """
        Test if a specific command is allowed by the ACL rule.
        
        Args:
            command: Command name to test
            parsed_rule: Output from parse_acl_rule()
            
        Returns:
            Tuple of (is_granted, explanation, categories)
                is_granted: Boolean indicating if command is allowed
                explanation: String explaining why command was granted/denied
                categories: List of categories this command belongs to
        """
        granted, explanations = self.evaluate_command_permissions(parsed_rule)
        
        command_lower = command.lower()
        is_granted = command_lower in granted
        categories = self.get_command_categories(command)
        
        if command_lower in explanations:
            explanation = explanations[command_lower]
        else:
            if command_lower in self.data['commands']:
                explanation = "Command exists but not granted by current ACL rule"
            else:
                explanation = f"Command '{command}' not found in {self.redis_version.upper()}"
        
        return is_granted, explanation, categories
    
    def get_command_categories(self, command: str) -> List[str]:
        """
        Get categories that a command belongs to.
        
        Args:
            command: Command name
            
        Returns:
            List of category names this command belongs to
        """
        command_lower = command.lower()
        return self.data['commands'].get(command_lower, [])
    
    def validate_rule_syntax(self, rule: str) -> Tuple[bool, List[str]]:
        """
        Validate ACL rule syntax and return any errors.
        
        Args:
            rule: ACL rule string
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        if not rule.strip():
            return True, []  # Empty rule is valid (means +@all)
        
        try:
            parsed = self.parse_acl_rule(rule)
            
            # Check for invalid categories
            for cmd_rule in parsed['command_rules']:
                if cmd_rule.get('error'):
                    errors.append(cmd_rule['error'])
            
            # Check for invalid commands (basic check)
            for cmd_rule in parsed['command_rules']:
                if (cmd_rule['target'] == 'command' and 
                    not cmd_rule.get('error') and
                    cmd_rule['value'] not in self.data['commands']):
                    errors.append(f"Unknown command: {cmd_rule['value']}")
            
        except Exception as e:
            errors.append(f"Rule parsing error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def get_category_info(self) -> Dict[str, int]:
        """
        Get information about available categories.
        
        Returns:
            Dict mapping category_name -> command_count
        """
        return {
            category: len(commands) 
            for category, commands in self.data['categories'].items()
        }
    
    def search_commands(self, pattern: str) -> List[str]:
        """
        Search for commands matching a pattern.
        
        Args:
            pattern: Search pattern (can use wildcards)
            
        Returns:
            List of matching command names
        """
        pattern = pattern.lower()
        if '*' in pattern or '?' in pattern:
            # Use fnmatch for wildcard patterns
            return [cmd for cmd in self.data['commands'].keys() 
                   if fnmatch.fnmatch(cmd, pattern)]
        else:
            # Simple substring search
            return [cmd for cmd in self.data['commands'].keys() 
                   if pattern in cmd]
    
    def get_rule_impact_summary(self, parsed_rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get a summary of how the rule impacts different categories.
        
        Args:
            parsed_rule: Output from parse_acl_rule()
            
        Returns:
            Summary dict with category impacts
        """
        granted, _ = self.evaluate_command_permissions(parsed_rule)
        
        category_impact = {}
        total_commands = len(self.data['commands'])
        
        for category, commands in self.data['categories'].items():
            granted_in_category = len([cmd for cmd in commands if cmd in granted])
            total_in_category = len(commands)
            
            category_impact[category] = {
                'granted': granted_in_category,
                'total': total_in_category,
                'percentage': round((granted_in_category / total_in_category) * 100, 1) if total_in_category > 0 else 0
            }
        
        return {
            'total_granted': len(granted),
            'total_commands': total_commands,
            'overall_percentage': round((len(granted) / total_commands) * 100, 1) if total_commands > 0 else 0,
            'category_impact': category_impact,
            'redis_version': self.redis_version
        }
    
    def analyze_rule_redundancy(self, rule):
        """
        Analyze an ACL rule for redundant terms and suggest optimizations.
        
        Args:
            rule (str): The ACL rule string to analyze
            
        Returns:
            dict: Analysis results with warnings and simplification suggestions
        """
        if not rule.strip():
            return {'warnings': [], 'suggestions': [], 'redundant_terms': []}
        
        try:
            parsed = self.parse_acl_rule(rule)
        except Exception as e:
            return {'warnings': [], 'suggestions': [], 'redundant_terms': [], 'error': str(e)}
        
        warnings = []
        suggestions = []
        redundant_terms = []
        
        # Track cumulative effects as we process left-to-right
        cumulative_granted = set()
        cumulative_denied = set()
        
        command_rules = parsed['command_rules']
        
        # Group rules by original token to handle @all expansion properly
        processed_tokens = set()
        
        i = 0
        while i < len(command_rules):
            current_rule = command_rules[i]
            
            if current_rule.get('error'):
                i += 1
                continue
                
            original_token = current_rule.get('original_token', f"{'+' if current_rule['type'] == 'allow' else '-'}{current_rule['value']}")
            
            # Skip if we already processed this token (handles @all expansion)
            if original_token in processed_tokens:
                i += 1
                continue
                
            processed_tokens.add(original_token)
            
            # For @all, collect all commands from the expanded rules with same token
            if original_token in ['+@all', '-@all']:
                rule_commands = set()
                # Collect all commands from rules with this token
                for rule in command_rules:
                    if rule.get('original_token') == original_token:
                        if rule['target'] == 'category' and rule['value'] in self.data['categories']:
                            rule_commands.update(self.data['categories'][rule['value']])
            else:
                # Regular rule processing
                if current_rule['target'] == 'category':
                    category = current_rule['value']
                    if category in self.data['categories']:
                        rule_commands = set(self.data['categories'][category])
                    else:
                        i += 1
                        continue
                elif current_rule['target'] == 'command':
                    command = current_rule['value'].lower()
                    if command in self.data['commands']:
                        rule_commands = {command}
                    else:
                        i += 1
                        continue
                else:
                    i += 1
                    continue
            
            # Check for redundancy based on rule type
            if current_rule['type'] == 'allow':
                # Check if these commands are already granted
                already_granted = rule_commands.intersection(cumulative_granted)
                if already_granted == rule_commands:
                    # All commands in this rule are already granted - completely redundant
                    warnings.append(f"Redundant inclusion: '{original_token}'\nAll commands already granted by earlier rules")
                    redundant_terms.append({
                        'term': original_token,
                        'position': i,
                        'type': 'inclusion',
                        'reason': 'All commands already granted by earlier rules'
                    })
                elif already_granted:
                    # Some commands already granted - partially redundant
                    warnings.append(f"Partially redundant inclusion: '{original_token}'\n{len(already_granted)}/{len(rule_commands)} commands already granted")
                
                # Update cumulative granted set
                cumulative_granted.update(rule_commands)
                cumulative_denied.difference_update(rule_commands)
                
            else:  # deny
                # Check if these commands are already denied
                not_granted = rule_commands - cumulative_granted
                already_denied = rule_commands.intersection(cumulative_denied)
                
                if not_granted == rule_commands:
                    # All commands weren't granted anyway - completely redundant
                    warnings.append(f"Redundant exclusion: '{original_token}'\nCommands were not granted by earlier rules")
                    redundant_terms.append({
                        'term': original_token,
                        'position': i,
                        'type': 'exclusion',
                        'reason': 'Commands were not granted by earlier rules'
                    })
                elif already_denied:
                    # Some commands already explicitly denied - partially redundant
                    warnings.append(f"Partially redundant exclusion: '{original_token}'\n{len(already_denied)}/{len(rule_commands)} commands already denied")
                
                # Update cumulative sets
                cumulative_granted.difference_update(rule_commands)
                cumulative_denied.update(rule_commands)
            
            i += 1
        
        # Generate simplification suggestions
        if redundant_terms:
            # Extract original tokens from the input rule string, preserving order
            tokens = parsed['raw_rule'].strip().split()
            redundant_token_set = {rt['term'] for rt in redundant_terms}
            
            # Keep only non-redundant tokens
            simplified_tokens = []
            for token in tokens:
                if token not in redundant_token_set:
                    simplified_tokens.append(token)
            
            if simplified_tokens:
                simplified_rule = ' '.join(simplified_tokens)
                suggestions.append(f"Simplified rule: {simplified_rule}")
            elif len(redundant_terms) > 0:
                # All terms are redundant - suggest empty rule
                suggestions.append("Simplified rule: (empty rule)")
            
        return {
            'warnings': warnings,
            'suggestions': suggestions,
            'redundant_terms': redundant_terms,
            'has_redundancy': len(redundant_terms) > 0 or len(warnings) > 0
        }