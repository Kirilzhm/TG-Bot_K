import { Markup } from "telegraf";

async function showProductCard(ctx, product) {
    await ctx.answerCbQuery();
    let ageText = '';
    if (product.age_category === 1) ageText = 'Діти';
    else if (product.age_category === 2) ageText = 'Підлітки';
    else if (product.age_category === 3) ageText = 'Дорослі';

    let caption = `<b>${product.title}</b>\n`;

    if (ageText) {
        caption += `<b>${ageText}</b>\n\n`;
    }

    caption += `${product.description}\n\n`;

    if (product.demo_link) {
        caption += `Безкоштовно один з уроків для ознайомлення з форматом 👉  <a href="${product.demo_link}">${product.demo_link}</a>\n\n`;
    }

    caption += `Price: ${product.price} uah\n\nЩоб придбати натисніть кнопку нижче👇`;

    const backCallback = product.type === 'avtentyka' 
        ? 'avtentyka' 
        : `rLvl_${product.age_category}_${product.level}`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💳 Придбати', `buy_${product.id}`)],
        [Markup.button.callback('⬅️ Назад до списку', backCallback)]
    ]);

    let photosArray = [];
    try {
        photosArray = JSON.parse(product.photo); 
    } catch (e) {
        console.error('Помилка парсингу фото:', e);
    }

    if (photosArray.length === 1) {
        return ctx.replyWithPhoto(photosArray[0], {
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup
        });
    }

    const mediaGroup = photosArray.map((photoID) => ({
        type: 'photo',
        media: photoID,
    }));

    await ctx.replyWithMediaGroup(mediaGroup);

    return ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
        disable_web_page_preview: true
    });
}

export default showProductCard;