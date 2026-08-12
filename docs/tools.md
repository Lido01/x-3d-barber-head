# Tools/Function

## The Flow
AI
 ├── search_styles()
 ├── check_available_times()
 ├── create_booking()
 ├── get_booking()
 ├── upload_receipt()
 ├── verify_payment()
 ├── send_email()
 └── send_sms()


```python
{
   def check_available_times(date):
    # query Django database
    # return available times

def get_haircut_styles():
    # query styles
    # return styles

def create_booking(customer, style, date, time):
    # create Django booking
    # return booking ID
}
```


# AI agent could have these tools

## Tool 1 — Search styles
  get_styles()

## Tool 2 — Style details
get_style(style_id)

## Tool 3 — Availability
check_availability(
    date,
    duration
)

## Tool 4 — Create booking
create_booking(
    customer_id,
    style_id,
    date,
    time
)

## Tool 5 — Get booking
get_booking(
    booking_id
)

## Tool 6 — Cancel booking
cancel_booking(
    booking_id
)

## Tool 7 — Send notification
send_notification(
    booking_id,
    channel
)