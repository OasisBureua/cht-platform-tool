#!/usr/bin/env python3
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing imports...")

try:
    from utils.logger import setup_logger
    print("✅ utils.logger imported")
except ImportError as e:
    print(f"❌ utils.logger failed: {e}")

try:
    from services.email_service import EmailService
    print("✅ services.email_service imported")
except ImportError as e:
    print(f"❌ services.email_service failed: {e}")

try:
    os.environ['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/cht_platform'
    from services.database import get_db_session
    print("✅ services.database imported")
except ImportError as e:
    print(f"❌ services.database failed: {e}")

try:
    from consumers.email_consumer import EmailConsumer
    print("✅ consumers.email_consumer imported")
except ImportError as e:
    print(f"❌ consumers.email_consumer failed: {e}")

try:
    from consumers.payment_consumer import PaymentConsumer
    print("✅ consumers.payment_consumer imported")
except ImportError as e:
    print(f"❌ consumers.payment_consumer failed: {e}")

try:
    from consumers.cme_consumer import CMEConsumer
    print("✅ consumers.cme_consumer imported")
except ImportError as e:
    print(f"❌ consumers.cme_consumer failed: {e}")

print("\nAll import tests complete!")
