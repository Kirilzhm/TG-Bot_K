import { db } from "./database.js";

console.log('Додаємо тестові дані...');

// 1. Створюємо дві категорії
const cat1 = db.prepare("INSERT INTO categories (name) VALUES ('7-9 років')").run();
const cat2 = db.prepare("INSERT INTO categories (name) VALUES ('10-12 років')").run();

// 2. Додаємо підручники в ці категорії
// lastInsertRowid - це ID щойно створеної категорії
db.prepare(`
    INSERT INTO products (category_id, title, price, download_link, deep_link_code)
    VALUES (?, ?, ?, ?, ?)
`).run(cat1.lastInsertRowid, 'English Grammar A1', 150, 'https://example.com/book1', 'summer_a1');

db.prepare(`
    INSERT INTO products (category_id, title, price, download_link, deep_link_code)
    VALUES (?, ?, ?, ?, ?)
`).run(cat2.lastInsertRowid, 'English File B1', 250, 'https://example.com/book2', null);

console.log('Дані успішно додані! Тепер файл seed.js можна закрити і більше не запускати.');