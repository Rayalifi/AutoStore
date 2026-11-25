const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removebalance')
        .setDescription('Mengurangi saldo user (Khusus Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Admin-only
        .addUserOption(option =>
            option.setName('target')
                .setDescription('User yang akan dikurangi saldonya')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Tipe mata uang untuk pengurangan saldo')
                .setRequired(true)
                .addChoices(
                    { name: 'Diamond Lock (DL)', value: 'dl' },
                    { name: 'World Lock (WL)', value: 'wl' },
                    { name: 'Rupiah (Rp)', value: 'rupiah' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Jumlah yang akan dikurangi')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const type = interaction.options.getString('type');
        let amount = interaction.options.getInteger('amount');

        if (amount < 1) {
            return interaction.reply({ content: '❌ Jumlah harus lebih dari 0.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            let amountInWL = 0;
            const rateDL = parseInt(process.env.RATE_DL) || 15000;

            if (type === 'dl') {
                amountInWL = amount * 100;
            } else if (type === 'wl') {
                amountInWL = amount;
            } else if (type === 'rupiah') {
                amountInWL = Math.floor((amount / rateDL) * 100);
            }

            let user = await User.findOne({ userId: targetUser.id });
            if (!user || user.balance === 0) {
                return interaction.editReply({ content: `❌ User <@${targetUser.id}> belum terdaftar atau tidak memiliki saldo untuk dikurangi.` });
            }

            if (user.balance < amountInWL) {
                return interaction.editReply({ content: `❌ Saldo <@${targetUser.id}> tidak mencukupi. Saldo saat ini: ${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}` });
            }

            user.balance -= amountInWL;
            await user.save();

            let inputDisplay = '';
            if (type === 'rupiah') {
                inputDisplay = `➖ **Nominal:** Rp${amount.toLocaleString()} (dikonversi dari ${Math.floor(amountInWL/100)} ${process.env.EMOJI_DL || '💎'} ${amountInWL%100} ${process.env.EMOJI_WL || '🔒'})`;
            } else if (type === 'dl') {
                inputDisplay = `💎 **Diamond Lock:** ${amount} ${process.env.EMOJI_DL || '💎'}`;
            } else if (type === 'wl') {
                inputDisplay = `${process.env.EMOJI_WL || '🔒'} **World Lock:** ${amount} ${process.env.EMOJI_WL || '🔒'}`;
            }

            const embed = new EmbedBuilder()
                .setTitle('💸 Saldo Dikurangi (ADMIN)')
                .setColor('#FF0000') // Red for removal
                .setDescription(`
👤 **Target:** ${targetUser}
${inputDisplay}
💰 **Dikurangi:** ${Math.floor(amountInWL/100)} ${process.env.EMOJI_DL || '💎'} ${amountInWL%100} ${process.env.EMOJI_WL || '🔒'}
💳 **Total Saldo:** ${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}
${type === 'rupiah' ? `📊 **Rate Konversi:** Rp${rateDL.toLocaleString()}/1 ${process.env.EMOJI_DL || '💎'}` : ''}
                `)
                .setTimestamp()
                .setFooter({ text: `Removed by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('💸 Saldo Dikurangi')
                    .setColor('#FF0000')
                    .setDescription(`Admin telah mengurangi saldo akun Anda.\n\n${inputDisplay}\n💳 **Saldo Sekarang:** ${Math.floor(user.balance/100)} ${process.env.EMOJI_DL || '💎'} ${user.balance%100} ${process.env.EMOJI_WL || '🔒'}`)
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