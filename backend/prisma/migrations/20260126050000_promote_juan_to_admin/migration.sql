-- Promote juan.k.chacon9729@gmail.com to ADMIN (Platform Owner)
UPDATE "User"
SET "platformRole" = 'ADMIN'
WHERE email = 'juan.k.chacon9729@gmail.com';
