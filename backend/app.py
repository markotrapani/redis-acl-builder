# Copyright (c) 2025 Marko Trapani
# Licensed under the MIT License - see LICENSE file for details
#
#!/usr/bin/env python3
"""
Redis ACL Builder - Main Flask Application
"""

from flask import Flask, render_template, request, jsonify
from flask.wrappers import Response
from flask_compress import Compress  # type: ignore[import-untyped]
import logging
import sys
import os
from typing import Dict, Any, Tuple, Union, List, cast
from pydantic import BaseModel, ValidationError
from functools import lru_cache

# Add the project directory to Python path for helper imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import our helper modules
from helpers.data_loader import get_redis_data, build_command_indexes, RedisVersionData
from helpers.acl_parser import ACLParser
from helpers import __version__

# Import Pydantic models
from models.api_models import (
    ParseACLRequest, ParseACLResponse,
    TestCommandRequest, TestCommandResponse,
    CommandInfoRequest, CommandInfoResponse,
    CategoriesResponse,
    SearchCommandsRequest, SearchCommandsResponse, CommandSearchResult,
    ValidateRuleRequest, ValidateRuleResponse,
    AnalyzeRedundancyRequest, AnalyzeRedundancyResponse,
    OptimizeRuleRequest, OptimizeRuleResponse,
    TestCommandKeyRequest, TestCommandKeyResponse,
    ErrorResponse, HealthResponse
)

# Configuration constants
DEFAULT_PORT = int(os.getenv('FLASK_PORT', '5001'))
DEFAULT_SEARCH_LIMIT = int(os.getenv('DEFAULT_SEARCH_LIMIT', '50'))
DEBUG_MODE = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

# Initialize Flask app with custom template and static folders
# Detect if running as PyInstaller bundle or from source
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    # Running as PyInstaller bundle - templates are in _internal/
    base_dir = os.path.dirname(sys.executable)
    static_folder = os.path.join(base_dir, '_internal', 'static')
    template_folder = os.path.join(base_dir, '_internal', 'templates')
else:
    # Running from source - use monorepo structure
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')
    static_folder = os.path.join(frontend_dir, 'static')
    template_folder = os.path.join(frontend_dir, 'templates')

app = Flask(__name__,
            static_folder=static_folder,
            template_folder=template_folder)
app.config['DEBUG'] = DEBUG_MODE

# Enable Gzip compression for all responses
Compress(app)

# Configure static file caching and security headers
@app.after_request
def add_cache_headers(response: Response) -> Response:
    """Add cache headers for static files in production and security headers."""
    if not DEBUG_MODE and request.path.startswith('/static/'):
        # Cache static files for 1 year (immutable assets)
        # When files change, update version in HTML to bust cache
        response.cache_control.max_age = 31536000  # 1 year in seconds
        response.cache_control.public = True
        response.cache_control.immutable = True

    # Add Content Security Policy for Electron security
    # Allow inline scripts/styles for our app, but from same origin only
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "  # Our app uses inline scripts
        "style-src 'self' 'unsafe-inline'; "   # Our app uses inline styles
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "font-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    return response

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Redis data on startup
logger.info("Loading Redis command data...")
_redis_data = get_redis_data()
REDIS_DATA: Dict[str, RedisVersionData] = build_command_indexes(_redis_data)
logger.info(f"Loaded data for Redis 7 ({len(REDIS_DATA['redis7']['commands'])} commands) and Redis 8 ({len(REDIS_DATA['redis8']['commands'])} commands)")

# Global parsers for each version
PARSERS: Dict[str, ACLParser] = {
    'redis7': ACLParser(REDIS_DATA, 'redis7'),
    'redis8': ACLParser(REDIS_DATA, 'redis8')
}

def get_parser(version: str) -> ACLParser:
    """Get parser for specified Redis version."""
    if version not in PARSERS:
        raise ValueError(f"Unsupported Redis version: {version}")
    return PARSERS[version]

def handle_api_error(error_msg: str, status_code: int = 400) -> Tuple[Any, int]:
    """Standard error response format."""
    response = ErrorResponse(
        error=True,
        message=error_msg,
        status_code=status_code
    )
    return jsonify(response.model_dump()), status_code

