## Continuing a numbered list

Picking up where the previous section left off, so this list starts at seven
rather than one:

7. Validate the incoming payload against the schema before touching the database.
8. Wrap the write in a transaction so a partial failure rolls back cleanly.
9. Emit a domain event *after* the transaction commits, never inside it.
10. Return the created resource with its canonical URL in the `Location` header.

The off-by-one that bites people here is emitting the event inside the
transaction: if the commit later fails, subscribers have already reacted to a
change that never happened.
