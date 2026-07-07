# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
db.users.getIndexes()
```
- bcrypt hash must start with `$2b$`.
- indexes: users.email unique, login_attempts.identifier, password_reset_tokens.expires_at TTL.

## Step 2: API testing (uses httpOnly cookies)
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kirana.local","password":"admin123"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
```
Login must return the user (no password_hash) and set access_token + refresh_token cookies.
`/me` must return the same user using the cookie.
