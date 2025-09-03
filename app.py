#!/usr/bin/env python3
"""
Redis ACL Builder - Main Flask Application
"""

from flask import Flask, render_template, request, jsonify
import logging
import sys
import os
from typing import Dict, Any

# Add the project directory to Python path for helper imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import our helper modules
from helpers.data_loader import get_redis_data, build_command_indexes
from helpers.acl_parser import ACLParser

# Initialize Flask app
app = Flask(__name__)
app.config['DEBUG'] = True

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Redis data on startup
logger.info("Loading Redis command data...")
REDIS_DATA = get_redis_data()
REDIS_DATA = build_command_indexes(REDIS_DATA)
logger.info(f"Loaded data for Redis 7 ({len(REDIS_DATA['redis7']['commands'])} commands) and Redis 8 ({len(REDIS_DATA['redis8']['commands'])} commands)")

# Global parsers for each version
PARSERS = {
    'redis7': ACLParser(REDIS_DATA, 'redis7'),
    'redis8': ACLParser(REDIS_DATA, 'redis8')
}

def get_parser(version: str) -> ACLParser:
    """Get parser for specified Redis version."""
    if version not in PARSERS:
        raise ValueError(f"Unsupported Redis version: {version}")
    return PARSERS[version]

def handle_api_error(error_msg: str, status_code: int = 400) -> Dict[str, Any]:
    """Standard error response format."""
    return jsonify({
        'error': True,
        'message': error_msg,
        'status_code': status_code
    }), status_code

# Routes
@app.route('/')
def index():
    """Serve the main web interface."""
    return render_template('index.html')

