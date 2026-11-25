const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Config = require('../models/Config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ratedl')
        .setDescription('Admin: Set Rate DL (Harga 1 DL dalam Rupiah)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Harga 1 DL dalam Rupiah (Contoh: 15000)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const newRate = interaction.options.getInteger('amount');

        try {
            // 1. Update Database agar permanen (tersimpan meski bot restart)
            await Config.findOneAndUpdate(
                { id: 'main_config' },
                { rateDL: newRate },
                { upsert: true, new: true }
            );
            
            // 2. Update Runtime Variable agar langsung berubah saat ini juga
            process.env.RATE_DL = newRate;

            await interaction.editReply(`✅ **Rate DL Berhasil Diupdate!**\n💎 1 ${process.env.EMOJI_DL || '💎'} = **Rp${newRate.toLocaleString()}**\n*(Rate ini akan berlaku untuk Deposit & Tampilan Store)*`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Gagal mengupdate rate di database.');
        }
    }
};
