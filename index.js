const { Database } = require('ark.db'),
    d = require('discord.js'),
    app = require('express')().use(require('cors')()),
    client = new d.Client({
        intents: [
            d.Intents.FLAGS.GUILD_MEMBERS,
            d.Intents.FLAGS.GUILD_INVITES,
            d.Intents.FLAGS.GUILDS
        ]
    }),
    cache = {},
    codes = {},
    last = {},
    db = new Database('storage.json');

client.login(process.env.token?.trim()).catch(() => {
    console.log('Invalid token provided!');
    process.exit(1);
});

client
    .on('messageCreate', () => {})
    .on('ready', async (client) => {
        console.log('Updating data...');
        for (const [, guild] of client.guilds.cache) {
            const d = await fetchInvites(guild);
            if (!d) continue;
            cache[guild.id] = d.res;
            codes[guild.id] = {};
            d.data.forEach((x) => (codes[guild.id][x.code] = x));
        }
        console.log(`API ready on ${client.user.tag}`);
    });

client.on('guildMemberAdd', async ({ guild, user }) => {
    let d = await fetchInvites(guild),
        gcache = cache[guild.id],
        rcache = codes[guild.id];
    if (!d.res) return;
    if (!gcache) return (gcache = d.res);
    const inviter = Object.entries(d.res).find(
        ([k, v]) =>
            Object.entries(gcache).find(([a, b]) => a === k)[1] === v - 1 &&
            d.data.find(
                ({ uses, inviterId, code }) =>
                    inviterId === k && rcache[code].uses === uses
            )
    )?.[0];
    if (!inviter) return;
    last[guild.id] = {
        user: user.id,
        inviter
    };
    rcache = d.data;
    gcache = d.res;
    return db.set(`${guild.id}_${user.id}`, inviter);
});

client.on(
    'guildMemberRemove',
    async ({ user, guild }) =>
        db.get(`${guild.id}_${user.id}`) && db.delete(`${guild.id}_${user.id}`)
);

app.get('/invites/:guild', ({ params }, res) => {
    res.send(cache[params.guild] || e('guild not cached or not found'));
});

app.get('/invited/:guild/:user', ({ params }, res) => {
    const inviter = db.get(`${params.guild}_${params.user}`);
    res.send(
        inviter
            ? {
                  inviter
              }
            : e('inviter not cached or not found')
    );
});

app.listen(process.env.port || 2783);

async function fetchInvites({ invites }) {
    const data = await invites.fetch().catch(() => {}),
        res = {};
    if (!data) return;
    data.forEach(
        ({ inviter, uses }) => (res[inviter.id] = (res[inviter.id] || 0) + uses)
    );
    return { res, data };
}

function e(error) {
    return { error };
}