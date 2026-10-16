-- Columnas que el código ya usa en shopping_items (Súper: category, Feria: quantity)
alter table shopping_items
  add column if not exists category text,
  add column if not exists quantity text;
