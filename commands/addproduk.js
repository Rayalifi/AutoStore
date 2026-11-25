const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Product = require('../models/Product');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addproduk')
        .setDescription('Admin: Tambah produk baru ke etalase')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // 1. Input CODE
        .addStringOption(option => 
            option.setName('code')
                .setDescription('Kode Unik Produk (cth: nf1)')
                .setRequired(true))
        // 2. Input NAME
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Nama Produk')
                .setRequired(true))
        // 3. Input PRICE
        .addIntegerOption(option =>
            option.setName('price')
                .setDescription('Harga Produk')
                .setRequired(true))
        // 4. Input CURRENCY
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('Mata Uang Harga')
                .setRequired(false)
                .addChoices(
                    { name: 'Rupiah', value: 'rupiah' },
                    { name: 'World Lock (WL)', value: 'wl' }
                ))
        // 5. Input ROLE (Sesuai Gambar)
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('Role hadiah saat membeli (Opsional)')
                .setRequired(false))
        // 5. Input DESCRIPTION (+1 More di gambar)
        .addStringOption(option => 
            option.setName('description')
                .setDescription('Deskripsi produk (Opsional)')
                .setRequired(false)),

    async execute(interaction) {
        // Gunakan deferReply agar tidak timeout "Application did not respond"
        await interaction.deferReply({ ephemeral: true });

        // Ambil data dari inputan user
        const code = interaction.options.getString('code');
        const name = interaction.options.getString('name');
        const price = interaction.options.getInteger('price');
        const currency = interaction.options.getString('currency') || 'rupiah';
        const role = interaction.options.getRole('role'); // Ambil object Role
        const desc = interaction.options.getString('description') || "Tidak ada deskripsi";

        try {
            // Cek apakah kode sudah ada
            const exist = await Product.findOne({ code });
            if (exist) return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Kode **${code}** sudah digunakan oleh produk lain.`);

            // Siapkan data Role ID (jika ada)
            const roleIdToSave = role ? role.id : null;
            const roleName = role ? role.name : "Tidak ada";

            // Simpan ke Database
            const newProd = new Product({
                code: code,
                price: price,
                currency: currency,
                name: name,
                description: desc,
                roleId: roleIdToSave, // Simpan ID Role
                stock: []
            });

            await newProd.save();

            const currencyDisplay = currency === 'wl' ? `${price} WL` : `Rp${price.toLocaleString()}`;
            interaction.editReply(`${process.env.EMOJI_SUCCESS || '✅'} **Produk Berhasil Dibuat!**\n${process.env.EMOJI_PRODUCT_BOX || '📦'} Nama: ${name}\n🏷️ Kode: \`${code}\`\n💰 Harga: ${currencyDisplay}\n🎭 Role Hadiah: ${roleName}\n📝 Deskripsi: ${desc}`);
            
        } catch (error) {
            console.error(error);
            interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Terjadi kesalahan database.`);
        }
    }
};