@app.route('/api/parse', methods=['POST'])
def api_parse():
    """Parse ACL rule and return granted commands."""
    try:
        try:
            data = request.get_json()
            if not data:
                return handle_api_error("No JSON data provided")
        except Exception:
            return handle_api_error("Invalid or missing JSON data")
        
        rule = data.get('rule', '')
        version = data.get('version', 'redis7')
        
        # Validate version
        if version not in PARSERS:
            return handle_api_error(f"Invalid Redis version: {version}")
        
        parser = get_parser(version)
        
        # Validate rule syntax
        is_valid, errors = parser.validate_rule_syntax(rule)
        if not is_valid:
            return handle_api_error(f"Invalid ACL rule: {'; '.join(errors)}")
        
        # Parse and evaluate rule
        parsed_rule = parser.parse_acl_rule(rule)
        granted_commands, explanations = parser.evaluate_command_permissions(parsed_rule)
        
        # Group commands by category for display
        grouped_commands = {}
        for category in parser.data['categories'].keys():
            category_commands = [cmd for cmd in granted_commands 
                               if category in parser.get_command_categories(cmd)]
            if category_commands:
                grouped_commands[category] = sorted(category_commands)
        
        # Get rule impact summary
        impact_summary = parser.get_rule_impact_summary(parsed_rule)
        
        return jsonify({
            'success': True,
            'granted_commands': sorted(list(granted_commands)),
            'grouped_commands': grouped_commands,
            'total_granted': len(granted_commands),
            'total_available': len(parser.data['commands']),
            'parsed_rule': parsed_rule,
            'impact_summary': impact_summary,
            'version': version
        })
        
    except Exception as e:
        logger.error(f"Error in api_parse: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/test-command', methods=['POST'])
def api_test_command():
    """Test if specific command is allowed."""
    try:
        try:
            data = request.get_json()
            if not data:
                return handle_api_error("No JSON data provided")
        except Exception:
            return handle_api_error("Invalid or missing JSON data")
        
        rule = data.get('rule', '')
        command = data.get('command', '').strip()
        version = data.get('version', 'redis7')
        
        if not command:
            return handle_api_error("No command specified")
        
        # Validate version
        if version not in PARSERS:
            return handle_api_error(f"Invalid Redis version: {version}")
        
        parser = get_parser(version)
        
        # Validate rule syntax
        is_valid, errors = parser.validate_rule_syntax(rule)
        if not is_valid:
            return handle_api_error(f"Invalid ACL rule: {'; '.join(errors)}")
        
        # Parse rule and test command
        parsed_rule = parser.parse_acl_rule(rule)
        is_granted, explanation, categories = parser.test_command_access(command, parsed_rule)
        
        return jsonify({
            'success': True,
            'command': command.upper(),
            'is_granted': is_granted,
            'explanation': explanation,
            'categories': categories,
            'version': version
        })
        
    except Exception as e:
        logger.error(f"Error in api_test_command: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/command-info', methods=['POST'])
def api_command_info():
    """Get information about a command."""
    try:
        try:
            data = request.get_json()
            if not data:
                return handle_api_error("No JSON data provided")
        except Exception:
            return handle_api_error("Invalid or missing JSON data")
        
        command = data.get('command', '').strip()
        version = data.get('version', 'redis7')
        
        if not command:
            return handle_api_error("No command specified")
        
        # Validate version
        if version not in PARSERS:
            return handle_api_error(f"Invalid Redis version: {version}")
        
        parser = get_parser(version)
        categories = parser.get_command_categories(command)
        
        return jsonify({
            'success': True,
            'command': command.upper(),
            'categories': categories,
            'exists': len(categories) > 0,
            'version': version
        })
        
    except Exception as e:
        logger.error(f"Error in api_command_info: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/categories', methods=['GET'])
def api_categories():
    """Get all available categories for a Redis version."""
    try:
        version = request.args.get('version', 'redis7')
        
        # Validate version
        if version not in PARSERS:
            return handle_api_error(f"Invalid Redis version: {version}")
        
        parser = get_parser(version)
        category_info = parser.get_category_info()
        
        return jsonify({
            'success': True,
            'version': version,
            'categories': sorted(category_info.keys()),
            'category_info': category_info,
            'total_categories': len(category_info)
        })
        
    except Exception as e:
        logger.error(f"Error in api_categories: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/search-commands', methods=['POST'])
def api_search_commands():
    """Search for commands matching a pattern."""
    try:
        try:
            data = request.get_json()
            if not data:
                return handle_api_error("No JSON data provided")
        except Exception:
            return handle_api_error("Invalid or missing JSON data")
        
        pattern = data.get('pattern', '').strip()
        version = data.get('version', 'redis7')
        limit = data.get('limit', 50)  # Limit results to avoid overwhelming UI
        
        if not pattern:
            return handle_api_error("No search pattern specified")
        
        # Validate version
        if version not in PARSERS:
            return handle_api_error(f"Invalid Redis version: {version}")
        
        parser = get_parser(version)
        matching_commands = parser.search_commands(pattern)
        
        # Limit results and add category info
        limited_results = matching_commands[:limit]
        results_with_categories = []
        
        for cmd in limited_results:
            results_with_categories.append({
                'command': cmd,
                'categories': parser.get_command_categories(cmd)
            })
        
        return jsonify({
            'success': True,
            'pattern': pattern,
            'results': results_with_categories,
            'total_matches': len(matching_commands),
            'showing': len(limited_results),
            'version': version
        })
        
    except Exception as e:
        logger.error(f"Error in api_search_commands: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/validate-rule', methods=['POST'])
def api_validate_rule():
    """Validate ACL rule syntax."""
    try:
        try:
            data = request.get_json()
            if not data:
                return handle_api_error("No JSON data provided")
        except Exception:
            return handle_api_error("Invalid or missing JSON data")
        
        rule = data.get('rule', '')
        version = data.get('version', 'redis7')
        
        # Validate version
        if version not in PARSERS:
            return handle_api_error(f"Invalid Redis version: {version}")
        
        parser = get_parser(version)
        is_valid, errors = parser.validate_rule_syntax(rule)
        
        return jsonify({
            'success': True,
            'rule': rule,
            'is_valid': is_valid,
            'errors': errors,
            'version': version
        })
        
    except Exception as e:
        logger.error(f"Error in api_validate_rule: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/health')
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'redis_versions': list(PARSERS.keys()),
        'total_commands': {
            version: len(parser.data['commands'])
            for version, parser in PARSERS.items()
        }
    })

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'error': True,
        'message': 'Endpoint not found',
        'status_code': 404
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'error': True,
        'message': 'Internal server error',
        'status_code': 500
    }), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🔐 Redis ACL Builder Starting Up")
    print("="*60)
    print(f"✅ Redis 7: {len(REDIS_DATA['redis7']['commands'])} commands, {len(REDIS_DATA['redis7']['categories'])} categories")
    print(f"✅ Redis 8: {len(REDIS_DATA['redis8']['commands'])} commands, {len(REDIS_DATA['redis8']['categories'])} categories")
    print("🌐 Server starting at http://localhost:5000")
    print("="*60 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)