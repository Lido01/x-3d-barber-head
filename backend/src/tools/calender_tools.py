import sqlite3
from langchain_core.tools import tool

@tool
def check_availability(barber_name: str) -> str:
    """Use this tool to check available booking slots for a specific barber."""
    conn = sqlite3.connect("barber_shop.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT time_slot FROM schedules WHERE barber_name LIKE ? AND is_booked = 0",
        (f"%{barber_name}%",)
    )
    slots = cursor.fetchall()
    conn.close()
    
    if not slots:
        return f"No open slots found for {barber_name}."
    
    available_times = ", ".join([slot[0] for slot in slots])
    return f"Available slots for {barber_name}: {available_times}"

@tool
def book_appointment(barber_name: str, time_slot: str, customer_name: str) -> str:
    """Use this tool to confirm and lock in a booking slot for a customer."""
    conn = sqlite3.connect("barber_shop.db")
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE schedules SET is_booked = 1 WHERE barber_name LIKE ? AND time_slot LIKE ?",
        (f"%{barber_name}%", f"%{time_slot}%")
    )
    changes = conn.total_changes
    conn.commit()
    conn.close()
    
    if changes > 0:
        return f"Success! Appointment booked with {barber_name} at {time_slot} for {customer_name}."
    return f"Failed to book. Slot {time_slot} with {barber_name} might not exist or is already taken."