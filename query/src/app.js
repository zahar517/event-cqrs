const Express = require('express');
const amqp = require('amqplib');
const { Client } = require('pg')

const config = {
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
};
const app = Express();
const router = Express.Router();
const client = new Client(config);

(async () => {
    try {
        const dbConnection = await client.connect();
        const amqpConnection = await amqp.connect(`amqp://rabbit`);
        process.once('SIGINT', () => (amqpConnection.close(), dbConnection.close()));

        const exchange = 'logs', type = 'fanout', routingKey = '', queue = '', pattern = '';
        const channel = await amqpConnection.createChannel();
        await channel.assertExchange(exchange, type, { durable: false });
        const q = await channel.assertQueue(queue, { exclusive: true });
        await channel.bindQueue(q.queue, exchange, pattern);
        await channel.consume(q.queue, queueHandler, { noAck: true });

        router.get('/item', getItemList);
        router.get('/correction', getCorrectionList);
        app.use(Express.json()); // for parsing application/json
        app.use(Express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
        app.use(router);

        app.listen('3001', () => console.log('Listen on port 3001...'));

        async function getCorrectionList(req, res) {
            const result = await client.query(`SELECT * FROM correction`);
            res.json(result.rows);
        }

        async function getItemList(req, res) {
            const result = await client.query(`SELECT * FROM item`);
            res.json(result.rows);
        }
        
        async function getItem(req, res) {
            const id = req.params.id;
            const result = await client.query(`SELECT * FROM item WHERE id = $1`, id);
            res.json(result.rows[0]);
        }
        
        async function queueHandler(msg) {
            const { eventId, eventType, entityType, entityId, eventPayload } = JSON.parse(msg.content.toString());
            
            switch (eventType) {
                case 'item_created':
                    const createdKeys = Object.keys(eventPayload);
                    const createdValues = createdKeys.map(key => eventPayload[key]);
                    await client.query(
                        `INSERT INTO item (${createdKeys.join(',')}) values(${createdKeys.map((_, i) => `$${++i}`).join(',')})`,
                        createdValues
                    );
                    break;
                case 'item_updated':
                    const { id, ...updatedKeys } = eventPayload;
                    const updatedSets = Object.keys(updatedKeys).map((key, i) => `${key} = $${++i}`);
                    const updatedValues = Object.keys(updatedKeys).map(key => eventPayload[key]);
                    await client.query(
                        `UPDATE item set ${updatedSets.join(',')} WHERE id = $${updatedValues.length + 1}`,
                        [...updatedValues, entityId]
                    );
                    break;
                case 'correction_created':
                    await client.query(
                        `INSERT INTO correction (id, changes, status) values($1, $2, $3)`,
                        [entityId, JSON.stringify(eventPayload.changes), eventPayload.status]
                    );
                    break;
                case 'correction_status_changed':
                    await client.query(
                        `UPDATE correction SET changes = $1, status = $2 WHERE id = $3`,
                        [ JSON.stringify(eventPayload.changes), eventPayload.status, entityId]
                    );
                    break;
            }
        }
    } catch (error) {
        console.log(error);
    }
})();
