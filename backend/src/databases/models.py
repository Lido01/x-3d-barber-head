import sqlite3

def init_db():
    conn = sqlite3.connect("barber_shop.db")
    cursor = conn.cursor()
    
    # Create schedules table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barber_name TEXT,
            time_slot TEXT,
            is_booked INTEGER DEFAULT 0
        )
    """)
    
    # Insert sample data if empty
    cursor.execute("SELECT COUNT(*) FROM schedules")
    if cursor.fetchone()[0] == 0:
        sample_slots = [
            ("Dawit", " tomorrow 10:00 AM", 0),
            ("Dawit", " tomorrow 02:00 PM", 0),
            ("Alex", " tomorrow 11:00 AM", 0),
        ]
        cursor.executemany("INSERT INTO schedules (barber_name, time_slot, is_booked) VALUES (?, ?, ?)", sample_slots)
        conn.commit()
        
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized with sample barber slots!")