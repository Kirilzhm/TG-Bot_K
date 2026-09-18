import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';

import { Telegraf, Markup, session, Scenes } from 'telegraf';
import { message } from 'telegraf/filters';

import showProductCard from './showHandlers/showProductCard.js';
import generateSignature from './Helpers/generateSignature.js';

import {
    users,
    categories,
    products,
    orders
} from './database.js';
import { button } from 'telegraf/markup';
import { error, log } from 'console';
import { resolve } from 'dns';

const ADMIN_IDS = process.env.ADMIN_ID
    ? process.env.ADMIN_ID.split(',').map(id => id.trim())
    : [];

const addProductWizard = new Scenes.WizardScene(
    'ADD_PRODUCT_SCENE',

    async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Автентика', 'type_avtentyka')],
            [Markup.button.callback('Розробка підручника', 'type_rozrobka')],
            [Markup.button.callback('Скасувати (вийти)', 'cancel_wizard')]
        ]);
        await ctx.reply('Обери тип товару:👇', keyboard);
        return ctx.wizard.next();
    },

    // -----Крок 1 - Обробка віку-----
    async (ctx) => {
        await ctx.answerCbQuery().catch(() => {});
        if (ctx.callbackQuery?.data === 'cancel_wizard') {
            await ctx.scene.leave();
            return ctx.reply('Додавання товару скасовано.\nЯкі дії?', adminKeyboard);
        }

        const type = ctx.callbackQuery.data.replace('type_', '');
        ctx.wizard.state.type = type;
        await ctx.answerCbQuery().catch(() => {});

        if (type === 'rozrobka') {
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('Діти', 'age_1')],
                [Markup.button.callback('Підлітки', 'age_2')],
                [Markup.button.callback('Дорослі', 'age_3')],
                [Markup.button.callback('⬅️ Назад', 'back_to_0')]
            ]);
            await ctx.reply('Обери вікову категорію:👇', keyboard);
            return ctx.wizard.next();
        } else {
            ctx.wizard.state.age_category = null;
            const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_0')]]);
            await ctx.reply('Введи коротку назву (для кнопки, наприклад "Уроки B1-B2"):', keyboard);
            ctx.wizard.next();
            ctx.wizard.selectStep(3);
            return;
        }
    },

    // ---Крок 2 - Обробка віку-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_0') {
            ctx.wizard.selectStep(0);
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('Автентика', 'type_avtentyka')],
                [Markup.button.callback('Розробка підручника', 'type_rozrobka')],
                [Markup.button.callback('Скасувати (вийти)', 'cancel_wizard')]
            ]);
            await ctx.editMessageText('Обери тип товару:👇', keyboard);
            return;
        }

        if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('age_')) {
            return ctx.reply('Будь ласка, обери категорію кнопкою!');
        }

        ctx.wizard.state.age_category = parseInt(ctx.callbackQuery.data.replace('age_', ''));
        await ctx.answerCbQuery().catch(() => {});

        const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_1')]]);
        await ctx.reply('Введи коротку назву (наприклад "English Grammar A1"):', keyboard);
        return ctx.wizard.next();
    },

    // ---Корк 3 - Коротка назва-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_0' || ctx.callbackQuery?.data === 'back_to_1') {
            if (ctx.wizard.state.type === 'avtentyka') {
                ctx.wizard.selectStep(0);
                const keyboard = Markup.inlineKeyboard([
                    [Markup.button.callback('Автентика', 'type_avtentyka')],
                    [Markup.button.callback('Розробка підручника', 'type_rozrobka')],
                    [Markup.button.callback('🛑 Скасувати (вийти)', 'cancel_wizard')]
                ]);
                await ctx.editMessageText('Обери тип товару:👇', keyboard);
                return;
            } else {
                ctx.wizard.selectStep(1);
                const kb = Markup.inlineKeyboard([
                    [Markup.button.callback('Діти', 'age_1')],
                    [Markup.button.callback('Підлітки', 'age_2')],
                    [Markup.button.callback('Дорослі', 'age_3')],
                    [Markup.button.callback('⬅️ Назад', 'back_to_0')]
                ]);
                await ctx.editMessageText('Обери вікову категорію:👇', kb);
                return;
            }
        }

        if (!ctx.message?.text) return ctx.reply('Надішли текст!');
        ctx.wizard.state.short_title = ctx.message.text;

        const keyboard = Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', 'back_to_2')]);
        await ctx.reply('Введи повну назву товару (для картки):', keyboard);
        return ctx.wizard.next();
    },

    // ---Крок 4 - Повна назва-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_2') {
            ctx.wizard.selectStep(2);
            const kb = Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', ctx.wizard.state.type === 'avtentyka' ? 'back_to_0' : 'back_to_1')]);
            await ctx.editMessageText('Введи коротку назву:', kb);
            return ctx.wizard.selectStep(3);
        }

        if (!ctx.message?.text) return ctx.reply('Надішли текст!');
        ctx.wizard.state.title = ctx.message.text;

        const kb = Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', 'back_to_3')]);
        await ctx.reply('Введи рівень складності (наприклад "B1-B2"):', kb);
        return ctx.wizard.next();
    },

    // ---Крок 5 - Рівень складності-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_3') {
            ctx.wizard.selectStep(3);
            const kb = Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', 'back_to_2')]);
            await ctx.editMessageText('Введи повну назву товару (для картки):', kb);
            return ctx.wizard.selectStep(4);
        }

        if (!ctx.message?.text) return ctx.reply('Надішли текст!');
        ctx.wizard.state.level = ctx.message.text;

        const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_4')]]);
        await ctx.reply('Надішли опис товару:', keyboard);
        return ctx.wizard.next();
    },

    // ---Крок 6 - Опис-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_4') {
            ctx.wizard.selectStep(4);
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_3')]]);
            await ctx.editMessageText('Введи рівень складності (наприклад "B1-B2"):', kb);
            return ctx.wizard.selectStep(5);
        }

        if (!ctx.message?.text) return ctx.reply('Надішли текст!');
        ctx.wizard.state.description = ctx.message.text;

        const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_5')]]);
        await ctx.reply('Надішли фотографії товару.\n(Після завантаження з\'явиться кнопка "Завершити")', keyboard);
        return ctx.wizard.next();
    },

    // ---Крок 7 - Фотографії-----
    async(ctx) => {
        if (!ctx.wizard.state.photos) ctx.wizard.state.photos = [];

        if (ctx.callbackQuery?.data === 'back_to_5') {
            ctx.wizard.state.photos = [];
            ctx.wizard.selectStep(5);
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_4')]]);
            await ctx.editMessageText('Надішли опис товару:', kb);
            return ctx.wizard.selectStep(6);
        }

        if (ctx.callbackQuery?.data === 'done_photos') {
            if (ctx.wizard.state.photos.length === 0) return ctx.answerCbQuery('Завантаж хоча б одне фото!', {show_alert: true});
            await ctx.answerCbQuery().catch(() => {});
            const kb = Markup.inlineKeyboard([
                [Markup.button.callback('⏭ Пропустити', 'skip_demo')],
                [Markup.button.callback('⬅️ Назад', 'back_to_6')]
            ]);
            await ctx.reply('Надішли посилання на ДЕМО (або пропустіть):', kb);
            return ctx.wizard.next();
        }

        if (ctx.message?.photo) {
            const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            ctx.wizard.state.photos.push(photoId);
            const kb = Markup.inlineKeyboard([
                [Markup.button.callback(`✅ Завершити (${ctx.wizard.state.photos.length} фото)`, 'done_photos')],
                [Markup.button.callback('⬅️ Назад', 'back_to_5')]
            ]);
            await ctx.reply(`📸 Фото додано. Надішліть ще або натисніть "Завершити":`, kb);
            return;
        }
    },

    // ---Крок 8 - Демо-посилання-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_6') {
            ctx.wizard.state.photo = [];
            ctx.wizard.selectStep(6);
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_5')]]);
            await ctx.editMessageText('Надішли фотографії товару заново:', kb);
            return ctx.wizard.selectStep(7);
        }

        if (ctx.callbackQuery?.data === 'skip_demo') {
            ctx.wizard.state.demo_link = null;
            await ctx.answerCbQuery().catch(() => {});
        } else if (ctx.message?.text) {
            ctx.wizard.state.demo_link = ctx.message.text;
        } else {
            return ctx.reply('Надішли посилання або натисніть "Пропустити"!');
        }

        const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_7')]]);
        await ctx.reply('Введи ціну в грн (наприклад: 300):', keyboard);
        return ctx.wizard.next();
    },

    // ---Крок 9 - Ціна-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_7') {
            ctx.wizard.selectStep(7);
            const kb = Markup.inlineKeyboard([
                [Markup.button.callback('⏭ Пропустити', 'skip_demo')],
                [Markup.button.callback('⬅️ Назад', 'back_to_6')]
            ]);
            await ctx.editMessageText('Надішліть посилання на ДЕМО (або пропустіть):', kb);
            return ctx.wizard.selectStep(8);
        }

        if (!ctx.message?.text) return ctx.reply('Введи ціну числом!');
        const price = parseFloat(ctx.message.text.replace(',', '.'));
        if (isNaN(price)) return ctx.reply('Це не число. Введи ще раз');

        ctx.wizard.state.price = price;
        const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_8')]]);
        await ctx.reply('Надішли посилання, яке бот відправить після оплати', keyboard);
        return ctx.wizard.next();
    },

    // ---Крок 10 - Фінал-----
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'back_to_8') {
            ctx.wizard.selectStep(8);
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_7')]]);
            await ctx.editMessageText('Введи ціну в грн:', kb);
            return ctx.wizard.selectStep(9);
        }

        if (!ctx.message?.text) return ctx.reply('Надішли посиланя!');
        ctx.wizard.state.downoal_link = ctx.message.text;

        const state = ctx.wizard.state;
        const photoJson = JSON.stringify(state.photos);

        products.add(
            null, state.title, state.short_title, photoJson, state.type, state.description, state.level, state.age_category, state.price, state.demo_link, state.downoal_link
        );

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('Повернутись в меню', 'back_to_admin_Menu')]
        ])
        await ctx.reply(
    `🎉 **Товар успішно додано!**\n🔹 Назва: ${state.title}\n🔹 Ціна: ${state.price} грн`, 
    { 
        parse_mode: 'Markdown', 
        ...kb 
    }
);
        return ctx.scene.leave();
    }
);