def validate_pydantic_request(model_class: type[BaseModel]) -> Any:
    """Validate request JSON using Pydantic model."""
    try:
        data = request.get_json()
        if not data:
            raise ValueError("No JSON data provided")
        return model_class(**data)
    except ValidationError as e:
        # Format Pydantic validation errors
        errors: List[str] = []
        for error in e.errors():
            field: str = '.'.join(str(x) for x in error['loc'])
            msg: str = str(error['msg'])
            errors.append(f"{field}: {msg}")
        raise ValueError(f"Validation error: {'; '.join(errors)}")
    except Exception as e:
        raise ValueError(f"Invalid request data: {str(e)}")

# Routes
@app.route('/')
def index() -> str:
    """Serve the main web interface."""
    return render_template('index.html', version=__version__)

@app.route('/info')
def info() -> str:
    """Serve the info page explaining the application."""
    return render_template('info.html', version=__version__)

@app.route('/api/parse', methods=['POST'])
def api_parse() -> Union[Response, Tuple[Response, int]]:
    """Parse ACL rule and return granted commands."""
    try:
        req_data = validate_pydantic_request(ParseACLRequest)

        parser = get_parser(req_data.version)

        # Validate rule syntax
        is_valid, errors = parser.validate_rule_syntax(req_data.rule)
        if not is_valid:
            return handle_api_error(f"Invalid ACL rule: {'; '.join(errors)}")

        # Parse and evaluate rule
        parsed_rule = parser.parse_acl_rule(req_data.rule)
        granted_commands, _explanations = parser.evaluate_command_permissions(parsed_rule)

        # Group commands by category for display
        grouped_commands: Dict[str, List[str]] = {}
        parser_data = parser.data
        categories = cast(Dict[str, List[str]], parser_data['categories'])
        for category in categories.keys():
            category_commands = [cmd for cmd in granted_commands
                               if category in parser.get_command_categories(cmd)]
            if category_commands:
                grouped_commands[category] = sorted(category_commands)

        # Get rule impact summary
        impact_summary = parser.get_rule_impact_summary(parsed_rule)

        # NEW: Analyze category grants
        category_analysis = parser.analyze_category_grants(granted_commands)

        # Calculate blocked commands (all commands minus granted commands)
        all_commands_set = set(cast(Dict[str, Any], parser_data['commands']).keys())
        blocked_commands_set = all_commands_set - granted_commands

        # Return the actual parsed rule structure with root_permissions and selectors
        response = ParseACLResponse(
            success=True,
            granted_commands=sorted(list(granted_commands)),
            blocked_commands=sorted(list(blocked_commands_set)),
            grouped_commands=grouped_commands,
            total_granted=len(granted_commands),
            total_available=len(cast(Dict[str, Any], parser_data['commands'])),
            parsed_rule=parsed_rule,
            impact_summary=impact_summary,
            version=req_data.version,
            granted_categories=category_analysis['granted_categories'],
            partial_categories=category_analysis['partial_categories'],
            blocked_categories=category_analysis['blocked_categories']
        )
        return jsonify(response.model_dump())
        
    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_parse: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/test-command', methods=['POST'])
def api_test_command() -> Union[Response, Tuple[Response, int]]:
    """Test if specific command is allowed."""
    try:
        req_data = validate_pydantic_request(TestCommandRequest)

        parser = get_parser(req_data.version)

        # Validate rule syntax
        is_valid, errors = parser.validate_rule_syntax(req_data.rule)
        if not is_valid:
            return handle_api_error(f"Invalid ACL rule: {'; '.join(errors)}")

        # Parse rule and test command
        parsed_rule = parser.parse_acl_rule(req_data.rule)
        is_granted, explanation, categories, _selector_index = parser.test_command_access(req_data.command, parsed_rule)

        response = TestCommandResponse(
            success=True,
            command=req_data.command.upper(),
            is_granted=is_granted,
            explanation=explanation,
            categories=categories,
            version=req_data.version
        )
        return jsonify(response.model_dump())
        
    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_test_command: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/command-info', methods=['POST'])
