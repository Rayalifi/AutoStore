const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removefromleaderboard')
        .setDescription('Admin: Hapus user dari leaderboard (set totalSpent = 0)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User yang akan dihapus dari leaderboard')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Cari user di database
            const user = await User.findOne({ userId: targetUser.id });

            if (!user) {
                return interaction.editReply(`? User **${targetUser.username}** tidak ditemukan di database.`);
            }

            // Simpan nilai totalSpent lama untuk log
            const oldTotalSpent = user.totalSpent || 0;

            if (oldTotalSpent === 0) {
                return interaction.editReply(`?? User **${targetUser.username}** sudah tidak ada di leaderboard (totalSpent = 0).`);
            }

            // Set totalSpent menjadi 0 (otomatis hilang dari leaderboard)
            user.totalSpent = 0;
            await user.save();

            // Embed konfirmasi
            const embed = new EmbedBuilder()
                .setTitle('??? User Dihapus dari Leaderboard')
                .setColor('#FFA500')
                .setDescription(`
?? **User:** ${targetUser} (${targetUser.username})
?? **Total Spent Sebelumnya:** Rp${oldTotalSpent.toLocaleString()}
? **Status:** Berhasil dihapus dari leaderboard
                `)
                .setFooter({ 
                    text: `Dihapus oleh ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Kirim log ke channel khusus jika ada
            const logChannelId = process.env.CHANNEL_TOPUP_ID || process.env.CHANNEL_BUY_ID;
            if (logChannelId) {
                try {
                    const logChannel = await interaction.client.channels.fetch(logChannelId);
                    if (logChannel) {
                        await logChannel.send({ 
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('?? LEADERBOARD UPDATE')
                                    .setColor('#FF0000')
                                    .setDescription(`**User dihapus dari leaderboard**\n?? <@${targetUser.id}>\n??? Oleh: <@${interaction.user.id}>\n?? Total Spent sebelumnya: Rp${oldTotalSpent.toLocaleString()}`)
                                    .setTimestamp()
                            ] 
                        });
                    }
                } catch (err) {
                    console.error('Gagal mengirim log:', err);
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('? Terjadi kesalahan saat memproses permintaan.');
        }
    },
};