const editProductWizard = new Scenes.WizardScene(
    'EDIT_PRODUCT_SCENE',

    async (ctx) => {
        const {prodId, field} = ctx.scene.state;
        let promptText = `Введи нове значення для поля "${field}":`;
        
        if (field === 'title') {
            promptText = 'Надішліть нову назву:';
        } else if (field === 'short_title') {
            promptText = 'Надішліть нову назву для кнопок:';
        }else if (field === 'photo') {
            promptText = 'Надішліть нове фото товару:';
            ctx.wizard.state.newPhotos = [];
        } else if (field === 'description') {
            promptText = 'Надішліть новий опис:';
        } else if (field === 'level') {
            promptText = 'Надішліть новий рівень:';
        } else if (field === 'price') {
            promptText = 'Введи нову ціну числом (наприклад: 350):';
        }else if (field === 'age_category') {
            promptText = 'Введи цифру вікової категорії:\n1 - Діти\n2 - Підлітки\n3 - Дорослі';
        } else if (field === 'demo_link') {
            promptText = 'Надішли нове посилання на демо.\n(Щоб видалити демо, надішли мінус: "-")';
        } else if (field === 'download_link') {
            promptText = 'Надішли нове посилання яке буде після оплати';
        }

        const kb = Markup.inlineKeyboard([[Markup.button.callback('Скасувати', 'cancel_edit')]]);
        await ctx.reply(promptText, kb);
        return ctx.wizard.next();
    },

    async (ctx) => {
        if (ctx.callbackQuery?.data === 'cancel_edit') {
            const btnToMenu = [Markup.button.callback('В меню', 'back_to_adminMenu')]
            await ctx.answerCbQuery().catch(() => {});
            await ctx.reply('Зміну скасовано.', Markup.inlineKeyboard(btnToMenu));
            return ctx.scene.leave();
        }

        const {prodId, field} = ctx.scene.state;
        let newValue;

        if (field === 'photo') {
            if (ctx.callbackQuery?.data === 'done_edit_photos') {
                if (ctx.wizard.state.newPhotos.length ===0) {
                    return ctx.answerCbQuery('Завантаж хоча б одне фото!', { show_alert: true });
                }
                await ctx.answerCbQuery().catch(() => {});

                newValue = JSON.stringify(ctx.wizard.state.newPhotos);
                products.update(prodId, field, newValue);
                const kb = Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Повернутись в меню', 'back_to_adminMenu')]
                ]);
                await ctx.reply(`✅ Фото успішно оновлено!`, kb);
                return ctx.scene.leave();
            }

            if (!ctx.message?.photo) {
                return ctx.reply('Будь ласка, надішліть фотографію або натисніть "Завершити"!');
            }
            
            const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                ctx.wizard.state.newPhotos.push(photoId);
                const kb = Markup.inlineKeyboard([
                    [Markup.button.callback(`✅ Завершити (${ctx.wizard.state.newPhotos.length} фото)`, 'done_edit_photos')],
                    [Markup.button.callback('Скасувати', 'cancel_edit')]
                ]);
                await ctx.reply(`Фото додано. Надішліть ще або натисніть "Завершити":`, kb);
                return;
        }

        if (field === 'title') {
            if (!ctx.message?.text) return ctx.reply('Будь ласка, нову надішли назву текстом!')
                newValue = ctx.message?.text;
        } else if (field === 'short_title') {
            if (!ctx.message?.text) return ctx.reply('Будь ласка, нову надішли назву для кнопок текстом!')
                newValue = ctx.message?.text;
        } else if (field === 'description') {
            if (!ctx.message?.text) return ctx.reply('Будь ласка, надішли новий опис текстом!')
                newValue = ctx.message?.text;
        } else if (field === 'level') {
            if (!ctx.message?.text) return ctx.reply('Будь ласка, надішли новий рівень текстом!')
                newValue = ctx.message?.text;
        } else if (field === 'price') {
            if (!ctx.message?.text) return ctx.reply('Надішли ціну числом!');
            newValue = parseFloat(ctx.message.text.replace(',', '.'));
            if (isNaN(newValue)) return ctx.reply('Це не число. Введи ще раз:');
        } else if (field === 'age_category') {
            if (!['1', '2', '3'].includes(ctx.message?.text)) {
                return ctx.reply('Введи 1 (Діти), 2 (Підлітки) або 3 (Дорослі):');
            }
            newValue = parseInt(ctx.message.text);
        } else if (field === 'download_link') {
            if (!ctx.message?.text) return ctx.reply('Надішли текст!');
            newValue = ctx.message?.text;
        } else {
            if (!ctx.message?.text) return ctx.reply('Надішли текст!');
            newValue = ctx.message.text;

            if (field === 'demo_link') {
                newValue = ctx.message.text;
            if (newValue === '-') {
                newValue = null; 
            }
            }
        }

        products.update(prodId, field, newValue);

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Повернутись в меню', 'back_to_adminMenu')]
        ]);
        await ctx.reply(`✅ Поле успішно оновлено!`, kb);
        return ctx.scene.leave();
    }
)