def api_command_info() -> Union[Response, Tuple[Response, int]]:
    """Get information about a command."""
    try:
        req_data = validate_pydantic_request(CommandInfoRequest)

        parser = get_parser(req_data.version)
        categories = parser.get_command_categories(req_data.command)

        response = CommandInfoResponse(
            success=True,
            command=req_data.command.upper(),
            categories=categories,
            exists=len(categories) > 0,
            version=req_data.version
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_command_info: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/categories', methods=['GET'])
def api_categories() -> Union[Response, Tuple[Response, int]]:
    """Get all available categories for a Redis version."""
    try:
        version = request.args.get('version', 'redis8')
        if version not in PARSERS:
            raise ValueError(f'Invalid Redis version: {version}. Must be "redis7" or "redis8"')

        parser = get_parser(version)
        category_info = parser.get_category_info()

        # Convert category_info to nested dict format expected by Pydantic
        # From Dict[str, int] to Dict[str, Dict[str, int]]
        formatted_category_info: Dict[str, Dict[str, int]] = {
            cat: {"command_count": count}
            for cat, count in category_info.items()
        }

        response = CategoriesResponse(
            success=True,
            version=version,
            categories=sorted(list(category_info.keys())),
            category_info=formatted_category_info,
            total_categories=len(category_info)
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_categories: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/search-commands', methods=['POST'])
def api_search_commands() -> Union[Response, Tuple[Response, int]]:
    """Search for commands matching a pattern."""
    try:
        req_data = validate_pydantic_request(SearchCommandsRequest)

        parser = get_parser(req_data.version)
        matching_commands = parser.search_commands(req_data.pattern)

        # Limit results and add category info
        limited_results = matching_commands[:req_data.limit]
        results_with_categories: List[CommandSearchResult] = []

        for cmd in limited_results:
            results_with_categories.append(CommandSearchResult(
                command=cmd,
                categories=parser.get_command_categories(cmd)
            ))

        response = SearchCommandsResponse(
            success=True,
            pattern=req_data.pattern,
            results=results_with_categories,
            total_matches=len(matching_commands),
            showing=len(limited_results),
            version=req_data.version
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_search_commands: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/validate-rule', methods=['POST'])
def api_validate_rule() -> Union[Response, Tuple[Response, int]]:
    """Validate ACL rule syntax."""
    try:
        req_data = validate_pydantic_request(ValidateRuleRequest)

        parser = get_parser(req_data.version)
        is_valid, errors = parser.validate_rule_syntax(req_data.rule)

        response = ValidateRuleResponse(
            success=True,
            rule=req_data.rule,
            is_valid=is_valid,
            errors=errors,
            version=req_data.version
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_validate_rule: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/analyze-redundancy', methods=['POST'])
def api_analyze_redundancy() -> Union[Response, Tuple[Response, int]]:
    """Analyze ACL rule for redundant terms and optimization opportunities."""
    try:
        req_data = validate_pydantic_request(AnalyzeRedundancyRequest)

        parser = get_parser(req_data.version)
        analysis = parser.analyze_rule_redundancy(req_data.rule)

        response = AnalyzeRedundancyResponse(
            success=True,
            rule=req_data.rule,
            version=req_data.version,
            analysis=analysis
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_analyze_redundancy: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/optimize-rule', methods=['POST'])
def api_optimize_rule() -> Union[Response, Tuple[Response, int]]:
    """Find the shortest equivalent ACL rule representation."""
    try:
        req_data = validate_pydantic_request(OptimizeRuleRequest)

        parser = get_parser(req_data.version)
        optimization = parser.optimize_rule(req_data.rule)

        response = OptimizeRuleResponse(
            success=True,
            original_rule=optimization['original_rule'],
            optimized_rule=optimization['optimized_rule'],
            original_term_count=optimization['original_term_count'],
            optimized_term_count=optimization['optimized_term_count'],
            savings=optimization['savings'],
            granted_commands=optimization['granted_commands'],
            explanation=optimization['explanation'],
            optimization_type=optimization.get('optimization_type'),
            version=req_data.version
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_optimize_rule: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/test-command-key', methods=['POST'])
def api_test_command_key() -> Union[Response, Tuple[Response, int]]:
    """Test if a command on a specific key is allowed (integrated command+key testing)."""
    try:
        req_data = validate_pydantic_request(TestCommandKeyRequest)

        parser = get_parser(req_data.version)

        # Validate rule syntax
        is_valid, errors = parser.validate_rule_syntax(req_data.rule)
        if not is_valid:
            return handle_api_error(f"Invalid ACL rule: {'; '.join(errors)}")

        # Parse rule
        parsed_rule = parser.parse_acl_rule(req_data.rule)

        # Test command permission (now returns selector_index)
        is_command_granted, command_explanation, command_categories, selector_index = parser.test_command_access(req_data.command, parsed_rule)

        # Test key access (pass selector_index to ensure key patterns match the permission set that granted the command)
        is_allowed, key_reason, matched_pattern, permission_type = parser.test_key_access(
            req_data.key, req_data.command, parsed_rule, selector_index
        )

        # Determine overall access
        key_access_granted = is_allowed
        overall_allowed = is_command_granted and is_allowed

        # Build comprehensive explanation
        if not is_command_granted:
            reason = f"Command {req_data.command.upper()} is not granted by ACL rule. {command_explanation}"
        elif not is_allowed:
            reason = f"Command {req_data.command.upper()} is granted, but key access denied: {key_reason}"
        else:
            reason = f"Access granted: {command_explanation} AND {key_reason}"

        response = TestCommandKeyResponse(
            success=True,
            command=req_data.command.upper(),
            key=req_data.key,
            is_allowed=overall_allowed,
            command_granted=is_command_granted,
            key_access_granted=key_access_granted,
            reason=reason,
            matched_pattern=matched_pattern,
            permission_type=permission_type,
            command_categories=command_categories,
            version=req_data.version
        )
        return jsonify(response.model_dump())

    except ValueError as e:
        return handle_api_error(str(e))
    except Exception as e:
        logger.error(f"Error in api_test_command_key: {str(e)}")
        return handle_api_error(f"Internal error: {str(e)}", 500)

@app.route('/api/check-updates', methods=['GET'])
def check_updates() -> Response:
    """
    Check for Docker image updates on Docker Hub.

    Returns version information and upgrade commands if update is available.
    """
    try:
        from helpers.version_checker import check_docker_updates

        result = check_docker_updates()
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error checking for updates: {str(e)}")
        return jsonify({
            "error": f"Error checking for updates: {str(e)}",
            "current_version": __version__
        })

@app.route('/health')
def health_check() -> Response:
    """Health check endpoint."""
    response = HealthResponse(
        status='healthy',
        redis_versions=list(PARSERS.keys()),
        total_commands={
            version: len(parser.data['commands'])
            for version, parser in PARSERS.items()
        }
    )
    return jsonify(response.model_dump())

@app.errorhandler(404)
def not_found(_error: Any) -> Tuple[Response, int]:
    """Handle 404 errors."""
    response = ErrorResponse(
        error=True,
        message='Endpoint not found',
        status_code=404
    )
    return jsonify(response.model_dump()), 404

@app.errorhandler(500)
def internal_error(_error: Any) -> Tuple[Response, int]:
    """Handle 500 errors."""
    logger.error(f"Internal server error: {str(_error)}")
    response = ErrorResponse(
        error=True,
        message='Internal server error',
        status_code=500
    )
    return jsonify(response.model_dump()), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🔐 Redis ACL Builder Starting Up")
    print("="*60)
    print(f"✅ Redis 7: {len(REDIS_DATA['redis7']['commands'])} commands, {len(REDIS_DATA['redis7']['categories'])} categories")
    print(f"✅ Redis 8: {len(REDIS_DATA['redis8']['commands'])} commands, {len(REDIS_DATA['redis8']['categories'])} categories")
    print(f"🌐 Server starting at http://localhost:{DEFAULT_PORT}")
    print("="*60 + "\n")
    
    app.run(debug=DEBUG_MODE, host='0.0.0.0', port=DEFAULT_PORT)