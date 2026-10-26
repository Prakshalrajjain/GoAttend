
from backend.security import hash_password, verify_password

password = "ExamplePassword123!"
hashed = hash_password(password)

print("Hash created:", hashed != password)
print("Correct password:", verify_password(password, hashed))
print("Wrong password:", verify_password("WrongPassword123!", hashed))