const askQuestionWizzard = new Scenes.WizardScene(
    'ASK_QUESTION_SCENE',
    async (ctx) => {
        const kb = Markup.inlineKeyboard([[Markup.button.callback('🛑 Скасувати', 'cancel_question')]]);
        await ctx.reply('✍️ Напиши своє запитання або повідомлення для адміністратора:', kb);
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.callbackQuery) {
        await ctx.answerCbQuery().catch(() => {});
        }
        if (ctx.callbackQuery?.data === 'cancel_question') {
            await ctx.answerCbQuery().catch(() => {});
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'first_btn')]]);
            await ctx.reply('Скасовано', kb);
            return ctx.scene.leave();
        }

        if (!ctx.message?.text) return ctx.reply('Будь ласка, надішли текстове повідомлення!');

        const userMsg = ctx.message.text;
        const user = ctx.from;

        const adminNotification = 
            `📩 **Нове запитання від користувача!**\n\n` +
            `👤 **Ім'я:** ${user.first_name} ${user.last_name || ''}\n` +
               `🏷 **Юзернейм:** ${user.username ? '@' + user.username : 'немає'}\n` +
            `💬 **Повідомлення:**\n${userMsg}`;

        const safeUsername = user.username ? user.username : 'none';
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('💬 Відповісти', `reply_user_${user.id}_${safeUsername}`)]
        ]);

        for (const adminId of ADMIN_IDS) {
            try {
                await ctx.telegram.sendMessage(adminId, adminNotification, {parse_mode: 'Markdown', ...kb});
            } catch (e) {
                console.error(`Не вдалося надіслати адміну ${adminId}:`, e);
            }
        }

        const kbToMenu = Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'first_btn')]]);
        await ctx.reply('✅ Дякуємо! Твоє повідомлення надіслано. Адміністратор відповість найближчим часом.', kbToMenu);
        return ctx.scene.leave();
    }
);

