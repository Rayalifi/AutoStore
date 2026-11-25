const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setbalance')
        .setDescription('Admin: Mengatur saldo user ke jumlah tertentu')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User yang ingin diubah saldonya')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Tipe mata uang untuk saldo baru')
                .setRequired(true)
                .addChoices(
                    { name: 'Diamond Lock (DL)', value: 'dl' },
                    { name: 'World Lock (WL)', value: 'wl' },
                    { name: 'Rupiah (Rp)', value: 'rupiah' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Jumlah saldo baru')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const amount = interaction.options.getInteger('amount');

        if (amount < 0) return interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Saldo tidak boleh negatif.`);

        try {
            // Cari user di database
            let user = await User.findOne({ userId: targetUser.id });
            
            // Convert amount to WL
            let amountInWL = 0;
            const rateDL = parseInt(process.env.RATE_DL) || 15000; // Default 15000 if not set

            if (type === 'dl') {
                amountInWL = amount * 100; // DL to WL
            } else if (type === 'wl') {
                amountInWL = amount; // Already in WL
            } else if (type === 'rupiah') {
                amountInWL = Math.floor((amount / rateDL) * 100); // Rupiah to WL
            }

            // Jika belum terdaftar, buatkan akun baru otomatis
            if (!user) {
                user = new User({ 
                    userId: targetUser.id, 
                    username: targetUser.username,
                    balance: 0 
                });
            }

            const oldBalance = user.balance;
            user.balance = amountInWL; // Set directly in WL
            await user.save();

            // LOG KE CHANNEL TOPUP (Karena ini urusan saldo/keuangan)
            // Kita panggil fungsi log dari index.js secara tidak langsung melalui event atau bot client jika perlu,
            // Namun untuk simpelnya kita buat embed respon disini.
            
            const embed = new EmbedBuilder()
                .setTitle('⚖️ SALDO DIUBAH (ADMIN)')
                .setDescription(`**Admin:** <@${interaction.user.id}>\n**Target:** <@${targetUser.id}>\n**Saldo Lama:** ${Math.floor(oldBalance/100)} ${process.env.EMOJI_DL || '💎'} ${oldBalance%100} ${process.env.EMOJI_WL || '🔒'}\n**Saldo Baru:** ${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}`)
                .setColor('Orange')
                .setTimestamp();

            // Kirim notifikasi ke channel log (mengambil ID dari .env)
            const logChannel = await interaction.client.channels.fetch(process.env.CHANNEL_TOPUP_ID).catch(() => null);
            if (logChannel) await logChannel.send({ embeds: [embed] });

            return interaction.editReply(`${process.env.EMOJI_SUCCESS || '✅'} Berhasil mengubah saldo <@${targetUser.id}> menjadi **${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}**`);

        } catch (error) {
            console.error(error);
            interaction.editReply(`${process.env.EMOJI_ERROR || '❌'} Terjadi kesalahan saat mengakses database.`);
        }
    }
};