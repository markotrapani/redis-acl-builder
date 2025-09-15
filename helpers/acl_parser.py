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
            command: Command name to test (can use spaces like "acl cat")
            parsed_rule: Output from parse_acl_rule()
            
        Returns:
            Tuple of (is_granted, explanation, categories)
                is_granted: Boolean indicating if command is allowed
                explanation: String explaining why command was granted/denied
                categories: List of categories this command belongs to
        """
        granted, explanations = self.evaluate_command_permissions(parsed_rule)
        
        command_lower = command.lower()
        # Convert space notation to pipe notation for internal lookup (e.g., "acl cat" -> "acl|cat")
        command_internal = command_lower.replace(' ', '|')
        
        # Check both formats in case command exists in either form
        is_granted = command_internal in granted or command_lower in granted
        categories = self.get_command_categories(command)
        
        # Look for explanation in both formats
        explanation = None
        if command_internal in explanations:
            explanation = explanations[command_internal]
        elif command_lower in explanations:
            explanation = explanations[command_lower]
        else:
            # Check if command exists in either format
            if command_internal in self.data['commands'] or command_lower in self.data['commands']:
                explanation = "Command exists but not granted by current ACL rule"
            else:
                # Format version number nicely (e.g., "redis7" -> "Redis 7")
                version_display = self.redis_version.replace('redis', 'Redis ') if 'redis' in self.redis_version else self.redis_version
                explanation = f"Command '{command}' not found in {version_display}. Please check the command spelling."
        
        return is_granted, explanation, categories
    
    def get_command_categories(self, command: str) -> List[str]:
        """
        Get categories that a command belongs to.
        
        Args:
            command: Command name (can use spaces like "acl cat")
            
        Returns:
            List of category names this command belongs to
        """
        command_lower = command.lower()
        # Convert space notation to pipe notation for internal lookup (e.g., "acl cat" -> "acl|cat")
        command_internal = command_lower.replace(' ', '|')
        
        # Check both formats
        categories = self.data['commands'].get(command_internal, [])
        if not categories:
            categories = self.data['commands'].get(command_lower, [])
        
        return categories
    
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
                
                # Update cumulative sets
                cumulative_granted.difference_update(rule_commands)
                cumulative_denied.update(rule_commands)
            
            i += 1
        
        # Priority-based optimization: Check for -@all first (highest priority)
        tokens = parsed['raw_rule'].strip().split()
        all_deny_index = -1
        optimization_applied = False
        
        # Find the position of the LAST -@all in the token list (rightmost takes precedence)
        for idx, token in enumerate(tokens):
            if token == '-@all':
                all_deny_index = idx  # Keep updating to find the last occurrence
        
        # If -@all is found, it takes priority over other optimizations
        if all_deny_index >= 0:
            optimization_applied = True
            preceding_tokens = tokens[:all_deny_index]
            # Consider all command/category tokens (both + and - since -@all overrides everything)
            preceding_cmd_tokens = [t for t in preceding_tokens if t.startswith(('+', '-')) and not t.startswith('~')]
            
            if preceding_cmd_tokens:
                warnings.append(f"Inefficient rule structure: '-@all' blocks all commands, making all preceding command terms meaningless\nPreceding terms made meaningless: {', '.join(preceding_cmd_tokens)}")
                
                # Mark each preceding command token as redundant
                for token in preceding_cmd_tokens:
                    redundant_terms.append({
                        'term': token,
                        'position': tokens.index(token),
                        'type': 'meaningless',
                        'reason': f"Made meaningless by '-@all' which blocks all commands"
                    })
            
            # Check if we should also remove -@all itself based on what follows
            following_tokens = tokens[all_deny_index + 1:]
            key_tokens = [t for t in following_tokens if t.startswith('~')]
            following_cmd_tokens = [t for t in following_tokens if t.startswith(('+', '-')) and not t.startswith('~')]
            
            if not key_tokens and not following_cmd_tokens:
                # No key patterns or commands after -@all, so -@all results in empty rule (Redis default)
                warnings.append("Rule results in no permissions (Redis default behavior)")
                redundant_terms.append({
                    'term': '-@all',
                    'position': all_deny_index,
                    'type': 'results_in_default',
                    'reason': "Results in empty rule which is Redis default (no permissions)"
                })
                # Don't add separate suggestion - let simplified rule section handle this
            elif following_cmd_tokens:
                # There are command terms after -@all
                # The -@all becomes redundant because subsequent inclusions will override it
                # Final result is just the following commands + any key patterns
                warnings.append("The '-@all' term is redundant when followed by inclusion commands")
                redundant_terms.append({
                    'term': '-@all',
                    'position': all_deny_index,
                    'type': 'overridden',
                    'reason': "Made redundant by subsequent inclusion commands which override the denial"
                })
            elif not following_cmd_tokens and key_tokens:
                # Only key patterns after -@all
                # Since -@all blocks all commands and only key patterns remain, 
                # the -@all itself becomes redundant (no commands to block)
                redundant_terms.append({
                    'term': '-@all',
                    'position': all_deny_index,
                    'type': 'meaningless_with_keys_only',
                    'reason': "Blocking all commands is redundant when only key patterns remain"
                })
        
        # Only run other optimizations if -@all optimization wasn't applied
        if not optimization_applied:
            # Check for inclusion superset patterns
            cumulative_granted_by_position = []
            temp_cumulative = set()
            
            # Build cumulative granted sets for each position
            for idx, token in enumerate(tokens):
                if token.startswith('+') and not token.startswith('~'):
                    if token == '+@all':
                        all_commands = set()
                        for cat_commands in self.data['categories'].values():
                            all_commands.update(cat_commands)
                        temp_cumulative.update(all_commands)
                    elif token.startswith('+@'):
                        category = token[2:].lower()
                        if category in self.data['categories']:
                            temp_cumulative.update(self.data['categories'][category])
                    elif token.startswith('+'):
                        command = token[1:].lower()
                        if command in self.data['commands']:
                            temp_cumulative.add(command)
                
                cumulative_granted_by_position.append(temp_cumulative.copy())
            
            # Look for inclusion superset patterns
            for idx, token in enumerate(tokens):
                if token.startswith('+') and not token.startswith('~') and idx > 0:
                    current_commands = set()
                    
                    if token == '+@all':
                        for cat_commands in self.data['categories'].values():
                            current_commands.update(cat_commands)
                    elif token.startswith('+@'):
                        category = token[2:].lower()
                        if category in self.data['categories']:
                            current_commands.update(self.data['categories'][category])
                    elif token.startswith('+'):
                        command = token[1:].lower()
                        if command in self.data['commands']:
                            current_commands.add(command)
                    
                    if not current_commands:
                        continue
                    
                    preceding_granted = cumulative_granted_by_position[idx - 1] if idx > 0 else set()
                    preceding_inclusion_tokens = [tokens[i] for i in range(idx) if tokens[i].startswith('+') and not tokens[i].startswith('~')]
                    
                    if preceding_inclusion_tokens and preceding_granted.issubset(current_commands):
                        warnings.append(f"Inefficient rule structure: '{token}' grants all commands from preceding inclusion terms\nPreceding terms made redundant: {', '.join(preceding_inclusion_tokens)}")
                        
                        for redundant_token in preceding_inclusion_tokens:
                            redundant_terms.append({
                                'term': redundant_token,
                                'position': tokens.index(redundant_token),
                                'type': 'superseded',
                                'reason': f"Made redundant by '{token}' which grants a superset of commands"
                            })
                        optimization_applied = True
                        break
            
            # Look for exclusion superset patterns (only if no inclusion superset found)
            if not optimization_applied:
                for idx, token in enumerate(tokens):
                    if token.startswith('-') and not token.startswith('~') and idx > 0 and token != '-@all':
                        current_blocked = set()
                        
                        if token.startswith('-@'):
                            category = token[2:].lower()
                            if category in self.data['categories']:
                                current_blocked.update(self.data['categories'][category])
                        elif token.startswith('-'):
                            command = token[1:].lower()
                            if command in self.data['commands']:
                                current_blocked.add(command)
                        
                        if not current_blocked:
                            continue
                        
                        preceding_exclusion_tokens = []
                        preceding_blocked = set()
                        
                        for i in range(idx):
                            if tokens[i].startswith('-') and not tokens[i].startswith('~') and tokens[i] != '-@all':
                                preceding_exclusion_tokens.append(tokens[i])
                                
                                if tokens[i].startswith('-@'):
                                    category = tokens[i][2:].lower()
                                    if category in self.data['categories']:
                                        preceding_blocked.update(self.data['categories'][category])
                                elif tokens[i].startswith('-'):
                                    command = tokens[i][1:].lower()
                                    if command in self.data['commands']:
                                        preceding_blocked.add(command)
                        
                        if preceding_exclusion_tokens and preceding_blocked.issubset(current_blocked):
                            warnings.append(f"Inefficient rule structure: '{token}' blocks all commands from preceding exclusion terms\nPreceding exclusion terms made redundant: {', '.join(preceding_exclusion_tokens)}")
                            
                            for redundant_token in preceding_exclusion_tokens:
                                redundant_terms.append({
                                    'term': redundant_token,
                                    'position': tokens.index(redundant_token),
                                    'type': 'superseded_exclusion',
                                    'reason': f"Made redundant by '{token}' which blocks a superset of commands"
                                })
                            break
        
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
            
        # Category completion analysis - detect when individual commands cover entire categories
        self._analyze_category_completion(parsed, warnings, suggestions)

        return {
            'warnings': warnings,
            'suggestions': suggestions,
            'redundant_terms': redundant_terms,
            'has_redundancy': len(redundant_terms) > 0 or len(warnings) > 0
        }

    def _analyze_category_completion(self, parsed_rule: Dict[str, Any], warnings: List[str], suggestions: List[str]):
        """
        Analyze if individual commands granted cover entire categories.

        Args:
            parsed_rule: Parsed ACL rule structure
            warnings: List to append warnings to
            suggestions: List to append suggestions to
        """
        try:
            # Get the actual command permissions from the rule
            granted_commands, _ = self.evaluate_command_permissions(parsed_rule)

            # Group granted commands by their categories
            category_coverage = {}
            for command in granted_commands:
                categories = self.get_command_categories(command)
                for category in categories:
                    if category not in category_coverage:
                        category_coverage[category] = set()
                    category_coverage[category].add(command)

            # Check each category for completion
            completed_categories = []
            for category, granted_in_category in category_coverage.items():
                if category in self.data['categories']:
                    all_commands_in_category = set(self.data['categories'][category])

                    # Check if we have all commands in this category
                    if granted_in_category == all_commands_in_category:
                        completed_categories.append((category, len(all_commands_in_category)))

            # Generate suggestions for completed categories
            if completed_categories:
                for category, command_count in completed_categories:
                    # Check if the category is already explicitly granted in the rule
                    category_explicitly_granted = False
                    for rule in parsed_rule['command_rules']:
                        if (rule['type'] == 'allow' and
                            rule['target'] == 'category' and
                            rule['value'] == category):
                            category_explicitly_granted = True
                            break

                    if not category_explicitly_granted:
                        warnings.append(f"Individual commands cover entire @{category} category ({command_count} commands)")

                        # Generate optimized rule for clickable suggestion
                        optimized_rule = self._generate_optimized_rule_for_category(parsed_rule, category)

                        # Add suggestion in the existing clickable format
                        suggestions.append(f"Simplified rule: {optimized_rule}")

        except Exception as e:
            # Don't let category analysis errors break the main redundancy analysis
            pass

    def _generate_optimized_rule_for_category(self, parsed_rule: Dict[str, Any], category: str) -> str:
        """
        Generate an optimized rule that replaces individual commands with a category.

        Args:
            parsed_rule: Parsed ACL rule structure
            category: Category to consolidate (e.g., 'bitmap')

        Returns:
            Optimized rule string
        """
        try:
            # Get original rule tokens
            original_tokens = parsed_rule['raw_rule'].strip().split()

            # Get commands in this category
            category_commands = set(self.data['categories'].get(category, []))

            # Build new rule tokens
            new_tokens = []
            skip_tokens = set()

            # Mark individual commands from this category to be removed
            for token in original_tokens:
                if token.startswith('+') and not token.startswith('+@'):
                    command = token[1:].lower()
                    if command in category_commands:
                        skip_tokens.add(token)

            # Add tokens that aren't being replaced
            for token in original_tokens:
                if token not in skip_tokens:
                    new_tokens.append(token)

            # Add the category token
            new_tokens.append(f'+@{category}')

            return ' '.join(new_tokens)

        except Exception:
            # If optimization fails, return original rule
            return parsed_rule['raw_rule']