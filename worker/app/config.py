import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    AWS_REGION: str = "us-east-1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/cht_platform"
    )
    
    # SQS Queue URLs
    SQS_EMAIL_QUEUE_URL: str = os.getenv("SQS_EMAIL_QUEUE_URL", "")
    SQS_PAYMENT_QUEUE_URL: str = os.getenv("SQS_PAYMENT_QUEUE_URL", "")
    SQS_CME_QUEUE_URL: str = os.getenv("SQS_CME_QUEUE_URL", "")
    
    # External Services
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    SENDGRID_FROM_EMAIL: str = os.getenv("SENDGRID_FROM_EMAIL", "noreply@chtplatform.com")
    
    # S3 Configuration
    S3_BUCKET_CERTIFICATES: str = os.getenv("S3_BUCKET_CERTIFICATES", "")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()