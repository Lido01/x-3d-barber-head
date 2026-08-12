# System Architecture

## The Flow
                 ┌────────────────────┐
                 │    React Website   │
                 │                    │
                 │ Products           │
                 │ Hair Styles        │
                 │ Booking            │
                 │ AI Chat            │
                 └─────────┬──────────┘
                           │
                           ↓
                 ┌────────────────────┐
                 │    Django API      │
                 │                    │
                 │ Users              │
                 │ Bookings           │
                 │ Styles             │
                 │ Payments           │
                 │ Receipts           │
                 │ Calendar           │
                 └─────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             ↓                           ↓
      ┌──────────────┐            ┌──────────────┐
      │ AI Agent     │            │ PostgreSQL   │
      │              │            │              │
      │ LLM          │            │ Customers    │
      │ Tools        │            │ Bookings     │
      │ Memory       │            │ Payments     │
      │ Reasoning    │            │ Styles       │
      └──────┬───────┘            └──────────────┘
             │
       ┌─────┼─────────┐
       ↓     ↓         ↓
     Email  SMS      Calendar

