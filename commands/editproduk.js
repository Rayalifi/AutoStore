﻿﻿﻿const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Product = require('../models/Product');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editproduk')
        .setDescription('Admin: Edit harga atau nama produk')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('kode').setDescription('Kode Produk').setRequired(true))
        .addIntegerOption(o => o.setName('harga_rupiah').setDescription('Harga Baru dalam Rupiah (Opsional)'))
        .addIntegerOption(o => o.setName('harga_wl').setDescription('Harga Baru dalam WL (Opsional)'))
        .addStringOption(o => o.setName('nama_baru').setDescription('Nama Baru (Opsional)'))
        .addBooleanOption(o => o.setName('active').setDescription('Status Aktif (True = Tampil, False = Sembunyi)')),

    async execute(interaction) {
        // Gunakan deferReply dengan ephemeral: true agar hanya admin yang melihat
        await interaction.deferReply({ ephemeral: true });
        
        const code = interaction.options.getString('kode');
        const hargaRupiah = interaction.options.getInteger('harga_rupiah');
        const hargaWl = interaction.options.getInteger('harga_wl');
        const newName = interaction.options.getString('nama_baru');
        const active = interaction.options.getBoolean('active');

        const product = await Product.findOne({ code });
        if (!product) return interaction.editReply({ content: `${process.env.EMOJI_ERROR || '❌'} Produk tidak ditemukan.` });

        let updates = [];
        if (hargaRupiah !== null) {
            product.price = hargaRupiah;
            updates.push(`Harga -> Rp${hargaRupiah.toLocaleString()}`);
        }
        if (hargaWl !== null) {
            product.priceWl = hargaWl; // Pastikan field priceWl ada di model Product
            updates.push(`Harga WL -> ${hargaWl} ${process.env.EMOJI_WL || '🔒'}`);
        }
        if (newName) {
            product.name = newName;
            updates.push(`Nama -> ${newName}`);
        }
        if (active !== null) {
            product.active = active;
            updates.push(`Status -> ${active ? `${process.env.EMOJI_ACTIVE || '🟢'} Aktif` : `${process.env.EMOJI_INACTIVE || '🔴'} Nonaktif`}`);
        }

        if (updates.length === 0) return interaction.editReply({ content: `${process.env.EMOJI_INFO || 'ℹ️'} Tidak ada perubahan yang dimasukkan.` });

        await product.save();
        interaction.editReply(`${process.env.EMOJI_SUCCESS || '✅'} Produk **${code}** diupdate:\n${updates.join('\n')}`);
    }
};