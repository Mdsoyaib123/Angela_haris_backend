-- Replace the global email uniqueness constraint with one that applies only to active users.
DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_email_active_key"
ON "User"(LOWER("email"))
WHERE "isDeleted" = false;
