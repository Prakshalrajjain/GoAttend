
from backend.database import get_connection

try:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_user")
            result = cursor.fetchone()
            print("Database connected successfully!")
            print("Database:", result[0])
            print("User:", result[1])
except Exception as error:
    print("Database connection failed.")
    print(error)