const replyToUserWizzard = new Scenes.WizardScene(
    'REPLY_TO_USER_SCENE',

    async (ctx) => {
        ctx.wizard.state.targetUserId = ctx.scene.state.targetUserId;
        const {targetUserdId, targetUsername} = ctx.scene.state;
        const usernameText = (targetUsername && targetUsername !== 'none') ? `@${targetUsername}` : 'немає';
        const kb = Markup.inlineKeyboard([[Markup.button.callback('🛑 Скасувати', 'cancel_reply')]]);
        await ctx.reply(`✍️ Введи текст відповіді для користувача (Юзернейм: ${usernameText}):`, kb);
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (ctx.callbackQuery?.data === 'cancel_reply') {
            await ctx.answerCbQuery().catch(() => {});
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'back_to_adminMenu')]]);
            await ctx.reply('Відповідь скасовано.', kb);
            return ctx.scene.leave();
        }

        if (!ctx.message?.text) return ctx.reply('Надішли текст відповіді!');

        const targetUserId = ctx.wizard.state.targetUserId;
        const replyText = ctx.message.text;

        try {
            await ctx.telegram.sendMessage(
                targetUserId,
                `💬 **Відповідь від адміністратора:**\n\n${replyText}`,
                { parse_mode: 'Markdown' }
            );
            const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ В меню', 'back_to_adminMenu')]]);
            await ctx.reply('✅ Відповідь успішно надіслано!', kb);
        } catch (e) {
            await ctx.reply(`❌ Не вдалося надіслати (можливо, юзер заблокував бота).\nПомилка: ${e.message}`);
        }
        return ctx.scene.leave();
    }
)

