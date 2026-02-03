#!/usr/bin/env python3
import os
import sys
import subprocess
import signal
import time

# Add worker directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from utils.logger import setup_logger
from services.database import test_connection

# Load environment variables
load_dotenv()

logger = setup_logger(__name__)

processes = []

def signal_handler(sig, frame):
    """Handle shutdown gracefully"""
    logger.info('Shutting down workers...')
    for p in processes:
        p.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def start_consumers():
    """Start all consumer processes"""
    
    # Test database connection first
    logger.info('Testing database connection...')
    if not test_connection():
        logger.error('Cannot start workers without database connection')
        sys.exit(1)
    
    # Get the worker directory path
    worker_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Set PYTHONPATH to include worker directory
    env = os.environ.copy()
    env['PYTHONPATH'] = worker_dir
    
    consumers = [
        ('Email Consumer', 'consumers/email_consumer.py'),
        ('Payment Consumer', 'consumers/payment_consumer.py'),
        ('CME Consumer', 'consumers/cme_consumer.py'),
    ]
    
    for name, script in consumers:
        logger.info(f'Starting {name}...')
        p = subprocess.Popen(
            [sys.executable, script],
            env=env,  # Pass environment with PYTHONPATH
            cwd=worker_dir  # Set working directory
        )
        processes.append(p)
        time.sleep(1)  # Stagger startup
    
    logger.info(f'✅ All {len(consumers)} workers started successfully')
    logger.info('Press Ctrl+C to stop all workers')
    
    # Wait for all processes
    for p in processes:
        p.wait()

if __name__ == '__main__':
    logger.info('='*60)
    logger.info('CHT Platform Worker Service')
    logger.info('='*60)
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"Database: {os.getenv('DATABASE_URL', 'Not configured')[:50]}...")
    logger.info('='*60)
    
    start_consumers()
