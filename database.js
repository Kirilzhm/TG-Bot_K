import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.join(import.meta.dirname, 'database.db');

const db = new Database(dbPath, {
    verbose: console.log
});

function initDB() {
    console.log('Ініціалізація бази даних...');
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            role TEXT DEFAULT 'customer',
            state TEXT DEFAULT 'idle'
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            title TEXT NOT NULL,
            short_title TEXT NOT NULL,
            photo TEXT  NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            level TEXT NOT NULL,
            price REAL NOT NULL,
            age_category INTEGER,
            demo_link TEXT UNIQUE DEFAULT NULL,
            download_link TEXT NOT NULL,
            deep_link_code TEXT UNIQUE DEFAULT NULL,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(telegram_id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    `);

    console.log('Таблиці успішно створені!');
}

initDB();

// --- Хелпер Користувачі ---
const userHelpers = {
    getOrCreate: (telegram_id) => {
        let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        if (!user) {
            db.prepare('INSERT INTO users (telegram_id) VALUES (?)').run(telegram_id);
            user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        }
        return user;
    },
    setState: (telegram_id, state) => {
        db.prepare('UPDATE users SET state = ? WHERE telegram_id = ?').run(state, telegram_id);
    }
};

// --- Хелпер Категорії ---
const categoryHelpers = {
    getAll: () => db.prepare('SELECT * FROM categories').all(),
    add: (name) => db.prepare('INSERT INTO categories (name) VALUES (?)').run(name)
};

// --- Хелпер Товари ---
const productHelpers = {
    getByCategory: (category_id) => {
        return db.prepare('SELECT * FROM products WHERE category_id = ?').all(category_id);
    },
    getById: (id) => db.prepare('SELECT * FROM products WHERE id = ?').get(id),
    getByDeepLinkCode: (code) => db.prepare('SELECT * FROM products WHERE deep_link_code = ?').get(code),
    getByType: (type) => db.prepare('SELECT id, title, short_title, level, age_category FROM products WHERE type = ?').all(type),
    getByAge: (age_category) => db.prepare('SELECT id, title FROM products WHERE age_category = ?').all(age_category),
    getLevelsByAgeAndType: (ageCategory, type) => db.prepare('SELECT DISTINCT level FROM products WHERE age_category = ? AND type = ?').all(ageCategory, type),
    getProductsByAgeAndLevel: (ageCategory, level, type) => db.prepare('SELECT id, title, price FROM products WHERE age_category = ? AND level = ? AND type = ?').all(ageCategory, level, type),
    add: (category_id, title, short_title, photo, type, description, level, age_category = null, price, demo_link = null, download_link, deep_link_code = null) => {
        return db.prepare(`
            INSERT INTO products 
            (category_id, title, short_title, photo, type, description, level, age_category, price, demo_link, download_link, deep_link_code) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(category_id, title, short_title, photo, type, description, level, age_category, price, demo_link, download_link, deep_link_code);
    },
    delete: (id) => db.prepare('DELETE FROM products WHERE id = ?').run(id),
    update: (id, field, value) => {
        const allowedField = [
            'title', 'short_title', 'photo', 'description', 
            'level', 'price', 'age_category', 'demo_link', 'download_link'
        ];
        if (!allowedField.includes(field)) {
            throw new Error('Недозволене поле для оновлення');
        }
        return db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).run(value, id);
    }
};

// --- Хелпер Замовлення ---
const orderHelpers = {
    create: (user_id, product_id, amount) => {
        const result = db.prepare(
            'INSERT INTO orders (user_id, product_id, amount) VALUES (?, ?, ?)'
        ).run(user_id, product_id, amount);
        return result.lastInsertRowid;
    },
    updateStatus: (order_id, status) => {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order_id);
    },
    getById: (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
};

export {
    db,
    userHelpers as users,
    categoryHelpers as categories,
    productHelpers as products,
    orderHelpers as orders
};