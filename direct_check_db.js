const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_yBFpk6PGSvA5@ep-old-poetry-ah646igj-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
    const client = new Client({
        connectionString: connectionString,
    });
    await client.connect();

    console.log('--- Plans in DB ---');
    const plansRes = await client.query('SELECT id, name, "stripePriceId" FROM "Plan"');
    console.log(plansRes.rows);

    console.log('\n--- Users near target userId ---');
    const userRes = await client.query('SELECT id, email, "stripeCustomerId" FROM "User" WHERE id = \'10cd2e19-b978-4de5-a745-34dfff3278c3\'');
    console.log(userRes.rows);

    await client.end();
}

main().catch(console.error);
