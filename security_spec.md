# Security Specification for PM-Surya Ghar Solar App

## Data Invariants
- A user can only read and write their own profile.
- The `uid` in the profile must match the authenticated user's `uid`.
- Timestamps must be valid server timestamps.

## The Dirty Dozen (Test Payloads)

1. **Identity Theft**: Update another user's profile by changing `uid` in the path.
2. **UID Spoofing**: `create` a profile with a `uid` that doesn't match `request.auth.uid`.
3. **Malicious Fields**: Inject `isAdmin: true` into the user profile.
4. **Large Payload**: Attempt to write a 1MB string into `displayName`.
5. **PII Leak**: Read another user's private data.
6. **Path Poisoning**: Use a document ID longer than 128 characters or with invalid characters.
7. **Type Mismatch**: Send a string for `unitsConsumed`.
8. **Invalid Enum**: Set `systemType` to `nuclear`.
9. **Timestamp Forgery**: Provide a client-side date for `updatedAt`.
10. **Immutable Field Change**: Try to change the `uid` after creation.
11. **Orphaned Write**: Create a profile without required `email`.
12. **Blind List**: Query `/users` without a `where` clause on `uid`.

## Test Plan
- Verify that `allow list` explicitly checks `resource.data.uid == request.auth.uid`.
- Verify that `isValidUserProfile` helper is used on both create and update.
- Verify that `affectedKeys().hasOnly()` is used for updates.
