const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List of bot commands'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle(`${process.env.EMOJI_HELP_BOT || '🤖'} Command List`)
            .setColor('Green')
            .addFields(
                { name: `${process.env.EMOJI_HELP_MEMBER || '👤'} Member`, value: '`/cekstock` - View products\n`/leaderboard` - Top buyers\n`/store` - Main menu' },
                { name: `${process.env.EMOJI_HELP_ADMIN || '🔧'} Admin`, value: '`/addproduk` - Add product\n`/addstok` - Add stock\n`/editproduk` - Edit product\n`/giveproduk` - Send item manually\n`/addbalance` - Add balance\n`/removebalance` - Reduce balance' }
            );

        interaction.reply({ embeds: [embed] });
    }
};