const messageToEveryone = new Scenes.WizardScene(
    'MESSAGE_TO_EVERYONE',
    // ----- Крок 1 -----
    async (ctx) => {
        const kb = Markup.inlineKeyboard([[Markup.button.callback('Скасувати (вийти)', 'cancel_wizard')]])
        await ctx.reply('Надішли все, що хочеш розіслати всім', kb)
        return ctx.wizard.next();
    },
    // ----- Крок 2 -----
    async (ctx) => {
        const confirmKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Так, розіслати', 'send_to_everyone')],
            [Markup.button.callback('❌ Скасувати', 'cancel_wizard')]
        ])
        if (ctx.callbackQuery?.data === 'cancel_wizard') {
            await ctx.answerCbQuery().catch(() => {});
            await ctx.scene.leave();
            return ctx.reply('Розсилку скасовано.\nЯкі дії?', adminKeyboard);
        }
       if (!ctx.message?.media_group_id) {
            ctx.wizard.state.broadcastData = {
                type: 'single',
                messageId: ctx.message.message_id
            };

            await ctx.telegram.copyMessage(ctx.chat.id, ctx.chat.id, ctx.message.message_id);
            await ctx.reply('Ось так це виглядатиме. Розсилати?', confirmKeyboard);
            
            return ctx.wizard.next();
        }

        if (!ctx.wizard.state.mediaGroupIds) ctx.wizard.state.mediaGroupIds = [];

        ctx.wizard.state.mediaGroupIds.push(ctx.message.message_id);

        if (ctx.wizard.state.timer) {
            clearTimeout(ctx.wizard.state.timer);
        }

        ctx.wizard.state.timer = setTimeout(async () => {
            ctx.wizard.state.broadcastData = {
            type: 'album',
            messageIds: ctx.wizard.state.mediaGroupIds
        };
        await ctx.telegram.callApi('copyMessages', {
            chat_id: ctx.chat.id,
            from_chat_id: ctx.chat.id,
            message_ids: ctx.wizard.state.mediaGroupIds
        });

        await ctx.reply('Ось так виглядатиме альбом. Розсилати?', confirmKeyboard);

        return ctx.wizard.next();
        }, 500);
    },
    // ----- Крок 3 -----
    async (ctx) => {
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery().catch(() => {});
        }
        if (ctx.callbackQuery?.data === 'cancel_wizard') {
            await ctx.scene.leave();
            return ctx.reply('Розсилку скасовано.\nЯкі дії?', adminKeyboard);
        }
        if (ctx.callbackQuery?.data === 'send_to_everyone') {
            await ctx.reply('Розсилка почалася. Зачекай...');
            const allUsers = users.getAllUsersId();
            let successCount = 0;
            const data = ctx.wizard.state.broadcastData;

            for (const user of allUsers) {
                const tgId = user;
                try {
                    if (data.type === 'single'){
                        await ctx.telegram.copyMessage(tgId, ctx.chat.id, data.messageId);
                    } else if (data.type === 'album') {
                        await ctx.telegram.callApi('copyMessages', {
                            chat_id: tgId,
                            from_chat_id: ctx.chat.id,
                            message_ids: data.messageIds
                        });
                    }
                    successCount++;
                    await new Promise((resolve) => setTimeout(resolve, 35));
                } catch (err) {
                    console.log(`Не вдалося відправити юзеру ${tgId}: ${err.message}`);
                }
            }
            await ctx.reply(`📢 Розсилку завершено! Доставлено: ${successCount} з ${allUsers.length} користувачів.`);
            return ctx.scene.leave();
        }
    }
)

const stage = new Scenes.Stage([addProductWizard, editProductWizard, askQuestionWizzard, replyToUserWizzard, messageToEveryone]);

const bot = new Telegraf(process.env.BOT_TOKEN);
const WFP_MERCHANT_ACCOUNT = process.env.WFP_MERCHANT_ACCOUNT;
const WFP_SECRET_KEY = process.env.WFP_SECRET_KEY;
const WFP_DOMAIN_NAME = process.env.WFP_DOMAIN_NAME;
const WFP_WEBHOOK_URL = `${WFP_DOMAIN_NAME}/wayforpay-webhook`;

bot.use(session());
bot.use(stage.middleware());
bot.use((ctx, next) => {
    if (ctx.from) {
        console.log(`[USER LOG] ID: ${ctx.from.id} | Username: @${ctx.from.username || 'немає'} | Ім'я: ${ctx.from.first_name}`);
    }
    return next(); 
});

const firstMessageText = `Привіт! Я бот-помічник \nhttps://t.me/engmiroboards\nТут ти можеш переглянути, придбати розробки і задавати питання💗\n\nНатисни на «Наявність» і я допоможу тобі обрати розробку за твоїм запитом👇`;

const firstBtnKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Наявність', 'first_btn')],
    [Markup.button.callback('Задати питання', 'ask_question')],
    [Markup.button.url('Безкоштовна дошка', 'https://miro.com/app/board/uXjVIttCETE=/?share_link_id=507760614789')]
]);

const adminKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Додати підручник', 'admin_add_product')],
        [Markup.button.callback('✏️ Змінити інфу підручника', 'admin_change_product')],
        [Markup.button.callback('🗑️ Видалити підручник', 'admin_delete_product')],
        [Markup.button.callback('📢 Розсилка всім', 'admin_message_to_everyone')]
    ]);

// -----ОБРОБКА /start-----
bot.start((ctx) => {
    const telegramId = ctx.from.id;
    users.getOrCreate(telegramId);

    const payload = ctx.startPayload;
    if (payload) {
        const product = products.getByDeepLinkCode(payload);
        if (product) {
            return showProductCard(ctx, product);
        } else {
            ctx.reply('На жаль, цей акційний товар не знайдено або термін дії посилання минув.');
        }
    }
    
    return ctx.reply(firstMessageText, firstBtnKeyboard);
});

bot.action('ask_question', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('ASK_QUESTION_SCENE');
});

bot.action('first_btn', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const twoBtnsKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Автентика', 'avtentyka')],
        [Markup.button.callback('Розробки підручників', 'rozrobka_pid')]
    ]);
    return ctx.reply('Оберіть розділ👇', twoBtnsKeyboard);
});


