import { categories } from "../database.js";
import { Markup } from "telegraf";

function showCategoriesMenu(ctx) {
    const allCategories = categories.getAll();
    if (allCategories.length === 0) {
        return ctx.reply('На жаль, наразі немає доступних категорій.');
    }
    const buttons = allCategories.map(cat =>
    [Markup.button.callback(cat.name, `cat_${cat.id}`)]
    );

    const messageText = 'Оберіть вікову категорію, яка вас цікавить:';
    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery) {
        return ctx.editMessageText(messageText, keyboard);
    } else {
        return ctx.reply(messageText, keyboard);
    }
};

export default showCategoriesMenu;