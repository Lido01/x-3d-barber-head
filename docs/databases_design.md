# Database Design

## Sample Databases

 ### class Booking(models.Model):   
Customer
   │
   ├── name
   ├── phone
   └── email

Style
   │
   ├── name
   ├── price
   ├── duration
   └── description

Barber
   │
   ├── name
   ├── working hours
   └── available styles

Booking
   │
   ├── customer
   ├── barber
   ├── style
   ├── date
   ├── time
   ├── payment
   └── status

