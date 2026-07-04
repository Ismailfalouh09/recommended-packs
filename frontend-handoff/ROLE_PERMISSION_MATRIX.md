# Role Permission Matrix

## OWNER

- Can log in and call `GET /auth/me`.
- Can read all admin pages.
- Can create, update, archive, deactivate, reorder, and delete supported admin resources.
- Can upload, replace, reorder, update, and delete catalog media.
- Can update order status.
- Can preview recommendations from admin tools.

## ADMIN

- Same operational permissions as `OWNER` for the currently implemented backend.
- Can read all admin pages.
- Can create, update, archive, deactivate, reorder, and delete supported admin resources.
- Can upload, replace, reorder, update, and delete catalog media.
- Can update order status.
- Can preview recommendations from admin tools.

## STAFF

- Can log in and call `GET /auth/me`.
- Can read admin catalog, pack, quiz, recommendation-rule, order, and media list/detail endpoints.
- Can preview recommendations with `POST /admin/recommendation-rules/preview`.
- Cannot create, update, archive, deactivate, reorder, upload, delete, or update order status.

## Summary

| Area | OWNER | ADMIN | STAFF |
| --- | --- | --- | --- |
| Auth login/me | Yes | Yes | Yes |
| Admin list/detail reads | Yes | Yes | Yes |
| Catalog writes | Yes | Yes | No |
| Product reference stock update | Yes | Yes | No |
| Pack writes | Yes | Yes | No |
| Quiz/attribute/rule writes | Yes | Yes | No |
| Recommendation preview | Yes | Yes | Yes |
| Order status update | Yes | Yes | No |
| Media upload/replace/update/reorder/delete | Yes | Yes | No |
