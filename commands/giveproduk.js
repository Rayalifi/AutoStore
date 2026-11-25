﻿﻿﻿﻿﻿const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Product = require('../models/Product');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveproduk')
        .setDescription('Admin: Kirim produk ke user (Gratis/Giveaway)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(o => o.setName('user').setDescription('Penerima').setRequired(true))
        .addStringOption(o => o.setName('kode').setDescription('Kode Produk').setRequired(true))
        .addIntegerOption(o => 
            o.setName('jumlah')
            .setDescription('Jumlah produk yang akan dikirim (default: 1)')
            .setRequired(false)
            .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('user');
        const code = interaction.options.getString('kode');
        const jumlah = interaction.options.getInteger('jumlah') || 1; // Default 1 jika tidak diisi

        const product = await Product.findOne({ code });
        if (!product) return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Produk tidak ditemukan.`);
        
        // Cek stok cukup
        if (product.stock.length < jumlah) {
            return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Stok tidak cukup. Stok tersedia: ${product.stock.length}, permintaan: ${jumlah}`);
        }

        // Ambil item sesuai jumlah
        const items = [];
        for (let i = 0; i < jumlah; i++) {
            if (product.stock.length > 0) {
                items.push(product.stock.shift()); // Ambil dari stok
            }
        }
        
        await product.save();

        // Gabungkan semua item menjadi string
        const itemsText = items.join('\n');
        
        // Buat file attachment
        const buffer = Buffer.from(itemsText, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `gift_${code}_${jumlah}items.txt` });

        const embed = new EmbedBuilder()
            .setTitle(`${process.env.EMOJI_GIFT || '🎁'} Kamu Mendapatkan Gift!`)
            .setDescription(`Admin mengirimkan **${product.name}** (${jumlah}x) kepadamu.`)
            .addFields({ 
                name: 'Data Item:', 
                value: jumlah === 1 ? 
                    `\`\`\`${items[0]}\`\`\`` : // Jika hanya 1 item, tampilkan langsung
                    `${process.env.EMOJI_PRODUCT_BOX || '📦'} **${jumlah} item** (dilampirkan dalam file .txt)` // Jika banyak, gunakan emoji dari .env
            })
            .setColor('Purple');

        try {
            // Kirim ke DM user
            if (jumlah === 1) {
                await target.send({ embeds: [embed] });
            } else {
                await target.send({ 
                    embeds: [embed],
                    files: [attachment]
                });
            }
            
            // Respons ke admin
            interaction.editReply(`${process.env.EMOJI_SUCCESS || '✅'} Sukses mengirim **${jumlah} ${product.name}** ke ${target.tag}. Stok sisa: ${product.stock.length}`);
            
            // Tambahkan role jika produk punya role (hanya untuk jumlah > 0)
            if (product.roleId && jumlah > 0) {
                try {
                    const member = await interaction.guild.members.fetch(target.id);
                    const role = await interaction.guild.roles.fetch(product.roleId);
                    if (role) await member.roles.add(role);
                } catch (roleErr) {
                    // Ignore jika gagal menambah role
                }
            }
            
        } catch (err) {
            // Jika DM tertutup, kembalikan semua item ke stok
            product.stock = product.stock.concat(items); 
            await product.save();
            interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Gagal DM user (DM tertutup). Stok ${jumlah} item telah dikembalikan.`);
        }
    }
};