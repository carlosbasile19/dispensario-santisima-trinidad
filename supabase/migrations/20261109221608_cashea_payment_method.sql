-- Cashea as a payment method. On its own migration: Postgres does not let a
-- new enum value be used in the transaction that adds it, and the next
-- migration uses it in a constraint and in functions.

alter type public.payment_method add value if not exists 'cashea';
