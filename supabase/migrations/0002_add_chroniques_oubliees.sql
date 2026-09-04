-- Adds Chroniques Oubliées as a supported system. ALTER TYPE ... ADD VALUE
-- can't run inside the same transaction as anything that uses the new value,
-- so this is its own migration — run it in the SQL Editor same as 0001.
alter type rpg_system add value if not exists 'Chroniques Oubliées';
