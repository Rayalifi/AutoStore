﻿const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givebalance')
        .setDescription('Menambahkan saldo ke user (Khusus Admin)')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('User yang akan dikirim saldo')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('type')
                .setDescription('Tipe input saldo')
                .setRequired(true)
                .addChoices(
                    { name: 'Rupiah (Rp)', value: 'rupiah' },
                    { name: 'Diamond Lock (DL)', value: 'dl' },
                    { name: 'World Lock (WL)', value: 'wl' }
                ))
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Jumlah (Rp atau DL)')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const type = interaction.options.getString('type');
        let amount = interaction.options.getInteger('amount');

        if (amount < 1) {
            return interaction.reply({ content: '❌ Jumlah harus lebih dari 0.', ephemeral: true });
        }

        // 🔥 UPDATE: Set ephemeral: true agar hanya admin yang lihat
        await interaction.deferReply({ ephemeral: true });

        try {
            // Konversi ke WL (Satuan Utama)
            let amountInWL = amount;
            const rateDL = parseInt(process.env.RATE_DL) || 15000; // Default 15000 jika tidak ada
            
            if (type === 'rupiah') {
                amountInWL = Math.floor((amount / rateDL) * 100); // Rp -> WL
            } else if (type === 'dl') {
                amountInWL = amount * 100; // DL -> WL
            }

            let user = await User.findOne({ userId: targetUser.id });
            if (!user) {
                user = new User({ userId: targetUser.id, balance: 0, totalSpent: 0 });
            }

            user.balance += amountInWL;
            await user.save();

            // Tentukan tampilan input
            let inputDisplay = '';
            if (type === 'rupiah') {
                inputDisplay = `➕ **Nominal:** Rp${amount.toLocaleString()} (dikonversi ke ${Math.floor(amountInWL/100)} ${process.env.EMOJI_DL || '💎'} ${amountInWL%100} ${process.env.EMOJI_WL || '🔒'})`;
            } else if (type === 'dl') {
                inputDisplay = `💎 **Diamond Lock:** ${amount} ${process.env.EMOJI_DL || '💎'}`;
            } else if (type === 'wl') {
                inputDisplay = `${process.env.EMOJI_WL || '🔒'} **World Lock:** ${amount} ${process.env.EMOJI_WL || '🔒'}`;
            }

            // Embed Sukses (Hanya Admin yang lihat)
            const embed = new EmbedBuilder()
                .setTitle('<a:verifiedicon:1452929190184751195> Add Balance Berhasil') //
                .setColor('#00FF00')
                .setDescription(`
👤 **Target:** ${targetUser}
${inputDisplay}
💰 **Ditambahkan:** ${Math.floor(amountInWL/100)} ${process.env.EMOJI_DL || '💎'} ${amountInWL%100} ${process.env.EMOJI_WL || '🔒'}
💳 **Total Saldo:** ${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}
${type === 'rupiah' ? `📊 **Rate Topup:** Rp${rateDL.toLocaleString()}/1 ${process.env.EMOJI_DL || '💎'}` : ''}
                `)
                .setTimestamp()
                .setFooter({ text: `Added by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

            // Kirim DM ke Target User (User tetap dapat notif di DM)
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('💰 Saldo Masuk')
                    .setColor('#00FF00')
                    .setDescription(`Admin telah menambahkan saldo ke akun Anda.\n\n${inputDisplay}\n💳 **Saldo Sekarang:** ${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}`)
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (err) {
                // Ignore jika DM user tertutup
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses data.' });
        }
    },
};