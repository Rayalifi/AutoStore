const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Product = require('../models/Product');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addstok')
        .setDescription('Admin: Tambah stok produk (Manual atau Upload File)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => 
            option.setName('code')
                .setDescription('Kode produk yang akan ditambah stoknya')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('stok_teks')
                .setDescription('Input stok secara manual (pisahkan dengan koma jika banyak)')
                .setRequired(false))
        .addAttachmentOption(option => 
            option.setName('stok_file')
                .setDescription('Upload file .txt berisi stok (satu baris satu stok)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const code = interaction.options.getString('code');
        const stokTeks = interaction.options.getString('stok_teks');
        const stokFile = interaction.options.getAttachment('stok_file');

        try {
            // 1. Cari Produk
            const product = await Product.findOne({ code });
            if (!product) return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Produk dengan kode **${code}** tidak ditemukan.`);

            let newStocks = [];

            // 2. Ambil Stok dari Teks (jika ada)
            if (stokTeks) {
                const items = stokTeks.split(',').map(item => item.trim()).filter(item => item !== "");
                newStocks = newStocks.concat(items);
            }

            // 3. Ambil Stok dari File (jika ada)
            if (stokFile) {
                // Pastikan file adalah .txt
                if (!stokFile.name.endsWith('.txt')) {
                    return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} File yang diunggah harus berformat \`.txt\``);
                }

                const response = await axios.get(stokFile.url);
                const fileContent = response.data;
                
                // Pisahkan per baris
                const fileItems = fileContent.split(/\r?\n/).map(item => item.trim()).filter(item => item !== "");
                newStocks = newStocks.concat(fileItems);
            }

            if (newStocks.length === 0) {
                return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Anda harus memasukkan teks stok atau mengunggah file stok.`);
            }

            // 4. Update ke Database
            product.stock = product.stock.concat(newStocks);
            await product.save();

            // 5. Berikan Respon
            interaction.editReply(`${process.env.EMOJI_SUCCESS || '✅'} Berhasil menambahkan **${newStocks.length}** stok baru ke produk **${product.name}** (\`${code}\`).\n${process.env.EMOJI_PRODUCT_BOX || '📦'} Total stok sekarang: **${product.stock.length}**`);

        } catch (error) {
            console.error(error);
            interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Terjadi kesalahan saat memproses stok.`);
        }
    }
};