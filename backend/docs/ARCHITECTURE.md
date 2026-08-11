
#### ARCHITECTURE

```markdown
# System Architecture Specification

## Work Flow



## Agent State Schema
The state graph holds conversation history and booking details across reasoning cycles.

```python
{
  "messages": [],
  "customer_id": "string",
  "selected_service": "string",
  "selected_barber": "string",
  "appointment_time": "ISO-8601 string",
  "is_confirmed": false
}
