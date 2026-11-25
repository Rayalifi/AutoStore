const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const Config = require('../models/Config');

// -----------------------

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display Top Spender Leaderboard (Auto-Refresh)'),

    async execute(interaction) {
        const msg = await interaction.deferReply({ fetchReply: true });

        async function getLeaderboardContent() {
            try {
                // Sorting berdasarkan totalSpent (Belanja Terbanyak), bukan balance
                const users = await User.find({ totalSpent: { $gt: 0 } }).sort({ totalSpent: -1 }).limit(10);
                const currentTimestamp = Math.floor(Date.now() / 1000);
                
                let desc = `${process.env.EMOJI_LAST_UPDATE || '🕒'} **Last Update:** <t:${currentTimestamp}:R>\n*(Auto refresh every 30 seconds)*\n\n__________________________\n\n**Top Spending Rankings**\n`;

                if (users.length === 0) {
                    desc += "*No spending data yet.*";
                } else {
                    users.forEach((u, index) => {
                        let medal = `${index + 1}.`;
                        if (index === 0) medal = process.env.EMOJI_MEDAL_1 || '🥇';
                        if (index === 1) medal = process.env.EMOJI_MEDAL_2 || '🥈';
                        if (index === 2) medal = process.env.EMOJI_MEDAL_3 || '🥉';

                        // Format: 🥇 @User — RpXXXX
                        desc += `${medal} <@${u.userId}> — **Rp${(u.totalSpent || 0).toLocaleString()}**\n`;
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${process.env.EMOJI_LEADERBOARD_TITLE || '🏆'} TOP SPENDER LEADERBOARD ${process.env.EMOJI_LEADERBOARD_TITLE || '🏆'}`)
                    .setColor('#FFD700') // Warna Gold
                    .setDescription(desc)
                    .setImage(process.env.BANNER_URL) //
                    .setFooter({ text: `Thank you for shopping!`, iconURL: interaction.client.user.displayAvatarURL() })
                    .setTimestamp();

                return { embeds: [embed] };

            } catch (error) {
                console.error("LB Error:", error);
                return null;
            }
        }

        const initialContent = await getLeaderboardContent();
        if (initialContent) {
            await interaction.editReply(initialContent);
            
            await Config.findOneAndUpdate(
                { id: 'main_config' },
                { leaderboardChannelId: msg.channel.id, leaderboardMessageId: msg.id },
                { upsert: true }
            );

            // Auto Refresh 30 detik (sesuai teks di gambar referensi)
            const refreshInterval = setInterval(async () => {
                try {
                    const updatedContent = await getLeaderboardContent();
                    if (updatedContent) await interaction.editReply(updatedContent);
                } catch (err) {
                    if (err.code !== 'UND_ERR_SOCKET' && !err.message?.includes('other side closed')) {
                        clearInterval(refreshInterval);
                    }
                }
            }, 30000);
        }
    },
};