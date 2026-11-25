﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿require('dotenv').config();
const { 
    Client, GatewayIntentBits, Collection, EmbedBuilder, 
    ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
    ButtonBuilder, ButtonStyle, REST, Routes, Events, MessageFlags 
} = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');

// Import Database Models
const User = require('./models/User');
const Product = require('./models/Product');
const Config = require('./models/Config');

// --- SECURITY: ENCRYPTED EMBED BANNER ---
const _0xSec = "4175746f53746f7265206279204c65526f6953746f7265";

const E = {
    reg: process.env.EMOJI_REGISTER || '👤',
    topup: process.env.EMOJI_TOPUP || '💳',
    bal: process.env.EMOJI_BALANCE || '💰',
    buy: process.env.EMOJI_BUY || '🛒',
    store: process.env.EMOJI_STORE || '🏪',
    success: process.env.EMOJI_SUCCESS || '✅',
    error: process.env.EMOJI_ERROR || '❌',
    load: process.env.EMOJI_LOADING || '⏳',
    pend: process.env.EMOJI_PENDING || '🕒',
    autoDeposit: process.env.EMOJI_DEPOSIT || '💎',
    dl: process.env.EMOJI_DL || '💎',
    wl: process.env.EMOJI_WL || '🔒'
};

// ==========================================
// 1. WEBHOOK SERVER (PAKASIR QRIS)
// ==========================================
const app = express();
app.use(bodyParser.json());

app.get('/callback', (req, res) => res.send(`${E.success} <b>Webhook Server Aktif!</b>`));

app.post('/callback', async (req, res) => {
    const data = req.body;
    const status = data.status || data.transaction_status;
    const orderId = data.order_id;
    const amount = parseInt(data.amount);

    if (status === 'completed' || status === 'success' || status === 'paid') {
        if (orderId) {
            try {
                const userId = orderId.split('-')[0]; 
                let user = await User.findOne({ userId });
                if (!user) user = new User({ userId, balance: 0, totalSpent: 0 });

                // KONVERSI RUPIAH KE WL (Rate DL)
                const rateDL = parseInt(process.env.RATE_DL) || 15000;
                const wlReceived = Math.floor((amount / rateDL) * 100); // Rumus: (Rp / RateDL) * 100

                user.balance += wlReceived;
                await user.save();
                
                await sendUpdateLog(process.env.CHANNEL_TOPUP_ID, `${E.bal} SALDO MASUK (QRIS)`, `**User:** <@${userId}>\n**Nominal:** Rp${amount.toLocaleString()}\n**Diterima:** ${Math.floor(wlReceived/100)} ${E.dl} ${wlReceived%100} ${E.wl}\n**Status:** LUNAS`, '#00FF00');
                
                const discordUser = await client.users.fetch(userId).catch(() => null); //
                if (discordUser) {
                    const embed = new EmbedBuilder().setTitle(`${E.success} Topup Berhasil!`).setDescription(`${E.bal} Deposit **Rp${amount.toLocaleString()}** berhasil.\n💎 Saldo Diterima: **${Math.floor(wlReceived/100)} ${E.dl} ${wlReceived%100} ${E.wl}**`).setColor('#00FF00').setTimestamp();
                    await discordUser.send({ embeds: [embed] }).catch(() => {});
                }
            } catch (err) { console.error("Error Webhook:", err); }
        }
    }
    res.json({ status: 'OK' });
});

app.listen(3000, () => {}); 

// ==========================================
// 2. SETUP DISCORD BOT
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

async function sendUpdateLog(channelId, title, description, color = '#0099FF') {
    try {
        const logChannel = await client.channels.fetch(channelId).catch(() => null);
        if (!logChannel) return;
        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setFooter({ text: Buffer.from(_0xSec, 'hex').toString('utf-8') }).setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error("Gagal kirim log:", e); }
}

client.commands = new Collection();
const commandsData = []; // Array untuk menampung data command yang akan dideploy
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data) {
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON()); // Masukkan data command ke array
    }
}

// --- AUTO DEPLOY COMMANDS (Pengganti deploy-commands.js) ---
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        if (process.env.CLIENT_ID && process.env.GUILD_ID) {
            // console.log(`🔄 Mendaftarkan ${commandsData.length} commands...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandsData },
            );
            console.log(`✅ ${commandsData.length} Slash Commands berhasil didaftarkan otomatis!`);
        } else {
            console.log(`⚠️ CLIENT_ID atau GUILD_ID tidak ditemukan di .env, melewati auto-deploy.`);
        }
    } catch (error) {
        console.error(`❌ Gagal deploy commands: ${error}`);
    }
})();