// -----ОБРОБКА /admin-----
bot.command('admin', (ctx) => {
    if (!ADMIN_IDS.includes(String(ctx.from.id))) {
        return ctx.reply('Йой, сюди не можна! 🛑');
    }

    return ctx.reply('Які дії?', adminKeyboard);
});

bot.action('admin_message_to_everyone', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('MESSAGE_TO_EVERYONE');
})

bot.action('admin_add_product', (ctx) => {
    if (!ADMIN_IDS.includes(String(ctx.from.id))) {
        return ctx.answerCbQuery('У вас немає доступу!', { show_alert: true });
    }
    return ctx.scene.enter('ADD_PRODUCT_SCENE');
});

bot.action(/^reply_user_(\d+)_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const targetUserId = ctx.match[1];
    const targetUsername = ctx.match[2];
    
    return ctx.scene.enter('REPLY_TO_USER_SCENE', { targetUserId, targetUsername });
});


// ---Видалення---
bot.action(['admin_delete_product', 'back_to_deleteMenu'], (ctx) => {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('Автентика', 'avtentyka_delete')],
        [Markup.button.callback('Розробки підручників', 'rozrobka_delete')],
        [Markup.button.callback('⬅️ Назад', 'back_to_adminMenu')]
    ]);

    ctx.editMessageText('Звідки видалаємо?', kb);
});

bot.action('avtentyka_delete', async (ctx) => {
    const allProducts = products.getByType('avtentyka'); 

    if (allProducts.length === 0) {
        return ctx.editMessageText('Тут немає підручників', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'back_to_deleteMenu')]]))
    }
    
    const buttons = allProducts.map(product => [
        Markup.button.callback(product.title, `ask_prod_delete_${product.id}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'back_to_deleteMenu')]);

    return ctx.editMessageText('Який підручник видаляємо?', Markup.inlineKeyboard(buttons));
});

bot.action('rozrobka_delete', (ctx) => {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('Діти', 'rozrobka_d_1')],
        [Markup.button.callback('Підлітки', 'rozrobka_d_2')],
        [Markup.button.callback('Дорослі', 'rozrobka_d_3')],
        [Markup.button.callback('⬅️ Назад', 'back_to_deleteMenu')]
    ])

    return ctx.editMessageText('Який вік підручника?', kb);
})

bot.action(/^rozrobka_d_(\d+)$/, (ctx) => {
    const prodAge = parseInt(ctx.match[1]);
    const allProducts = products.getByAge(prodAge); 

    if (allProducts.length === 0) {
        return ctx.editMessageText('Тут немає підручників', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'rozrobka_delete')]]))
    }

    const buttons = allProducts.map(product => [
        Markup.button.callback(product.title, `ask_prod_delete_${product.id}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'back_to_deleteMenu')]);

    return ctx.editMessageText('Який підручник видаляємо?', Markup.inlineKeyboard(buttons));
})

bot.action(/^ask_prod_delete_(\d+)$/, async (ctx) => {
    const prodId = parseInt(ctx.match[1]);
    const product = products.getById(prodId);
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback(`Так`, `prod_delete_${prodId}`)],
        [Markup.button.callback(`⬅️ Назад`, `rozrobka_delete`)]
    ])
    
    ctx.editMessageText(`Точно видалити ${product.title}?`, kb)
});

bot.action(/^prod_delete_(\d+)$/, async (ctx) => {
    const prodId = parseInt(ctx.match[1]);
    const kb = Markup.inlineKeyboard([
            [Markup.button.callback('Повернутись в меню', 'back_to_adminMenu')]
        ])

    products.delete(prodId);
    
    await ctx.answerCbQuery('Товар видалено!');

    await ctx.editMessageText('✅ Товар успішно видалено з бази даних.', kb);
});

bot.action('back_to_adminMenu', (ctx) => {

    return ctx.editMessageText('Які дії?', adminKeyboard);
})

bot.action('back_to_admin_Menu', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    return ctx.reply('Які дії?', adminKeyboard);
})

// ---Зміна---

bot.action('admin_change_product', (ctx) => {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('Автентика', 'avtentyka_change')],
        [Markup.button.callback('Розробки підручників', 'rozrobka_change')],
        [Markup.button.callback('⬅️ Назад', 'back_to_adminMenu')]
    ]);

    ctx.editMessageText('Звідки змінюємо?', kb);
})

