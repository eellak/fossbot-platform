from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_hashed(plain_text, hashed_text):
    return pwd_context.verify(plain_text, hashed_text)

def get_hashed(text):
    return pwd_context.hash(text)