// ==========================================
// 🔥 3. AUTO DEPOSIT LISTENER (LUA SCRIPT) 🔥
// ==========================================
client.on('messageCreate', async (message) => {
    if (!message.webhookId) return;
    if (!message.embeds || message.embeds.length === 0) return;

    const embed = message.embeds[0];
    if (!embed.title || !embed.title.includes("Donation Log")) return;
    
    const description = embed.description;
    if (!description) return;

    try {
        const growIdMatch = description.match(/GrowID:\s*(.+?)\n/);
        const depositMatch = description.match(/Deposit:\s*(.+?)</);

        if (!growIdMatch || !depositMatch) return;

        const growIdRaw = growIdMatch[1].trim(); 
        const itemRaw = depositMatch[1].trim(); 

        const user = await User.findOne({ growId: { $regex: new RegExp(`^${growIdRaw}$`, "i") } });

        if (!user) {
            console.log(`[SKIP] GrowID ${growIdRaw} belum dilink ke Discord.`);
            // console.log(`[SKIP] GrowID ${growIdRaw} belum dilink ke Discord.`);
            return;
        }

        let qty = 1;
        let itemName = itemRaw;
        const numberMatch = itemRaw.match(/^(\d+)\s+(.*)/);
        if (numberMatch) {
            qty = parseInt(numberMatch[1]);
            itemName = numberMatch[2];
        }

        let totalSaldo = 0;

        // KONVERSI ITEM KE WL (Saldo Utama = WL)
        if (itemName.includes("Diamond Lock")) totalSaldo = qty * 100; // 1 DL = 100 WL
        else if (itemName.includes("World Lock")) totalSaldo = qty;    // 1 WL = 1 WL
        else if (itemName.includes("Blue Gem Lock")) totalSaldo = qty * 10000; // 1 BGL = 10000 WL
        else if (itemName.includes("BGL")) totalSaldo = qty * 10000;
        else {
            console.log(`[SKIP] Item tidak didukung: ${itemName}`);
            // console.log(`[SKIP] Item tidak didukung: ${itemName}`);
            return;
        }

        user.balance += totalSaldo;
        await user.save();

        // HANYA KIRIM KE CHANNEL_TOPUP_ID (1306406102493298822)
        await sendUpdateLog(process.env.CHANNEL_TOPUP_ID,
            `${E.autoDeposit} AUTO DEPOSIT`,
            `**User:** <@${user.userId}>\n**GrowID:** ${growIdRaw}\n**Item:** ${itemRaw}\n**Saldo:** +${Math.floor(totalSaldo/100)} ${E.dl} ${totalSaldo%100} ${E.wl}`,
            '#00FFFF'
        );

    } catch (err) {
        console.error("[DEBUG] 💥 Error parsing:", err);
    }
});

