#!/usr/bin/env python3
"""
Redis ACL Parser - Parse and evaluate Redis ACL rules
"""

from typing import Dict, List, Set, Tuple, Any, Optional
import fnmatch
import re

class ACLParser:
    """Parse and evaluate Redis ACL rules."""

    # Command classification for key permission validation
    # These classify commands by their read/write behavior
    READ_COMMANDS = {
        'get', 'mget', 'strlen', 'getrange', 'getbit', 'hget', 'hmget',
        'hgetall', 'hkeys', 'hvals', 'hlen', 'hscan', 'lrange', 'lindex',
        'llen', 'lpos', 'scard', 'smembers', 'sismember', 'smismember',
        'srandmember', 'sscan', 'zrange', 'zrangebyscore', 'zrangebylex',
        'zrevrange', 'zrevrangebyscore', 'zrevrangebylex', 'zcard', 'zscore',
        'zrank', 'zrevrank', 'zcount', 'zlexcount', 'zscan', 'type', 'exists',
        'ttl', 'pttl', 'dump', 'scan', 'keys', 'randomkey', 'dbsize',
        'memory', 'object', 'touch', 'wait', 'geohash', 'geopos', 'geodist',
        'georadius', 'georadiusbymember', 'pfcount', 'bitcount', 'bitpos',
        'xlen', 'xrange', 'xrevrange', 'xread', 'xpending', 'xinfo'
    }

    WRITE_COMMANDS = {
        'set', 'setnx', 'setex', 'psetex', 'mset', 'msetnx', 'append',
        'setrange', 'setbit', 'incr', 'decr', 'incrby', 'decrby',
        'incrbyfloat', 'hset', 'hsetnx', 'hmset', 'hincrby', 'hincrbyfloat',
        'hdel', 'lpush', 'lpushx', 'rpush', 'rpushx', 'lpop', 'rpop',
        'lset', 'ltrim', 'lrem', 'linsert', 'blpop', 'brpop', 'brpoplpush',
        'sadd', 'srem', 'spop', 'smove', 'zadd', 'zrem', 'zincrby',
        'zremrangebyscore', 'zremrangebyrank', 'zremrangebylex', 'del',
        'unlink', 'expire', 'expireat', 'pexpire', 'pexpireat', 'persist',
        'rename', 'renamenx', 'move', 'copy', 'restore', 'sort', 'flushdb',
        'flushall', 'save', 'bgsave', 'bgrewriteaof', 'shutdown', 'geoadd',
        'georadius_ro', 'pfadd', 'pfmerge', 'bitop', 'bitfield',
        'xadd', 'xtrim', 'xdel', 'xack', 'xclaim', 'xgroup', 'xsetid'
    }

    READ_WRITE_COMMANDS = {
        'getset', 'getdel', 'getex', 'rpoplpush', 'lmove', 'blmove',
        'smove', 'zpopmin', 'zpopmax', 'bzpopmin', 'bzpopmax'
    }

    def __init__(self, redis_data: Dict, redis_version: str = 'redis7'):
        """
        Initialize ACL parser with Redis data.

        Args:
            redis_data: Complete Redis command and category data
            redis_version: Redis version ('redis7' or 'redis8')
        """
        self.redis_version = redis_version
        self.data: Dict[str, Any] = redis_data[redis_version]
        
        if not self.data.get('commands'):
            raise ValueError(f"Command index not built for {redis_version}")

    def parse_key_permission(self, token: str) -> Tuple[str, str]:
        """
        Parse key permission token into permission type and pattern.

        Supports Redis 7.0+ key permission syntax:
        - ~pattern: Read-write access (traditional)
        - %R~pattern: Read-only access
        - %W~pattern: Write-only access
        - %RW~pattern: Read-write access (alias for ~)

        Args:
            token: Key permission token (e.g., '~cache:*', '%R~logs:*')

        Returns:
            Tuple of (permission_type, pattern)
            - permission_type: 'read-write', 'read-only', or 'write-only'
            - pattern: The key pattern (e.g., 'cache:*')

        Raises:
            ValueError: If token doesn't start with ~ or %
        """
        if token.startswith('%R~'):
            return ('read-only', token[3:])
        elif token.startswith('%W~'):
            return ('write-only', token[3:])
        elif token.startswith('%RW~'):
            return ('read-write', token[4:])
        elif token.startswith('~'):
            return ('read-write', token[1:])
        else:
            raise ValueError(f"Invalid key permission token: {token}")

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
            
            elif token.startswith('~') or token.startswith('%'):
                # Key pattern rule (supports ~, %R~, %W~, %RW~)
                try:
                    permission_type, pattern = self.parse_key_permission(token)
                    parsed['key_rules'].append({
                        'type': 'allow',  # Key patterns always grant access
                        'permission': permission_type,  # 'read-write', 'read-only', 'write-only'
                        'pattern': pattern,
                        'original_token': token
                    })
                except ValueError as e:
                    # Invalid key permission token, skip it
                    pass
        
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

    def test_key_access(self, key: str, command: str, parsed_rule: Dict[str, Any]) -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        Test if a command on a specific key is allowed by the ACL rule.

        This validates both:
        1. Command permission (is the command allowed?)
        2. Key permission (does the key match a pattern with appropriate read/write access?)

        Args:
            key: The key name to test (e.g., 'user:123', 'analytics:session:abc')
            command: The Redis command (e.g., 'GET', 'SET')
            parsed_rule: Parsed ACL rule from parse_acl_rule()

        Returns:
            Tuple of (is_allowed, reason, matched_pattern, permission_type)
            - is_allowed: True if command on key is allowed
            - reason: Human-readable explanation
            - matched_pattern: The key pattern that matched (None if no match)
            - permission_type: 'read-only', 'write-only', 'read-write' (None if no match)

        Example:
            >>> test_key_access('analytics:user:123', 'GET', parsed)
            (True, 'Key matches read-only pattern analytics:*', 'analytics:*', 'read-only')

            >>> test_key_access('analytics:user:123', 'SET', parsed)
            (False, 'Key requires read-only access, SET requires write permission', 'analytics:*', 'read-only')
        """
        command_lower = command.lower()

        # If no key rules, deny access (Redis default)
        if not parsed_rule.get('key_rules'):
            return False, "No key patterns defined in ACL rule", None, None

        # Classify the command
        is_read_cmd = command_lower in self.READ_COMMANDS
        is_write_cmd = command_lower in self.WRITE_COMMANDS
        is_read_write_cmd = command_lower in self.READ_WRITE_COMMANDS

        # Determine what access the command needs
        if is_read_write_cmd:
            needs_read = True
            needs_write = True
        elif is_read_cmd:
            needs_read = True
            needs_write = False
        elif is_write_cmd:
            needs_read = False
            needs_write = True
        else:
            # Unknown command classification - be conservative and require both
            needs_read = True
            needs_write = True

        # Check each key rule
        for key_rule in parsed_rule['key_rules']:
            pattern = key_rule['pattern']
            permission = key_rule.get('permission', 'read-write')  # Default to read-write for backward compatibility

            # Check if key matches this pattern (glob-style matching)
            if fnmatch.fnmatch(key, pattern):
                # Key matches - check if permission type allows this command
                has_read = permission in ('read-only', 'read-write')
                has_write = permission in ('write-only', 'read-write')

                # Check if permission matches command needs
                if needs_read and not has_read:
                    return False, f"Key pattern '{pattern}' is write-only, {command} requires read permission", pattern, permission
                if needs_write and not has_write:
                    return False, f"Key pattern '{pattern}' is read-only, {command} requires write permission", pattern, permission

                # Permission matches!
                permission_display = {
                    'read-only': 'read-only (%R~)',
                    'write-only': 'write-only (%W~)',
                    'read-write': 'read-write (~)'
                }[permission]
                return True, f"Key matches {permission_display} pattern '{pattern}'", pattern, permission

        # No matching pattern
        return False, f"Key '{key}' does not match any allowed patterns", None, None

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
    
    def analyze_rule_redundancy(self, rule: str) -> Dict[str, Any]:
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
                    # Check if this is part of a legitimate security pattern
                    # Pattern: multiple category grants followed by deny rules (broad access + selective restrictions)
                    is_security_pattern = self._is_legitimate_security_pattern(command_rules, i, original_token)

                    if not is_security_pattern:
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

        # Check for all-categories pattern - suggest +@all when all categories are explicitly granted
        self._analyze_all_categories_pattern(parsed, warnings, suggestions, redundant_terms)

        # Check for cancelled @all pattern - suggest empty rule when @all is granted then all categories blocked
        self._analyze_cancelled_all_pattern(parsed, warnings, suggestions, redundant_terms)

        # Group similar redundancy warnings to avoid overwhelming the user
        warnings, suggestions, redundant_terms = self._group_redundancy_warnings(warnings, suggestions, redundant_terms)

        return {
            'warnings': warnings,
            'suggestions': suggestions,
            'redundant_terms': redundant_terms,
            'has_redundancy': len(redundant_terms) > 0 or len(warnings) > 0
        }

    def optimize_rule(self, rule: str) -> Dict[str, Any]:
        """
        Find the shortest equivalent ACL rule representation.

        This method analyzes the given ACL rule and finds alternative representations
        that grant the exact same set of commands but with fewer terms.

        Args:
            rule (str): The ACL rule to optimize

        Returns:
            dict: Optimization results including:
                - original_rule: The input rule
                - original_term_count: Number of terms in original
                - optimized_rule: Shortest equivalent rule found
                - optimized_term_count: Number of terms in optimized
                - savings: Number of terms saved
                - granted_commands: Final set of granted commands
                - explanation: Description of the optimization
        """
        if not rule.strip():
            return {
                'original_rule': rule,
                'optimized_rule': rule,
                'original_term_count': 0,
                'optimized_term_count': 0,
                'savings': 0,
                'granted_commands': [],
                'explanation': 'Empty rule grants no commands'
            }

        try:
            # Parse the original rule to get the final command set
            parsed = self.parse_acl_rule(rule)
            granted_commands, _ = self.evaluate_command_permissions(parsed)
            granted_set = set(granted_commands)

            if not granted_set:
                return {
                    'original_rule': rule,
                    'optimized_rule': '',
                    'original_term_count': len(rule.split()),
                    'optimized_term_count': 0,
                    'savings': len(rule.split()),
                    'granted_commands': [],
                    'explanation': 'Rule grants no commands - optimized to empty rule'
                }

            # Extract key patterns from original rule (preserve them in optimized version)
            rule_tokens = rule.split()
            key_patterns = [t for t in rule_tokens if t.startswith('~') or t.startswith('%')]

            # Count terms in original rule (exclude key patterns: ~, %R~, %W~, %RW~)
            original_tokens = [t for t in rule_tokens if not (t.startswith('~') or t.startswith('%'))]
            original_term_count = len(original_tokens)

            # Find all possible representations
            representations = []

            # 1. Try pure category grants
            for category, commands in self.data['categories'].items():
                cat_set = set(commands)
                if cat_set == granted_set:
                    representations.append({
                        'rule': f'+@{category}',
                        'term_count': 1,
                        'type': 'pure_category',
                        'explanation': f'Commands match exactly the @{category} category'
                    })

            # 2. Try category with exclusions
            for category, commands in self.data['categories'].items():
                cat_set = set(commands)
                if granted_set.issubset(cat_set) and granted_set:
                    excluded = cat_set - granted_set
                    if excluded:
                        # Build exclusion rule
                        exclusions = sorted(excluded)
                        exclusion_terms = [f'-{cmd}' for cmd in exclusions]
                        term_count = 1 + len(exclusion_terms)  # +@category + exclusions

                        if term_count < original_term_count:
                            rule_str = f'+@{category} ' + ' '.join(exclusion_terms)
                            representations.append({
                                'rule': rule_str,
                                'term_count': term_count,
                                'type': 'category_with_exclusions',
                                'explanation': f'Grant @{category} and exclude {len(exclusions)} commands'
                            })

            # 3. Try individual command grants
            if len(granted_set) < original_term_count:
                command_terms = sorted([f'+{cmd}' for cmd in granted_set])
                representations.append({
                    'rule': ' '.join(command_terms),
                    'term_count': len(command_terms),
                    'type': 'individual_commands',
                    'explanation': f'List all {len(granted_set)} commands individually'
                })

            # 4. Try multiple category approach (find minimal set of categories that cover all commands)
            covering_categories = self._find_minimal_category_cover(granted_set)
            if covering_categories:
                cat_terms = [f'+@{cat}' for cat in covering_categories['categories']]
                excl_terms = [f'-{cmd}' for cmd in covering_categories.get('exclusions', [])]
                all_terms = cat_terms + excl_terms
                term_count = len(all_terms)

                if term_count < original_term_count:
                    representations.append({
                        'rule': ' '.join(all_terms),
                        'term_count': term_count,
                        'type': 'multiple_categories',
                        'explanation': f'Combine {len(cat_terms)} categories with {len(excl_terms)} exclusions'
                    })

            # Find the best representation (fewest terms)
            if not representations:
                # No better representation found
                return {
                    'original_rule': rule,
                    'optimized_rule': rule,
                    'original_term_count': original_term_count,
                    'optimized_term_count': original_term_count,
                    'savings': 0,
                    'granted_commands': sorted(list(granted_set)),
                    'explanation': 'No shorter equivalent representation found'
                }

            best = min(representations, key=lambda r: r['term_count'])

            if best['term_count'] >= original_term_count:
                # No improvement
                return {
                    'original_rule': rule,
                    'optimized_rule': rule,
                    'original_term_count': original_term_count,
                    'optimized_term_count': original_term_count,
                    'savings': 0,
                    'granted_commands': sorted(list(granted_set)),
                    'explanation': 'Current rule is already optimal'
                }

            # Append key patterns to optimized rule (they don't affect command optimization)
            optimized_rule = best['rule']
            if key_patterns:
                optimized_rule = optimized_rule + ' ' + ' '.join(key_patterns)

            return {
                'original_rule': rule,
                'optimized_rule': optimized_rule,
                'original_term_count': original_term_count,
                'optimized_term_count': best['term_count'],
                'savings': original_term_count - best['term_count'],
                'granted_commands': sorted(list(granted_set)),
                'explanation': best['explanation'],
                'optimization_type': best['type']
            }

        except Exception as e:
            return {
                'original_rule': rule,
                'optimized_rule': rule,
                'original_term_count': len(rule.split()),
                'optimized_term_count': len(rule.split()),
                'savings': 0,
                'granted_commands': [],
                'error': str(e),
                'explanation': f'Error during optimization: {str(e)}'
            }

    def _find_minimal_category_cover(self, target_commands: Set[str]) -> Dict[str, Any]:
        """
        Find the minimal set of categories that covers the target commands.

        Uses a greedy algorithm to find a small (not necessarily minimal) set of categories
        that covers all target commands with the fewest total terms (categories + exclusions).

        Args:
            target_commands: Set of commands to cover

        Returns:
            dict: Contains 'categories' list and 'exclusions' list
        """
        if not target_commands:
            return {'categories': [], 'exclusions': []}

        remaining = target_commands.copy()
        selected_categories = []
        total_exclusions = set()

        # Greedy approach: repeatedly select the category that covers the most remaining commands
        # with the best ratio of (commands_covered / total_terms_added)
        while remaining:
            best_category = None
            best_score = -1
            best_coverage = set()
            best_exclusions = set()

            for category, commands in self.data['categories'].items():
                cat_set = set(commands)
                coverage = remaining.intersection(cat_set)
                if not coverage:
                    continue

                # Calculate how many commands from this category we'd need to exclude
                unwanted = cat_set - target_commands

                # Score = coverage / (1 + exclusions needed)
                # Prefer categories with high coverage and low exclusions
                score = len(coverage) / (1 + len(unwanted))

                if score > best_score:
                    best_score = score
                    best_category = category
                    best_coverage = coverage
                    best_exclusions = unwanted

            if not best_category:
                # Couldn't find any category to help - add remaining as individual commands
                break

            selected_categories.append(best_category)
            remaining -= best_coverage
            total_exclusions.update(best_exclusions)

        # If we still have remaining commands, this approach didn't cover everything
        if remaining:
            # Fall back to individual commands for remaining
            return {'categories': [], 'exclusions': []}

        return {
            'categories': selected_categories,
            'exclusions': sorted(list(total_exclusions))
        }

    def _is_legitimate_security_pattern(self, command_rules: List[Dict[str, str]], current_index: int, current_token: Dict[str, str]) -> bool:
        """
        Detect if the current inclusion rule is part of a legitimate security pattern.

        A legitimate security pattern is one where:
        1. Multiple category grants are used (e.g., +@read +@write)
        2. Followed by deny rules that remove dangerous/unwanted commands
        3. The overlap is intentional for broad access with selective restrictions

        Args:
            command_rules: List of all command rules
            current_index: Index of current rule being checked
            current_token: The token being evaluated (e.g., '+@write')

        Returns:
            bool: True if this appears to be a legitimate security pattern
        """
        if not current_token.startswith('+@'):
            return False

        # Look for multiple category grants before this position
        category_grants_before = []
        deny_rules_after = []

        # Collect category grants that appear before current position
        for i in range(current_index):
            rule = command_rules[i]
            token = rule.get('original_token', '')
            if (token.startswith('+@') and
                rule['target'] == 'category' and
                not rule.get('error')):
                category_grants_before.append(token)

        # Collect deny rules that appear after current position
        for i in range(current_index + 1, len(command_rules)):
            rule = command_rules[i]
            token = rule.get('original_token', '')
            if (token.startswith('-@') and
                rule['target'] == 'category' and
                not rule.get('error')):
                deny_rules_after.append(token)

        # Pattern recognition:
        # 1. Must have at least 1 other category grant before this one
        # 2. Must have at least 1 deny rule after all grants
        # 3. The deny rules should target security-sensitive categories

        if len(category_grants_before) >= 1 and len(deny_rules_after) >= 1:
            # Check if any of the deny rules target security-sensitive categories
            security_categories = ['dangerous', 'admin', 'keyspace']

            for deny_token in deny_rules_after:
                deny_category = deny_token[2:].lower()  # Remove '-@' prefix
                if deny_category in security_categories:
                    return True

            # Also consider it a security pattern if there are multiple broad grants
            # (read, write, etc.) followed by any deny - this suggests intentional design
            broad_categories = ['read', 'write', 'all', 'fast', 'slow']
            current_category = current_token[2:].lower()  # Remove '+@' prefix

            if current_category in broad_categories:
                # Check if we have other broad category grants
                for grant_token in category_grants_before:
                    grant_category = grant_token[2:].lower()
                    if grant_category in broad_categories:
                        return True

        return False

    def _would_category_simplify_rule(self, parsed_rule: Dict[str, Any], category: str) -> bool:
        """
        Check if suggesting a category would actually simplify the rule.

        This method determines if there are individual commands from the specified category
        in the rule that could be replaced by adding the category. It should return False
        if the category's commands are only granted as side effects of other category grants.

        Args:
            parsed_rule: Parsed ACL rule structure
            category: Category to check for simplification potential

        Returns:
            bool: True if suggesting this category would simplify the rule
        """
        if category not in self.data['categories']:
            return False

        category_commands = set(self.data['categories'][category])

        # Count how many individual commands from this category are explicitly in the rule
        individual_commands_from_category = 0

        for rule in parsed_rule['command_rules']:
            if (rule['type'] == 'allow' and
                rule['target'] == 'command' and
                rule['value'].lower() in category_commands):
                individual_commands_from_category += 1

        # Only suggest the category if there are at least 2 individual commands from it
        # This means replacing multiple individual commands with one category would simplify the rule
        return individual_commands_from_category >= 2

    def _analyze_category_completion(self, parsed_rule: Dict[str, Any], warnings: List[str], suggestions: List[str]) -> None:
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
                        # Check if suggesting this category would actually simplify the rule
                        # Only suggest if there are individual commands from this category that could be replaced
                        if self._would_category_simplify_rule(parsed_rule, category):
                            warnings.append(f"Individual commands cover entire @{category} category ({command_count} commands)")

                            # Generate optimized rule for clickable suggestion
                            optimized_rule = self._generate_optimized_rule_for_category(parsed_rule, category)

                            # Add suggestion in the existing clickable format
                            suggestions.append(f"Simplified rule: {optimized_rule}")

            # Check for null categories (category included but all commands excluded)
            self._analyze_null_categories(parsed_rule, warnings, suggestions)

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

    def _analyze_null_categories(self, parsed_rule: Dict[str, Any], warnings: List[str], suggestions: List[str]) -> None:
        """
        Analyze if any categories are included but then all their commands are excluded (null categories).

        Args:
            parsed_rule: Parsed ACL rule structure
            warnings: List to append warnings to
            suggestions: List to append suggestions to
        """
        try:
            # Find categories that are explicitly included
            included_categories = set()
            excluded_commands = set()

            for rule in parsed_rule['command_rules']:
                if rule['type'] == 'allow' and rule['target'] == 'category':
                    included_categories.add(rule['value'])
                elif rule['type'] == 'deny' and rule['target'] == 'command':
                    excluded_commands.add(rule['value'])

            # Check each included category to see if all its commands are excluded
            null_categories = []
            for category in included_categories:
                if category in self.data['categories']:
                    category_commands = set(self.data['categories'][category])

                    # Check if all commands in this category are explicitly excluded
                    if category_commands.issubset(excluded_commands):
                        null_categories.append((category, len(category_commands)))

            # Generate warnings and suggestions for null categories
            if null_categories:
                for category, command_count in null_categories:
                    warnings.append(f"Null category detected: +@{category} is included but all {command_count} commands are then excluded")

                    # Generate optimized rule that removes the null category and its exclusions
                    optimized_rule = self._generate_optimized_rule_for_null_category(parsed_rule, category)
                    if optimized_rule.strip():
                        suggestions.append(f"Simplified rule: {optimized_rule}")
                    else:
                        suggestions.append("Simplified rule: (empty rule)")

        except Exception as e:
            # Don't let null category analysis errors break the main redundancy analysis
            pass

    def _generate_optimized_rule_for_null_category(self, parsed_rule: Dict[str, Any], null_category: str) -> str:
        """
        Generate an optimized rule that removes a null category and its exclusions.

        Args:
            parsed_rule: Parsed ACL rule structure
            null_category: Category that is null (included but all commands excluded)

        Returns:
            Optimized rule string
        """
        try:
            # Get original rule tokens
            original_tokens = parsed_rule['raw_rule'].strip().split()

            # Get commands in the null category
            category_commands = set(self.data['categories'].get(null_category, []))

            # Build new rule tokens, excluding the null category and its command exclusions
            new_tokens = []

            for token in original_tokens:
                # Skip the null category inclusion
                if token == f'+@{null_category}':
                    continue

                # Skip exclusions of commands from the null category
                if token.startswith('-') and not token.startswith('-@'):
                    command = token[1:].lower()
                    if command in category_commands:
                        continue

                # Keep all other tokens
                new_tokens.append(token)

            # Return the simplified rule (or empty string if no tokens remain)
            if new_tokens:
                return ' '.join(new_tokens)
            else:
                return ''

        except Exception:
            # If optimization fails, return original rule
            return parsed_rule['raw_rule']

    def _group_redundancy_warnings(self, warnings: List[str], suggestions: List[str], redundant_terms: List[str]) -> None:
        """
        Group similar redundancy warnings to avoid overwhelming the user with many similar messages.

        Args:
            warnings: List of warning messages
            suggestions: List of suggestion messages
            redundant_terms: List of redundant term objects

        Returns:
            tuple: (grouped_warnings, updated_suggestions, grouped_redundant_terms)
        """
        if len(warnings) <= 2:
            # Not enough warnings to group
            return warnings, suggestions, redundant_terms

        # Group redundant inclusion and exclusion warnings
        redundant_inclusion_pattern = "Redundant inclusion:"
        redundant_exclusion_pattern = "Redundant exclusion:"

        inclusion_warnings = []
        inclusion_terms = []
        exclusion_warnings = []
        exclusion_terms = []
        other_warnings = []
        other_terms = []

        # Separate inclusion warnings, exclusion warnings, and others
        for i, warning in enumerate(warnings):
            if redundant_inclusion_pattern in warning and "All commands already granted by earlier rules" in warning:
                # Extract the term from the warning
                lines = warning.split('\n')
                if len(lines) >= 2:
                    term_line = lines[0].replace(redundant_inclusion_pattern, '').strip().strip("'")
                    inclusion_warnings.append(term_line)
                    # Find corresponding redundant term
                    for term in redundant_terms:
                        if term.get('term') == term_line and term.get('type') == 'inclusion':
                            inclusion_terms.append(term)
                            break
            elif redundant_exclusion_pattern in warning and "Commands were not granted by earlier rules" in warning:
                # Extract the term from the warning
                lines = warning.split('\n')
                if len(lines) >= 2:
                    term_line = lines[0].replace(redundant_exclusion_pattern, '').strip().strip("'")
                    exclusion_warnings.append(term_line)
                    # Find corresponding redundant term
                    for term in redundant_terms:
                        if term.get('term') == term_line and term.get('type') == 'exclusion':
                            exclusion_terms.append(term)
                            break
            else:
                other_warnings.append(warning)

        # Separate other redundant terms that don't correspond to grouped warnings
        for term in redundant_terms:
            if term not in inclusion_terms and term not in exclusion_terms:
                other_terms.append(term)

        # Create grouped warnings and suggestions if we have multiple redundant inclusions or exclusions
        grouped_warnings = other_warnings.copy()
        grouped_terms = other_terms.copy()

        # Group redundant inclusions
        if len(inclusion_warnings) >= 3:  # Group if 3 or more similar warnings
            # Create a single grouped warning
            terms_list = "', '".join(inclusion_warnings)
            grouped_warning = f"Multiple redundant category inclusions detected:\n'{terms_list}'\nAll commands in these categories are already granted by earlier rules"
            grouped_warnings.append(grouped_warning)

            # Add a single grouped redundant term entry
            grouped_terms.append({
                'term': f"[{len(inclusion_warnings)} redundant inclusions]",
                'position': -1,
                'type': 'grouped_inclusion',
                'reason': f"Multiple redundant category inclusions: {', '.join(inclusion_warnings)}",
                'grouped_terms': inclusion_terms
            })
        else:
            # Keep individual warnings if less than 3
            for warning in warnings:
                if redundant_inclusion_pattern in warning:
                    grouped_warnings.append(warning)
            grouped_terms.extend(inclusion_terms)

        # Group redundant exclusions
        if len(exclusion_warnings) >= 3:  # Group if 3 or more similar warnings
            # Create a single grouped warning for exclusions
            terms_list = "', '".join(exclusion_warnings)
            grouped_warning = f"Multiple redundant category exclusions detected:\n'{terms_list}'\nThese categories were not granted by earlier rules, so excluding them is unnecessary"
            grouped_warnings.append(grouped_warning)

            # Add a single grouped redundant term entry
            grouped_terms.append({
                'term': f"[{len(exclusion_warnings)} redundant exclusions]",
                'position': -1,
                'type': 'grouped_exclusion',
                'reason': f"Multiple redundant category exclusions: {', '.join(exclusion_warnings)}",
                'grouped_terms': exclusion_terms
            })
        else:
            # Keep individual warnings if less than 3
            for warning in warnings:
                if redundant_exclusion_pattern in warning:
                    grouped_warnings.append(warning)
            grouped_terms.extend(exclusion_terms)

        return grouped_warnings, suggestions, grouped_terms

    def _analyze_all_categories_pattern(self, parsed_rule: Dict[str, Any], warnings: List[str], suggestions: List[str], redundant_terms: List[str]) -> None:
        """
        Check if all available categories are explicitly granted and suggest +@all optimization.

        Args:
            parsed_rule: The parsed ACL rule structure
            warnings: List of warning messages (modified in-place)
            suggestions: List of suggestions (modified in-place)
            redundant_terms: List of redundant terms (modified in-place)
        """
        try:
            # Extract granted categories from the rule
            granted_categories = set()
            tokens = parsed_rule['raw_rule'].strip().split()

            for token in tokens:
                if token.startswith('+@') and len(token) > 2:
                    category = token[2:]  # Remove '+@' prefix
                    if category in self.data['categories'] and category != 'all':
                        granted_categories.add(category)

            # Get all available categories (excluding 'all')
            all_categories = set(self.data['categories'].keys()) - {'all'}

            # Check if all categories are explicitly granted
            if granted_categories == all_categories and len(granted_categories) >= 10:
                # All categories are explicitly granted - suggest +@all

                # Find key patterns to preserve
                key_tokens = [token for token in tokens if token.startswith('~')]
                key_part = ' '.join(key_tokens) if key_tokens else '~*'

                # Replace existing suggestion with +@all optimization
                all_suggestion = f"Optimized rule: +@all {key_part}"

                # Clear existing suggestions and add the @all optimization
                suggestions.clear()
                suggestions.append(all_suggestion)

                # Clear existing warnings and add the all-categories specific warning
                warnings.clear()
                category_list = "', '".join(sorted(granted_categories))
                all_categories_warning = f"All {len(granted_categories)} categories explicitly granted:\n'{category_list}'\nThis can be simplified to '+@all' for better readability"
                warnings.append(all_categories_warning)

                # Mark all category tokens as redundant for UI highlighting
                for token in tokens:
                    if token.startswith('+@') and token[2:] in granted_categories:
                        redundant_terms.append({
                            'term': token,
                            'position': tokens.index(token),
                            'type': 'all_categories_optimization',
                            'reason': f"Part of all-categories pattern, can be simplified to '+@all'"
                        })

        except Exception as e:
            # Don't let all-categories analysis errors break the main redundancy analysis
            pass

    def _analyze_cancelled_all_pattern(self, parsed_rule: Dict[str, Any], warnings: List[str], suggestions: List[str], redundant_terms: List[str]) -> None:
        """
        Check if @all is granted but then all categories are blocked, resulting in empty ACL.

        Args:
            parsed_rule: The parsed ACL rule structure
            warnings: List of warning messages (modified in-place)
            suggestions: List of suggestions (modified in-place)
            redundant_terms: List of redundant terms (modified in-place)
        """
        try:
            # Extract tokens from the rule
            tokens = parsed_rule['raw_rule'].strip().split()

            # Look for +@all followed by blocking all other categories
            has_all_grant = False
            blocked_categories = set()

            for token in tokens:
                if token == '+@all':
                    has_all_grant = True
                elif token.startswith('-@') and len(token) > 2:
                    category = token[2:]  # Remove '-@' prefix
                    if category in self.data['categories'] and category != 'all':
                        blocked_categories.add(category)

            if not has_all_grant:
                return  # Not a cancelled @all pattern

            # Get all available categories (excluding 'all')
            all_categories = set(self.data['categories'].keys()) - {'all'}

            # Check if all categories (except @all) are blocked after @all is granted
            if blocked_categories == all_categories and len(blocked_categories) >= 10:
                # This is a cancelled @all pattern - @all granted then all categories blocked = empty ACL

                # Find key patterns to preserve
                key_tokens = [token for token in tokens if token.startswith('~')]
                key_part = ' '.join(key_tokens) if key_tokens else '~*'

                # Clear existing warnings and suggestions - this is the primary issue
                warnings.clear()
                suggestions.clear()

                # Add specific warning about cancelled @all pattern
                blocked_list = "', '".join(sorted(blocked_categories))
                cancelled_warning = f"Cancelled @all pattern detected:\n'+@all' grants all permissions, but then all {len(blocked_categories)} categories are blocked:\n'{blocked_list}'\nThis results in no effective permissions (empty ACL)"
                warnings.append(cancelled_warning)

                # Suggest empty rule or just key patterns
                if key_tokens:
                    suggestions.append(f"Simplified rule: {key_part}")
                else:
                    suggestions.append("Simplified rule: (empty rule)")

                # Mark the @all grant and all category blocks as redundant
                redundant_terms.clear()  # Clear existing redundant terms

                # Mark +@all as leading to cancelled pattern
                redundant_terms.append({
                    'term': '+@all',
                    'position': tokens.index('+@all') if '+@all' in tokens else -1,
                    'type': 'cancelled_all_grant',
                    'reason': 'Grants all permissions but immediately cancelled by blocking all categories'
                })

                # Mark all blocked categories as part of cancelled pattern
                for token in tokens:
                    if token.startswith('-@') and token[2:] in blocked_categories:
                        redundant_terms.append({
                            'term': token,
                            'position': tokens.index(token),
                            'type': 'cancelled_all_block',
                            'reason': 'Part of cancelled @all pattern - blocks permissions that were just granted'
                        })

        except Exception as e:
            # Don't let cancelled @all analysis errors break the main redundancy analysis
            pass