// ---Автентика змінити---
bot.action('avtentyka_change', async (ctx) => {
    const allProducts = products.getByType('avtentyka'); 

    if (allProducts.length === 0) {
        return ctx.editMessageText('Тут немає підручників', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'admin_change_product')]]))
    }
    
    const buttons = allProducts.map(product => [
        Markup.button.callback(product.title, `ask_prod_change_${product.id}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'avtentyka_change')]);

    return ctx.editMessageText('Який підручник змінюємо?', Markup.inlineKeyboard(buttons));
});

bot.action(/^ask_prod_change_(\d+)$/, async (ctx) => {
    const prodId = parseInt(ctx.match[1]);
    const product = products.getById(prodId);
    
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('Назва', `edit_field_${prodId}_title`)],
        [Markup.button.callback('Коротка назва', `edit_field_${prodId}_short_title`)],
        [Markup.button.callback('Фото', `edit_field_${prodId}_photo`)],
        [Markup.button.callback('Опис', `edit_field_${prodId}_description`)],
        [Markup.button.callback('Рівень', `edit_field_${prodId}_level`)],
        [Markup.button.callback('Ціна', `edit_field_${prodId}_price`)],
        [Markup.button.callback('Вікова категорія', `edit_field_${prodId}_age_category`)],
        [Markup.button.callback('Посилання на демо', `edit_field_${prodId}_demo_link`)],
        [Markup.button.callback('Посилання після оплати', `edit_field_${prodId}_download_link`)],
        [Markup.button.callback('⬅️ Назад', 'back_to_adminMenu')]
    ]);

    ctx.editMessageText(`Що змінюємо в ${product.title}?`, kb)
});

bot.action(/^edit_field_(\d+)_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const prodId = parseInt(ctx.match[1]);
    const field = ctx.match[2];

    return ctx.scene.enter('EDIT_PRODUCT_SCENE', { prodId, field });
})

// ---Розробки змінити---
bot.action('rozrobka_change', (ctx) => {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('Діти', 'rozrobka_c_1')],
        [Markup.button.callback('Підлітки', 'rozrobka_c_2')],
        [Markup.button.callback('Дорослі', 'rozrobka_c_3')],
        [Markup.button.callback('⬅️ Назад', 'back_to_deleteMenu')]
    ])

    return ctx.editMessageText('Який вік підручника?', kb);
})

bot.action(/^rozrobka_c_(\d+)$/, (ctx) => {
    const prodAge = parseInt(ctx.match[1]);
    const allProducts = products.getByAge(prodAge); 

    if (allProducts.length === 0) {
        return ctx.editMessageText('Тут немає підручників', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'rozrobka_change')]]))
    }

    const buttons = allProducts.map(product => [
        Markup.button.callback(product.title, `ask_prod_change_${product.id}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'rozrobka_change')]);

    return ctx.editMessageText('Який підручник змінюємо?', Markup.inlineKeyboard(buttons));
})


// ----- АВТЕНТИКА -----

bot.action('avtentyka', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    const items = products.getByType('avtentyka');

    if (items.length === 0) {
        const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'first_btn')]]);
        const text = 'У розділі "Автентика" поки немає товарів.';
        return ctx.editMessageText(text, kb).catch(() => ctx.reply(text, kb));
    }

    const buttons = items.map(prod => [
        Markup.button.callback(prod.short_title, `avt_prod_${prod.id}`)
    ]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'back_to_menu')]);

    const kb = Markup.inlineKeyboard(buttons);
    const text = 'Оберіть розділ / урок👇';
    return ctx.reply(text, kb).catch(() => ctx.reply(text, kb));
});

bot.action(/^avt_prod_(\d+)$/, (ctx) => {
    const prodId = parseInt(ctx.match[1]);
    const product = products.getById(prodId);
    showProductCard(ctx, product);
});

// ----- РОЗРОБКИ ПІДРУЧНИКІВ -----

bot.action('rozrobka_pid', async (ctx) => {
    await ctx.answerCbQuery();
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Діти', 'age_1')],
        [Markup.button.callback('Підлітки', 'age_2')],
        [Markup.button.callback('Дорослі', 'age_3')],
        [Markup.button.callback('⬅️ Назад', 'back_to_menu')]
    ]);
    const text = 'Оберіть категорію👇';
    return ctx.editMessageText(text, keyboard).catch(() => ctx.reply(text, keyboard));
});

bot.action(/^age_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const ageCategory = parseInt(ctx.match[1]); 
    const availableLevels = products.getLevelsByAgeAndType(ageCategory, 'rozrobka');

    if (availableLevels.length === 0) {
        const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'rozrobka_pid')]]);
        const text = 'Для цієї категорії поки немає розробок.';
        return ctx.editMessageText(text, kb).catch(() => ctx.reply(text, kb));
    }

    const buttons = availableLevels.map(row => [
        Markup.button.callback(row.level, `rLvl_${ageCategory}_${row.level}`)
    ]);

    buttons.push([Markup.button.callback('⬅️ Назад до категорій', 'rozrobka_pid')]);

    const kb = Markup.inlineKeyboard(buttons);
    const text = 'Оберіть рівень складності👇';
    return ctx.editMessageText(text, kb).catch(() => ctx.reply(text, kb));
});

