"""
Version checker module for checking Docker Hub updates.
"""

import requests
from packaging import version
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


def check_docker_updates() -> Dict[str, any]:
    """
    Check if newer Docker image exists on Docker Hub.

    Returns:
        dict: {
            "update_available": bool,
            "current_version": str,
            "latest_version": str,
            "docker_pull_command": str,
            "docker_upgrade_command": str,
            "error": str (if error occurred)
        }
    """
    try:
        # Get current version from __init__.py
        from helpers import __version__
        current_version = __version__

        # Parse current version for comparison
        try:
            current_parsed = version.parse(current_version)
        except Exception as e:
            logger.error(f"Error parsing current version '{current_version}': {e}")
            return {
                "error": f"Invalid current version format: {current_version}",
                "current_version": current_version
            }

        # Query Docker Hub API for tags
        logger.info("Checking Docker Hub for latest version...")
        response = requests.get(
            "https://hub.docker.com/v2/repositories/markotrapani608/redis-acl-builder/tags",
            params={"page_size": 25},
            timeout=5
        )

        if response.status_code != 200:
            logger.error(f"Docker Hub API returned status {response.status_code}")
            return {
                "error": f"Docker Hub API error: {response.status_code}",
                "current_version": current_version
            }

        data = response.json()
        tags = data.get('results', [])

        if not tags:
            logger.error("No tags found in Docker Hub response")
            return {
                "error": "No Docker tags found",
                "current_version": current_version
            }

        # Extract semantic versions (exclude 'latest' and non-semantic tags)
        versions = []
        for tag in tags:
            tag_name = tag.get('name', '')
            if tag_name == 'latest':
                continue

            try:
                parsed = version.parse(tag_name)
                versions.append((tag_name, parsed))
            except Exception:
                # Skip non-semantic version tags
                continue

        if not versions:
            logger.error("No valid semantic version tags found")
            return {
                "error": "No valid version tags found",
                "current_version": current_version
            }

        # Find latest version
        latest_tag, latest_parsed = max(versions, key=lambda x: x[1])

        # Check if update is available
        update_available = latest_parsed > current_parsed

        # Generate Docker commands
        docker_pull_command = f"docker pull markotrapani608/redis-acl-builder:{latest_tag}"
        docker_upgrade_command = (
            "docker rm -f redis-acl-builder && "
            f"docker run -d --name redis-acl-builder -p 7380:7380 --restart unless-stopped "
            f"markotrapani608/redis-acl-builder:{latest_tag}"
        )

        result = {
            "update_available": update_available,
            "current_version": current_version,
            "latest_version": latest_tag,
            "docker_pull_command": docker_pull_command,
            "docker_upgrade_command": docker_upgrade_command
        }

        logger.info(f"Version check complete: current={current_version}, latest={latest_tag}, update_available={update_available}")
        return result

    except requests.exceptions.Timeout:
        logger.error("Docker Hub API timeout")
        return {
            "error": "Docker Hub API timeout - check your internet connection",
            "current_version": current_version if 'current_version' in locals() else "unknown"
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Docker Hub API request error: {e}")
        return {
            "error": f"Network error: {str(e)}",
            "current_version": current_version if 'current_version' in locals() else "unknown"
        }
    except Exception as e:
        logger.error(f"Unexpected error checking for updates: {e}")
        return {
            "error": f"Unexpected error: {str(e)}",
            "current_version": current_version if 'current_version' in locals() else "unknown"
        }
