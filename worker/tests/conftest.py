"""Pytest configuration and fixtures."""
import os
import sys

# Ensure worker root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