// ==========================================
// 4. INTERACTION HANDLER
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // --- HANDLE SLASH COMMANDS ---
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // ============================================================
        // 🔒 SECURITY CHECK: KHUSUS ADMIN 🔒
        // ============================================================
        const restrictedCommands = [
            'setworld', 
            'addstock', 
            'removestock', 
            'setrate', 
            'deleteproduk',
            'store',       
            'leaderboard',
            'givebalance', 
            'giveproduk', 
            'cekbalance',
            'ratedl'
        ]; 
        
        // Ambil ID dari .env
        const allowedIDs = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim());

        // Jika command termasuk restricted DAN User ID TIDAK ADA di list allowed
        if (restrictedCommands.includes(interaction.commandName) && !allowedIDs.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: `⛔ **Access Denied!**\nCommand \`/${interaction.commandName}\` is for Owner/Admin only.`, 
                flags: MessageFlags.Ephemeral 
            });
        }
        // ============================================================

        try { await command.execute(interaction, process.env); } catch (e) { console.error(e); }
    }

    // --- HANDLE STORE ACTIONS ---
    else if (interaction.isStringSelectMenu() || interaction.isButton()) {
        
        const isStoreInteraction = 
            (interaction.isStringSelectMenu() && interaction.customId === 'main_menu') ||
            (interaction.isButton() && interaction.customId.startsWith('act_'));

        if (isStoreInteraction) {
            let selected = '';
            if (interaction.isStringSelectMenu()) selected = interaction.values[0]; 
            else if (interaction.isButton()) selected = interaction.customId.replace('act_', '');

            try {
                // REGISTER
                if (selected === 'register') {
                    await interaction.deferReply({ ephemeral: true });
                    let user = await User.findOne({ userId: interaction.user.id });
                    if (user) return interaction.editReply(`${E.error} Kamu sudah terdaftar.`);
                    await new User({ userId: interaction.user.id, username: interaction.user.username }).save();
                    return interaction.editReply(`${E.success} Berhasil mendaftar.`);
                }

                // CEK SALDO
                if (selected === 'balance') {
                    await interaction.deferReply({ ephemeral: true });
                    const user = await User.findOne({ userId: interaction.user.id });
                    const bal = user ? user.balance : 0;
                    return interaction.editReply(`${E.bal} Saldo: **${Math.floor(bal/100)} ${E.dl} ${bal%100} ${E.wl}**\n${E.buy} Total Belanja: **${Math.floor((user?.totalSpent||0)/100)} ${E.dl}**`);
                }

                // TOPUP QRIS
                if (selected === 'topup') {
                    const user = await User.findOne({ userId: interaction.user.id });
                    if (!user) {
                        const embedWarning = new EmbedBuilder()
                            .setTitle('<a:1220300887092891658:1454259857971478771> Access Denied')
                            .setDescription('You are not registered yet.\nPlease click the button below to **Register** first.')
                            .setColor('Red');
                        const btnRegister = new ButtonBuilder()
                            .setCustomId('act_register')
                            .setLabel('Register Now') 
                            .setEmoji(process.env.BTN_REGISTER || '👤')
                            .setStyle(ButtonStyle.Primary);

                        const row = new ActionRowBuilder().addComponents(btnRegister);
                        return interaction.reply({ embeds: [embedWarning], components: [row], flags: MessageFlags.Ephemeral });
                    }
                    const modal = new ModalBuilder().setCustomId('modal_topup').setTitle('Topup QRIS');
                    const inputAmount = new TextInputBuilder().setCustomId('amount').setLabel("Nominal Topup").setPlaceholder("Example: 10000").setStyle(TextInputStyle.Short).setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(inputAmount));
                    await interaction.showModal(modal);
                }

                // SET GROWID
                if (selected === 'set_growid') {
                    const modal = new ModalBuilder().setCustomId('modal_growid').setTitle('Setting GrowID');
                    const inputGrowID = new TextInputBuilder().setCustomId('growid_input').setLabel("Input Your GrowID *").setStyle(TextInputStyle.Short).setRequired(true);
                    const confirmGrowID = new TextInputBuilder().setCustomId('growid_confirm').setLabel("Confirm Your GrowID *").setStyle(TextInputStyle.Short).setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(inputGrowID), new ActionRowBuilder().addComponents(confirmGrowID));
                    await interaction.showModal(modal);
                }

                // DEPOSIT DL
                if (selected === 'depo_dl') {
                    const user = await User.findOne({ userId: interaction.user.id });
                    if (!user || !user.growId) {
                        const modal = new ModalBuilder().setCustomId('modal_growid').setTitle('Setting GrowID');
                        const inputGrowID = new TextInputBuilder().setCustomId('growid_input').setLabel("Input Your GrowID *").setStyle(TextInputStyle.Short).setRequired(true);
                        const confirmGrowID = new TextInputBuilder().setCustomId('growid_confirm').setLabel("Confirm Your GrowID *").setStyle(TextInputStyle.Short).setRequired(true);
                        modal.addComponents(new ActionRowBuilder().addComponents(inputGrowID), new ActionRowBuilder().addComponents(confirmGrowID));
                        await interaction.showModal(modal);
                        return;
                    }
                    await interaction.deferReply({ ephemeral: true });
                    let config = await Config.findOne({ id: 'main_config' });
                    if (!config) config = { world: '-', owner: '-', botName: '-' };
                    const embed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('<:1437543874959642645:1460269213229912266> Deposit World <:1437543874959642645:1460269213229912266>')
                        .setDescription(`
<a:1295030784507252858:1460269174306766888> **World : ${config.world}**
<a:1295030784507252858:1460269174306766888> **Owner : ${config.owner}**
<a:1295030784507252858:1460269174306766888> **Bot Name : ${config.botName}**

**<a:1220300887092891658:1460269167642017923> IMPORTANT NOTE:**
If the bot is **OFFLINE** in the world:
1. Put your DLs in the **Donation Box**.
2. Take a **Screenshot** as proof.
3. Send it to the **OWNER** or create a **Ticket**.
                        `)
                        .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                        .setTimestamp();
                    
                    interaction.editReply({ embeds: [embed] });
                }

                // BELI PRODUK
                if (selected === 'buy') {
                    const modal = new ModalBuilder().setCustomId('modal_buy').setTitle('Buy Product');
                    const inputCode = new TextInputBuilder().setCustomId('p_code').setLabel("Product Code").setStyle(TextInputStyle.Short).setRequired(true);
                    const inputQty = new TextInputBuilder().setCustomId('p_qty').setLabel("Quantity").setStyle(TextInputStyle.Short).setValue("1").setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(inputCode), new ActionRowBuilder().addComponents(inputQty));
                    await interaction.showModal(modal);
                }

            } catch (err) { console.error("Store Action Error:", err); }
        }
    }

    // --- HANDLE MODAL SUBMITS ---
    else if (interaction.isModalSubmit()) {
        try {
            // MODAL SET GROWID
            if (interaction.customId === 'modal_growid') {
                await interaction.deferReply({ ephemeral: true });
                const newGrowId = interaction.fields.getTextInputValue('growid_input');
                const confirmGrowId = interaction.fields.getTextInputValue('growid_confirm');
                if (newGrowId !== confirmGrowId) return interaction.editReply(`<a:14439186401174528641:1452929647816740904> **Verifikasi Gagal!** Beda.`);
                const exist = await User.findOne({ growId: { $regex: new RegExp(`^${newGrowId}$`, "i") } });
                if (exist && exist.userId !== interaction.user.id) return interaction.editReply(`<a:14439186401174528641:1452929647816740904> GrowID **${newGrowId}** Dipakai orang lain.`);
                let user = await User.findOne({ userId: interaction.user.id });
                if (!user) user = new User({ userId: interaction.user.id, username: interaction.user.username });
                user.growId = newGrowId;
                await user.save();
                interaction.editReply(`<a:1252036185811980375:1452926304696402004> GrowID berhasil diset: **${newGrowId}**.`);
            }

            // MODAL TOPUP QRIS
            if (interaction.customId === 'modal_topup') {
                await interaction.deferReply({ ephemeral: true });
                const amount = parseInt(interaction.fields.getTextInputValue('amount').replace(/[^0-9]/g, ''));
                if (isNaN(amount) || amount < 1000) return interaction.editReply(`${E.error} Minimal Rp1.000`);
                const uniqueOrderId = `${interaction.user.id}-${Date.now()}`;
                try { //
                    const res = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', { project: process.env.PAKASIR_SLUG, order_id: uniqueOrderId, amount: amount, api_key: process.env.PAKASIR_API_KEY });
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(res.data.payment.payment_number)}`;
                    interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`Scan Rp${amount.toLocaleString()}`).setImage(qrUrl).setColor('Blue')] });
                } catch (e) { interaction.editReply(`${E.failed} Gagal membuat QRIS.`); }
            }

            // MODAL BELI (DENGAN DUKUNGAN AUTO-BUY - HARGA OTOMATIS) //
            if (interaction.customId === 'modal_buy') {
                await interaction.deferReply({ ephemeral: true });
                const code = interaction.fields.getTextInputValue('p_code');
                const qty = parseInt(interaction.fields.getTextInputValue('p_qty'));
                
                // ========== PROSES PRODUK BIASA (STOK MANUAL) ==========
                const product = await Product.findOne({ code, active: { $ne: false } });
                if (!product || product.stock.length < qty) {
                    return interaction.editReply(`❌ Stok produk tidak cukup atau produk tidak ditemukan.`);
                }
                
                let user = await User.findOne({ userId: interaction.user.id });
                const rateDL = parseInt(process.env.RATE_DL) || 15000;
                const rateWL = rateDL / 100;
                
                let unitPriceWL = 0;
                if (product.priceWl && product.priceWl > 0) unitPriceWL = product.priceWl;
                else if (product.currency === 'wl') unitPriceWL = product.price;
                else unitPriceWL = Math.ceil(product.price / rateWL); // Konversi Rp ke WL

                const totalCostWL = unitPriceWL * qty;

                if (!user || user.balance < totalCostWL) {
                    return interaction.editReply(`❌ Saldo kurang. Total: **${Math.floor(totalCostWL/100)} ${E.dl} ${totalCostWL%100} ${E.wl}**`);
                }
                
                const items = product.stock.splice(0, qty);
                user.balance -= totalCostWL;
                user.totalSpent = (user.totalSpent || 0) + totalCostWL;
                product.sold = (product.sold || 0) + qty;

                await product.save(); 
                await user.save();
                
                if (product.roleId) {
                    try { 
                        const member = await interaction.guild.members.fetch(interaction.user.id); 
                        const role = await interaction.guild.roles.fetch(product.roleId); 
                        if (role) await member.roles.add(role); 
                    } catch (e) {}
                }

                const file = new AttachmentBuilder(Buffer.from(items.join('\n')), { name: `${code}.txt` }); //
                
                await sendUpdateLog(process.env.CHANNEL_BUY_ID, 
                    `🛒 TERJUAL`,
                    `User: <@${interaction.user.id}>\n` +
                    `Item: ${qty} (${product.name})\n` +
                    `Total: ${Math.floor(totalCostWL/100)} ${E.dl} ${totalCostWL%100} ${E.wl}`,
                    '#00FFFF'
                );

                const embedDM = new EmbedBuilder()
                    .setTitle('✅ Pembelian Berhasil!')
                    .setDescription(`Produk **${product.name}** (${qty}x) telah dibeli.\nFile produk terlampir di bawah.`)
                    .addFields(
                        { name: '💰 Total Dibayar', value: `${Math.floor(totalCostWL/100)} ${E.dl} ${totalCostWL%100} ${E.wl}` },
                        { name: '📊 Sisa Saldo', value: `${Math.floor(user.balance/100)} ${E.dl} ${user.balance%100} ${E.wl}` }
                    )
                    .setColor('#00FF00')
                    .setTimestamp();
                
                try {
                    await interaction.user.send({ embeds: [embedDM], files: [file] });
                    await interaction.editReply(`✅ Berhasil! Cek DM Anda.`);
                } catch (e) {
                    await interaction.editReply({ content: `✅ Berhasil! File di bawah:`, files: [file] });
                }
            }

        } catch (err) { console.error("Modal Error:", err); }
    }
});

// ========================================================
// 🔥 AUTO-REFRESH RESUME & STARTUP BANNER 🔥
// ========================================================
client.once(Events.ClientReady, async (c) => { 
    
    // --- SHOW CUSTOM CONSOLE BANNER (Request User) ---
    console.clear(); 
    console.log(`
\x1b[36m██╗     ███████╗██████╗  ██████╗ ██╗███████╗████████╗ ██████╗ ██████╗ ███████╗
\x1b[36m██║     ██╔════╝██╔══██╗██╔═══██╗██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
\x1b[36m██║     █████╗  ██████╔╝██║   ██║██║███████╗   ██║   ██║   ██║██████╔╝█████╗
\x1b[36m██║     ██╔══╝  ██╔══██╗██║   ██║██║╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝
\x1b[36m███████╗███████╗██║  ██║╚██████╔╝██║███████║   ██║   ╚██████╔╝██║  ██║███████╗
\x1b[36m╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝\x1b[0m
\x1b[33m   >>> AutoStore V5 • Created by LeRoiStore • Ready to Serve <<<\x1b[0m
    `);
    
    console.log(`\x1b[32m[SYSTEM] ${E.success} Bot Online: ${c.user.tag}\x1b[0m`);
    console.log(`\x1b[32m[SYSTEM] ${E.store} Webhook Server running on port 3000\x1b[0m`);
    
    // Resume Auto-Refresh Logic
    try {
        const config = await Config.findOne({ id: 'main_config' });
        
        // LOAD RATE DL FROM DB (Agar tidak reset ke .env saat restart)
        if (config && config.rateDL) {
            process.env.RATE_DL = config.rateDL;
            console.log(`\x1b[32m[SYSTEM] Rate DL Loaded from DB: ${config.rateDL}\x1b[0m`);
        }

        if (!config) return;

        // --- 1. RESUME STORE ---
        if (config.storeChannelId && config.storeMessageId) {
            const channel = await client.channels.fetch(config.storeChannelId).catch(() => null);
            if (channel) {
                const msg = await channel.messages.fetch(config.storeMessageId).catch(() => null);
                if (msg) {
                    console.log(`\x1b[34m[RESUME]\x1b[0m Store Auto-Refresh: ${msg.id}`);
                    
                    // Gunakan interval dengan penanganan error yang lebih baik
                    const storeInterval = setInterval(async () => { //
                        try {
                            const products = await Product.find({ active: { $ne: false } });
                            
                            // Ambil Rate DL terbaru dari Database (Agar sinkron dengan /ratedl)
                            const configDB = await Config.findOne({ id: 'main_config' });
                            const rateDL = (configDB && configDB.rateDL) ? configDB.rateDL : (parseInt(process.env.RATE_DL) || 15000);

                            const currentTimestamp = Math.floor(Date.now() / 1000);
                            const dlToWl = 100;

                            // --- EDIT TAMPILAN DI SINI AGAR SAMA DENGAN /STORE ---
                            const embed = new EmbedBuilder()
                                .setTitle(`${process.env.EMOJI_STORE_TITLE || '🏪'} LeRoiStore`)
                                .setColor('#00ff00')
                                .setDescription(`
${process.env.EMOJI_LAST_UPDATE || '🕒'} **Last Update:** <t:${currentTimestamp}:R>

${process.env.EMOJI_RATE_DEPOSIT || '💳'} **Rate Topup:** Rp${rateDL.toLocaleString()} = 1 ${E.dl}

━━━━━━━━━━━━━━━━━━━━━━━━`)
                                .setImage(process.env.BANNER_URL)
                                .setFooter({ text: Buffer.from(_0xSec, 'hex').toString('utf-8'), iconURL: client.user.displayAvatarURL() })
                                .setTimestamp();

                            let productList = "";
                            
                            // Produk biasa dulu
                            if (products.length === 0) {
                                productList = "*Belum ada produk tersedia.*";
                            } else {
                                // Tampilkan produk biasa
                                products.forEach(p => {
                                    const status = p.stock.length > 0 ? `${process.env.EMOJI_VERIFIED || '✅'}` : `${process.env.EMOJI_OUT_OF_STOCK || '❌'} Out of Stock`;

                                    // Display price (Manual WL or Calculated)
                                    // Gunakan harga WL manual jika ada (>0), jika tidak hitung otomatis
                                    const wlPrice = (p.priceWl && p.priceWl > 0) ? p.priceWl : Math.ceil(p.price / (rateDL / dlToWl));
                                    const dlDisplay = Math.floor(wlPrice / 100);
                                    const wlDisplay = wlPrice % 100;
                                    const priceLine = `- Price: **${dlDisplay > 0 ? `${dlDisplay} ${E.dl} ` : ''}${wlDisplay} ${E.wl}**`;

                                    productList += `${process.env.EMOJI_PRODUCT || '🛍️'} **${p.name}**\n- Code: \`${p.code}\`\n${priceLine}\n- Stock: **${p.stock.length}** ${status}\n- Sold: **${p.sold || 0}**\n\n`;
                                });
                            }
                            embed.addFields({ name: 'Product List', value: productList });
                            
                            // Edit message dengan error handling
                            await msg.edit({ embeds: [embed] }).catch(err => {
                                // Jika pesan tidak ditemukan (dihapus), hapus ID dari config dan hentikan interval
                                if (err.code === 10008 || err.message?.includes('Unknown Message')) {
                                    console.log(`\x1b[33m[WARN]\x1b[0m Store message tidak ditemukan, membersihkan config...`);
                                    config.storeMessageId = '';
                                    config.save().catch(() => {});
                                    clearInterval(storeInterval);
                                } else if (err.code !== 'UND_ERR_SOCKET' && !err.message?.includes('other side closed')) {
                                    console.error("Auto-Update Store Error:", err);
                                }
                            });

                        } catch (err) { 
                            // Tangani error umum
                            if (err.code !== 'UND_ERR_SOCKET' && !err.message?.includes('other side closed')) {
                                console.error("Auto-Update Store Error:", err);
                            }
                        }
                    }, 10000); // 10 detik
                } else {
                    // Jika pesan tidak ditemukan saat startup
                    console.log(`\x1b[33m[WARN]\x1b[0m Store message tidak ditemukan saat startup, membersihkan config...`);
                    config.storeMessageId = '';
                    config.save().catch(() => {});
                }
            }
        }

        // --- 2. RESUME LEADERBOARD ---
        if (config.leaderboardChannelId && config.leaderboardMessageId) {
            const channel = await client.channels.fetch(config.leaderboardChannelId).catch(() => null);
            if (channel) {
                const msg = await channel.messages.fetch(config.leaderboardMessageId).catch(() => null);
                if (msg) {
                    console.log(`\x1b[34m[RESUME]\x1b[0m Leaderboard Auto-Refresh: ${msg.id}`);
                    
                    const leaderboardInterval = setInterval(async () => {
                        try {
                            const users = await User.find({ totalSpent: { $gt: 0 } }).sort({ totalSpent: -1 }).limit(10);
                            const currentTimestamp = Math.floor(Date.now() / 1000);
                            
                            let desc = `🕒 **Terakhir Update:** <t:${currentTimestamp}:R>\n*(Otomatis refresh setiap 30 detik)*\n\n__________________________\n\n**Peringkat Belanja Terbanyak**\n`;
                            
                            if (users.length === 0) {
                                desc += "*Belum ada data belanja.*";
                            } else {
                                users.forEach((u, index) => {
                                    let medal = `${index + 1}.`;
                                    if (index === 0) medal = '🥇';
                                    if (index === 1) medal = '🥈';
                                    if (index === 2) medal = '🥉';
                                    desc += `${medal} <@${u.userId}> — **${Math.floor((u.totalSpent||0)/100)} ${E.dl}**\n`;
                                });
                            }

                            const embed = new EmbedBuilder()
                                .setTitle('🏆 TOP SPENDER LEADERBOARD 🏆')
                                .setColor('#FFD700')
                                .setDescription(desc)
                                .setImage(process.env.BANNER_URL) //
                                .setFooter({ text: `Terima kasih telah berbelanja!`, iconURL: client.user.displayAvatarURL() })
                                .setTimestamp();

                            await msg.edit({ embeds: [embed] }).catch(err => {
                                // Jika pesan tidak ditemukan (dihapus), hapus ID dari config dan hentikan interval
                                if (err.code === 10008 || err.message?.includes('Unknown Message')) {
                                    console.log(`\x1b[33m[WARN]\x1b[0m Leaderboard message tidak ditemukan, membersihkan config...`);
                                    config.leaderboardMessageId = '';
                                    config.save().catch(() => {});
                                    clearInterval(leaderboardInterval);
                                } else if (err.code !== 'UND_ERR_SOCKET' && !err.message?.includes('other side closed')) {
                                    console.error("Auto-Update LB Error:", err);
                                }
                            });

                        } catch (err) {
                            if (err.code !== 'UND_ERR_SOCKET' && !err.message?.includes('other side closed')) {
                                console.error("Auto-Update LB Error:", err);
                            }
                        }
                    }, 30000); // 30 Detik
                } else {
                    // Jika pesan tidak ditemukan saat startup
                    console.log(`\x1b[33m[WARN]\x1b[0m Leaderboard message tidak ditemukan saat startup, membersihkan config...`);
                    config.leaderboardMessageId = '';
                    config.save().catch(() => {});
                }
            }
        }

    } catch (e) { console.error("Gagal Resume Auto-Features:", e); }
});
// --- ANTI-CRASH HANDLERS ---
process.on('unhandledRejection', (reason, p) => {
    console.log(' [antiCrash] :: Unhandled Rejection/Catch');
    console.log(reason, p);
});

mongoose.connect(process.env.MONGO_URI).then(() => { 
    console.log(`\x1b[32m[SYSTEM] ${E.load} DB Connected\x1b[0m`); 
    client.login(process.env.DISCORD_TOKEN); 
}).catch(err => console.error("Database Error:", err));
process.on('uncaughtException', (err, origin) => {
    console.log(' [antiCrash] :: Uncaught Exception/Catch');
    console.log(err, origin);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.log(' [antiCrash] :: Uncaught Exception/Catch (MONITOR)');
    console.log(err, origin);
});