"""Optional script to create a test user."""
import sys
from database import SessionLocal
from models import User
from auth import get_password_hash

def create_test_user(email: str = "test@example.com", password: str = "testpass123", full_name: str = "Test User"):
    """Create a test user in the database."""
    db = SessionLocal()
    try:
        # Check if user exists
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User with email {email} already exists!")
            return
        
        # Create user
        hashed_password = get_password_hash(password)
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name
        )
        db.add(user)
        db.commit()
        print(f"✓ Created test user: {email}")
        print(f"  Password: {password}")
    except Exception as e:
        print(f"Error creating user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        email = sys.argv[1]
        password = sys.argv[2] if len(sys.argv) > 2 else "testpass123"
        full_name = sys.argv[3] if len(sys.argv) > 3 else "Test User"
        create_test_user(email, password, full_name)
    else:
        create_test_user()