bot.action(/^rLvl_(\d+)_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const ageCategory = parseInt(ctx.match[1]);
    const level = ctx.match[2];

    const targetProducts = products.getProductsByAgeAndLevel(ageCategory, level, 'rozrobka');

    if (targetProducts.length === 0) {
        const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', `age_${ageCategory}`)]]);
        const text = 'Підручників не знайдено.';
        return ctx.editMessageText(text, kb).catch(() => ctx.reply(text, kb));
    }

    const buttons = targetProducts.map(prod => [
        Markup.button.callback(`${prod.title}`, `prod_${prod.id}`)
    ]);

    buttons.push([Markup.button.callback('⬅️ Назад до рівнів', `age_${ageCategory}`)]);

    const kb = Markup.inlineKeyboard(buttons);
    const text = `Ось підручники рівня ${level}👇`;
    return ctx.editMessageText(text, kb).catch(() => ctx.reply(text, kb));
});

bot.action(/^prod_(\d+)$/, (ctx) => {
    const prodId = parseInt(ctx.match[1]);
    const product = products.getById(prodId);
    showProductCard(ctx, product);
});

bot.action(/^buy_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const prodId = ctx.match[1];
    const userId = ctx.from.id;
    const product = products.getById(prodId);

    if (!product) return ctx.reply('❌ Товар не знайдено.');

    const orderId = orders.create(userId, product.id, product.price);
    const orderDate = Math.floor(Date.now() / 1000);
    const orderReference = `ORDER_${orderId}_${orderDate}`;

    const signatureData = [
        WFP_MERCHANT_ACCOUNT,
        WFP_DOMAIN_NAME,
        orderReference,
        orderDate,
        product.price.toString(),
        'UAH',
        product.title,
        '1',
        product.price.toString()
    ];

    const signature = generateSignature(signatureData, WFP_SECRET_KEY);

    const requestBody = {
        transactionType: 'CREATE_INVOICE',
        merchantAccount: WFP_MERCHANT_ACCOUNT,
        merchantAuthType: 'SimpleSignature',
        merchantDomainName: WFP_DOMAIN_NAME,
        merchantSignature: signature,
        apiVersion: 1,
        language: 'UA',
        serviceUrl: WFP_WEBHOOK_URL,
        orderReference: orderReference,
        orderDate: orderDate,
        amount: product.price,
        currency: 'UAH',
        orderTimeout: 86400,
        productName: [product.title],
        productPrice: [product.price],
        productCount: [1]
    };

    try {
        const response = await fetch('https://api.wayforpay.com/api', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.reasonCode === 1100 && data.invoiceUrl) {
            const payKb = Markup.inlineKeyboard([
                [Markup.button.url('💳 Оплатити', data.invoiceUrl)]
            ]);

            await ctx.reply(`Оформлюємо замовлення на **${product.title}**.\nДо сплати: ${product.price} UAH.\n\nОплатіть протягом наступних 24 годин\n\nНатисніть кнопку нижче для переходу до безпечної оплати:`, { parse_mode: 'Markdown', ...payKb });
        } else {
            console.error('Помилка WFP:', data);
            await ctx.reply('❌ Виникла помилка при створенні платежу. Спробуйте пізніше.');
        }
    } catch (error) {
        console.error('Помилка fetch:', error);
        await ctx.reply('❌ Помилка з\'єднання з платіжною системою.')
    }
});

bot.action('back_to_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const twoBtnsKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Автентика', 'avtentyka')],
        [Markup.button.callback('Розробки підручників', 'rozrobka_pid')]
    ]);
    return ctx.editMessageText('Оберіть розділ👇', twoBtnsKeyboard);
});

const app = express();

app.use('/wayforpay-webhook', express.json({type: () => true}));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.post('/wayforpay-webhook', async (req, res) => {
    const wfpData = req.body;

    if (wfpData.transactionStatus === 'Approved') {
        const orderReference = wfpData.orderReference;
        const match = orderReference.match(/^ORDER_(\d+)_/);

        if (match) {
            const orderId = parseInt(match[1], 10);
            const order = orders.getById(orderId);

            if (order && order.status !== 'paid') {
                orders.updateStatus(orderId, 'paid');
                const product = products.getById(order.product_id);

                try {
                    await bot.telegram.sendMessage(
                        order.user_id,
                        `✅ <b>Оплата успішна!</b>\n\n⬇️ Ваші матеріали:\n${product.download_link}`,
                        { parse_mode: 'HTML' }
                    );

                    await new Promise(resolve => setTimeout(resolve, 100));

                    await bot.telegram.sendMessage(
                        order.user_id,
                        firstMessageText,
                        firstBtnKeyboard
                    );
                } catch (e) {
                    console.error(`Не вдалося відправити юзеру ${order.user_id}:`, e);
                }
            }
        }
    }

    const time = Date.now();
    const responseSignatureData = [
        wfpData.orderReference,
        'accept',
        time.toString()
    ];
    const responseSignature = generateSignature(responseSignatureData, WFP_SECRET_KEY);

    res.json({
        orderReference: wfpData.orderReference,
        status: "accept",
        time: time,
        signature: responseSignature
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер для вебхуків запущено на порту ${PORT}`);
});


bot.launch().then(async () => {
    const botInfo = await bot.telegram.getMe();
    console.log(`Бот запущено! Посилання: https://t.me/${botInfo.username}`);
}).catch(err => console.error('Помилка запуску бота:', err));