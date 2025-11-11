"""
Pydantic models for API request/response validation
Provides type-safe API contracts with automatic validation
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional, Literal


class RedisVersionMixin(BaseModel):
    """Mixin for Redis version and mode validation"""
    version: str = Field(default="redis8", description="Redis version (redis7 or redis8)")
    mode: Literal['oss', 'enterprise'] = Field(default="oss", description="Redis mode (oss or enterprise)")

    @field_validator('version')
    @classmethod
    def validate_version(cls, v: str) -> str:
        """Validate Redis version is supported"""
        if v not in ['redis7', 'redis8']:
            raise ValueError(f'Invalid Redis version: {v}. Must be "redis7" or "redis8"')
        return v

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        """Validate Redis mode is supported"""
        if v not in ['oss', 'enterprise']:
            raise ValueError(f'Invalid Redis mode: {v}. Must be "oss" or "enterprise"')
        return v


# === Request Models ===

class ParseACLRequest(RedisVersionMixin):
    """Request model for /api/parse endpoint"""
    rule: str = Field(description="ACL rule to parse")

    @field_validator('rule')
    @classmethod
    def validate_rule(cls, v: str) -> str:
        """Validate and normalize rule"""
        # Pydantic already validates type
        # Empty rules are allowed (Redis default: all commands blocked)
        return v.strip()


class TestCommandRequest(RedisVersionMixin):
    """Request model for /api/test-command endpoint"""
    rule: str = Field(description="ACL rule to evaluate")
    command: str = Field(description="Command to test", min_length=1)

    @field_validator('command')
    @classmethod
    def validate_command(cls, v: str) -> str:
        """Validate and normalize command"""
        v = v.strip()
        if not v:
            raise ValueError('Command cannot be empty')
        return v


class CommandInfoRequest(RedisVersionMixin):
    """Request model for /api/command-info endpoint"""
    command: str = Field(description="Command to get info for", min_length=1)

    @field_validator('command')
    @classmethod
    def validate_command(cls, v: str) -> str:
        """Validate and normalize command"""
        v = v.strip()
        if not v:
            raise ValueError('Command cannot be empty')
        return v


class SearchCommandsRequest(RedisVersionMixin):
    """Request model for /api/search-commands endpoint"""
    pattern: str = Field(description="Search pattern", min_length=1)
    limit: int = Field(default=50, description="Maximum results to return", ge=1, le=1000)

    @field_validator('pattern')
    @classmethod
    def validate_pattern(cls, v: str) -> str:
        """Validate and normalize search pattern"""
        v = v.strip()
        if not v:
            raise ValueError('Search pattern cannot be empty')
        return v


class ValidateRuleRequest(RedisVersionMixin):
    """Request model for /api/validate-rule endpoint"""
    rule: str = Field(description="ACL rule to validate")


class AnalyzeRedundancyRequest(RedisVersionMixin):
    """Request model for /api/analyze-redundancy endpoint"""
    rule: str = Field(description="ACL rule to analyze")


class OptimizeRuleRequest(RedisVersionMixin):
    """Request model for /api/optimize-rule endpoint"""
    rule: str = Field(description="ACL rule to optimize")


class TestCommandKeyRequest(RedisVersionMixin):
    """Request model for /api/test-command-key endpoint - integrated command+key testing"""
    rule: str = Field(description="ACL rule to evaluate")
    command: str = Field(description="Redis command (e.g., GET, SET)", min_length=1)
    key: str = Field(description="Key name to test (e.g., user:123, cache:*)", min_length=1)

    @field_validator('command')
    @classmethod
    def validate_command(cls, v: str) -> str:
        """Validate and normalize command"""
        v = v.strip()
        if not v:
            raise ValueError('Command cannot be empty')
        return v

    @field_validator('key')
    @classmethod
    def validate_key(cls, v: str) -> str:
        """Validate and normalize key"""
        v = v.strip()
        if not v:
            raise ValueError('Key cannot be empty')
        return v


# === Response Models ===

class ErrorResponse(BaseModel):
    """Standard error response format"""
    error: bool = Field(default=True, description="Error flag")
    message: str = Field(description="Error message")
    status_code: int = Field(description="HTTP status code")


class ParseACLResponse(BaseModel):
    """Response model for /api/parse endpoint"""
    success: bool = Field(default=True)
    granted_commands: List[str] = Field(description="List of granted commands")
    blocked_commands: List[str] = Field(default_factory=list, description="List of blocked commands (all commands minus granted)")
    grouped_commands: Dict[str, List[str]] = Field(description="Commands grouped by category")
    total_granted: int = Field(description="Total number of granted commands")
    total_available: int = Field(description="Total number of available commands")
    parsed_rule: Dict[str, Any] = Field(description="Parsed ACL rule structure with root_permissions and selectors")
    impact_summary: Dict[str, Any] = Field(description="Summary of rule impact")
    version: str = Field(description="Redis version used")
    # NEW: Category analysis fields
    granted_categories: List[str] = Field(default_factory=list, description="Categories where all commands are granted")
    partial_categories: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Categories with partial command grants")
    blocked_categories: List[str] = Field(default_factory=list, description="Categories with no commands granted")


class TestCommandResponse(BaseModel):
    """Response model for /api/test-command endpoint"""
    success: bool = Field(default=True)
    command: str = Field(description="Command that was tested")
    is_granted: bool = Field(description="Whether command is granted")
    explanation: str = Field(description="Explanation of result")
    categories: List[str] = Field(description="Categories the command belongs to")
    version: str = Field(description="Redis version used")


class CommandInfoResponse(BaseModel):
    """Response model for /api/command-info endpoint"""
    success: bool = Field(default=True)
    command: str = Field(description="Command queried")
    categories: List[str] = Field(description="Categories the command belongs to")
    exists: bool = Field(description="Whether command exists")
    version: str = Field(description="Redis version used")


class CategoryInfo(BaseModel):
    """Information about a Redis category"""
    command_count: int = Field(description="Number of commands in category")


class CategoriesResponse(BaseModel):
    """Response model for /api/categories endpoint"""
    success: bool = Field(default=True)
    version: str = Field(description="Redis version")
    categories: List[str] = Field(description="List of category names")
    category_info: Dict[str, Dict[str, int]] = Field(description="Detailed category information")
    total_categories: int = Field(description="Total number of categories")


class CommandSearchResult(BaseModel):
    """Single command search result"""
    command: str = Field(description="Command name")
    categories: List[str] = Field(description="Categories the command belongs to")


class SearchCommandsResponse(BaseModel):
    """Response model for /api/search-commands endpoint"""
    success: bool = Field(default=True)
    pattern: str = Field(description="Search pattern used")
    results: List[CommandSearchResult] = Field(description="Search results")
    total_matches: int = Field(description="Total number of matches")
    showing: int = Field(description="Number of results returned")
    version: str = Field(description="Redis version used")


class ValidateRuleResponse(BaseModel):
    """Response model for /api/validate-rule endpoint"""
    success: bool = Field(default=True)
    rule: str = Field(description="Rule that was validated")
    is_valid: bool = Field(description="Whether rule is valid")
    errors: List[str] = Field(description="Validation errors if any")
    version: str = Field(description="Redis version used")


class AnalyzeRedundancyResponse(BaseModel):
    """Response model for /api/analyze-redundancy endpoint"""
    success: bool = Field(default=True)
    rule: str = Field(description="Rule that was analyzed")
    version: str = Field(description="Redis version used")
    analysis: Dict[str, Any] = Field(description="Redundancy analysis results")


class OptimizeRuleResponse(BaseModel):
    """Response model for /api/optimize-rule endpoint"""
    success: bool = Field(default=True)
    original_rule: str = Field(description="Original ACL rule")
    optimized_rule: str = Field(description="Optimized ACL rule")
    original_term_count: int = Field(description="Number of terms in original rule")
    optimized_term_count: int = Field(description="Number of terms in optimized rule")
    savings: int = Field(description="Number of terms saved")
    granted_commands: List[str] = Field(description="Commands granted by the rule")
    explanation: str = Field(description="Explanation of the optimization")
    optimization_type: Optional[str] = Field(default=None, description="Type of optimization applied")
    version: str = Field(description="Redis version used")


class HealthResponse(BaseModel):
    """Response model for /health endpoint"""
    status: str = Field(description="Health status")
    redis_versions: List[str] = Field(description="Supported Redis versions")
    total_commands: Dict[str, int] = Field(description="Command counts per version")


class TestCommandKeyResponse(BaseModel):
    """Response model for /api/test-command-key endpoint - integrated command+key testing"""
    success: bool = Field(default=True)
    command: str = Field(description="Command that was tested")
    key: str = Field(description="Key that was tested")
    is_allowed: bool = Field(description="Whether the command on this key is allowed")
    command_granted: bool = Field(description="Whether the command itself is granted by ACL")
    key_access_granted: bool = Field(description="Whether the key pattern allows this access")
    reason: str = Field(description="Human-readable explanation")
    matched_pattern: Optional[str] = Field(default=None, description="Key pattern that matched (if any)")
    permission_type: Optional[str] = Field(default=None, description="Permission type (read-only, write-only, read-write)")
    command_categories: List[str] = Field(description="Categories the command belongs to")
    version: str = Field(description="Redis version used")
