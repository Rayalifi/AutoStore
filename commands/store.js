﻿﻿﻿﻿﻿﻿﻿const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Product = require('../models/Product');
const Config = require('../models/Config');


// --- SECURITY & ENCRYPTION ---
const _0x8f2a = "4175746f53746f7265206279204c65526f6953746f7265"; 
const _0xGetWM = () => Buffer.from(_0x8f2a, 'hex').toString('utf-8');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('store')
        .setDescription('Display store menu (Choose Mode: Button/Dropdown)'),

    async execute(interaction) {
        const rowMode = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mode_dropdown').setLabel('Mode Dropdown').setEmoji(process.env.EMOJI_MODE_DROPDOWN || '🔽').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('mode_button').setLabel('Mode Button').setEmoji(process.env.EMOJI_MODE_BUTTON || '🖱️').setStyle(ButtonStyle.Success)
        );

        const embedMode = new EmbedBuilder()
            .setTitle(`${process.env.EMOJI_CONFIG || '⚙️'} Choose Store Display`)
            .setDescription('Please choose your preferred interaction mode:')
            .setColor('Blue');

        const msg = await interaction.reply({ embeds: [embedMode], components: [rowMode], fetchReply: true });

        const collector = msg.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id, 
            time: 30000, 
            max: 1 
        });

        collector.on('collect', async (i) => {
            const selectedMode = i.customId === 'mode_button' ? 'BUTTON' : 'DROPDOWN';
            await i.deferUpdate(); 

            async function getStoreContent() {
                try {
                    // Ambil semua produk biasa
                    const products = await Product.find({ active: { $ne: false } });
                    
                    // Ambil Rate DL terbaru dari Database (Agar sinkron dengan /ratedl)
                    const configDB = await Config.findOne({ id: 'main_config' });
                    const rateDL = (configDB && configDB.rateDL) ? configDB.rateDL : (parseInt(process.env.RATE_DL) || 15000);
                    const dlToWl = 100;

                    const currentTimestamp = Math.floor(Date.now() / 1000);

                    const embed = new EmbedBuilder()
                        .setTitle(`${process.env.EMOJI_STORE_TITLE || '🏪'} LeRoiStore`)
                        .setColor('#00ff00')
                        .setDescription(`
${process.env.EMOJI_LAST_UPDATE || '🕒'} **Last Update:** <t:${currentTimestamp}:R>

${process.env.EMOJI_RATE_DEPOSIT || '💳'} **Rate Topup:** Rp${rateDL.toLocaleString()} = 1 ${process.env.EMOJI_DL || '💎'}

━━━━━━━━━━━━━━━━━━━━━━━━`)
                        .setImage(process.env.BANNER_URL)
                        .setFooter({ text: _0xGetWM(), iconURL: interaction.client.user.displayAvatarURL() })
                        .setTimestamp();

                    let productList = "";
                    
                    // CEK APAKAH TIDAK ADA PRODUK SAMA SEKALI
                    if (products.length === 0) {
                        productList = "*Belum ada produk tersedia.*";
                    } else {
                        // ========== TAMPILKAN PRODUK BIASA ==========
                        products.forEach(p => {
                            const status = p.stock.length > 0 ? `${process.env.EMOJI_VERIFIED || '✅'}` : `${process.env.EMOJI_OUT_OF_STOCK || '❌'} Out of Stock`;

                            // Display price (Manual WL or Calculated)
                            // Gunakan harga WL manual jika ada (>0), jika tidak hitung otomatis
                            const wlPrice = (p.priceWl && p.priceWl > 0) ? p.priceWl : Math.ceil(p.price / (rateDL / dlToWl));
                            const dlDisplay = Math.floor(wlPrice / 100);
                            const wlDisplay = wlPrice % 100;
                            const priceLine = `- Price: **${dlDisplay > 0 ? `${dlDisplay} ${process.env.EMOJI_DL || '💎'} ` : ''}${wlDisplay} ${process.env.EMOJI_WL || '🔒'}**`;

                            productList += `${process.env.EMOJI_PRODUCT || '🛍️'} **${p.name}**\n- Code: \`${p.code}\`\n${priceLine}\n- Stock: **${p.stock.length}** ${status}\n- Sold: **${p.sold || 0}**\n\n`;
                        });
                    }
                    
                    embed.addFields({ name: 'Product List', value: productList });

                    // ========== BUAT COMPONENTS (DROPDOWN/BUTTON) ==========
                    const components = [];

                    if (selectedMode === 'DROPDOWN') {
                        const menu = new StringSelectMenuBuilder()
                            .setCustomId('main_menu')
                            .setPlaceholder('Please choose an action...')
                            .addOptions(
                                { label: 'Register Account', value: 'register', emoji: process.env.BTN_REGISTER || '👤' },
                                { label: 'Top Up QRIS', value: 'topup', emoji: process.env.BTN_TOPUP || '💳' },
                                { label: 'Check Balance', value: 'balance', emoji: process.env.BTN_SALDO || '💰' },
                                { label: 'Buy Product', value: 'buy', emoji: process.env.BTN_BELI || '🛒' },
                                { label: 'Set GrowID', value: 'set_growid', emoji: process.env.BTN_SETGROWID || '🆔' },
                                { label: 'Deposit DL', value: 'depo_dl', emoji: process.env.BTN_DEPODL || '💎' }
                            );
                        components.push(new ActionRowBuilder().addComponents(menu));
                    } 
                    else if (selectedMode === 'BUTTON') {
                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('act_register').setLabel('Register').setEmoji(process.env.BTN_REGISTER || '👤').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('act_topup').setLabel('Top Up QRIS').setEmoji(process.env.BTN_TOPUP || '💳').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('act_balance').setLabel('Balance').setEmoji(process.env.BTN_SALDO || '💰').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('act_buy').setLabel('Buy').setEmoji(process.env.BTN_BELI || '🛒').setStyle(ButtonStyle.Danger)
                        );
                        const row2 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('act_set_growid').setLabel('Set GrowID').setEmoji(process.env.BTN_SETGROWID || '🆔').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('act_depo_dl').setLabel('Deposit DL').setEmoji(process.env.BTN_DEPODL || '💎').setStyle(ButtonStyle.Success)
                        );
                        components.push(row1, row2);
                    }

                    return { embeds: [embed], components: components };

                } catch (error) {
                    console.error("Error getStoreContent:", error);
                    return null;
                }
            }

            const initialContent = await getStoreContent();
            if (initialContent) {
                const sentMsg = await i.editReply(initialContent);

                if (sentMsg) {
                    await Config.findOneAndUpdate(
                        { id: 'main_config' },
                        { storeChannelId: sentMsg.channel.id, storeMessageId: sentMsg.id },
                        { upsert: true }
                    );
                }

                // AUTO REFRESH STORE SETIAP 10 DETIK
                const refreshInterval = setInterval(async () => {
                    try {
                        const updatedContent = await getStoreContent();
                        if (updatedContent) await sentMsg.edit(updatedContent);
                    } catch (err) {
                        // Hentikan interval jika pesan sudah tidak ada atau error koneksi
                        if (err.code === 10008 || err.message?.includes('Unknown Message')) {
                            clearInterval(refreshInterval);
                        } else if (err.code !== 'UND_ERR_SOCKET' && !err.message?.includes('other side closed')) {
                            console.error("Auto-Refresh Store Error:", err);
                        }
                    }
                }, 10000); // 10 detik
            }
        });

        // Handle jika collector timeout (user tidak memilih)
        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ 
                    content: '⏰ Timeout! Silakan jalankan `/store` lagi jika ingin memilih mode.',
                    components: [] 
                }).catch(() => {});
            }
        });
    },
};
