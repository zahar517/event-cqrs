const Express = require('express');
const amqp = require('amqplib');
const uuid = require('uuid');
const lodash = require('lodash');
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

        router.post('/item', createItem);
        router.post('/correction', createCorrection);
        router.put('/correction', changeCorrectionStatus);

        app.use(Express.json()); // for parsing application/json
        app.use(Express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
        app.use(router);

        app.listen('3000', () => console.log('Listen on port 3000...'));

        async function changeCorrectionStatus(req,res) {
            const params = req.body;
            const eventId = uuid.v4();
            const correction = await getEntity(params.id, 'correction');
            const items = lodash.keyBy(
                await Promise.all(lodash.uniq(correction.changes.map(({ id }) => id)).map(id => getEntity(id, 'item'))),
                'id'
            );
            const event = {
                eventId,
                eventType: 'correction_status_changed',
                entityType: 'correction',
                entityId: params.id,
                eventPayload: {
                    status: params.status,
                    changes: correction.changes.map(change => ({ ...change, lastValue: items[change.id][change.prop] }))
                }
            };

            channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)));
            res.sendStatus(204);
        }

        // { id: 1, changes: [{ "id": 1, "prop": "plan", "newValue": 150 }] } => [{ "id": 1, "prop": "plan", "lastValue": 50, "newValue": 150 }]
        async function createCorrection(req,res) {
            const params = req.body;
            const eventId = uuid.v4();
            const items = lodash.keyBy(
                await Promise.all(lodash.uniq(params.changes.map(({ id }) => id)).map(id => getEntity(id, 'item'))),
                'id'
            );
            const event = {
                eventId,
                eventType: 'correction_created',
                entityType: 'correction',
                entityId: params.id,
                eventPayload: {
                    status: 'need_approving',
                    changes: params.changes.map(change => ({ ...change, lastValue: items[change.id][change.prop] }))
                }
            };

            channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)));
            res.sendStatus(201);
        }

        async function updateItems(changes) {
            const items = await Promise.all(lodash.uniq(changes.map(({ id }) => id)).map(id => getEntity(id, 'item')));
            const groupedChanges = lodash.groupBy(changes, 'id');
            items.forEach(item => {
                const currentChanges = groupedChanges[item.id];
                const eventId = uuid.v4();
                const event = {
                    eventId,
                    eventType: 'item_updated',
                    entityType: 'item',
                    entityId: item.id,
                    eventPayload: {
                        id: item.id, 
                        ...currentChanges.reduce((obj, change) => ({ ...obj, [change.prop]: change.newValue }), {})
                    }
                };
    
                channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)));
            });
        }

        function createItem(req, res) {
            const item = req.body;
            const eventId = uuid.v4();
            const event = {
                eventId,
                eventType: 'item_created',
                entityType: 'item',
                entityId: item.id,
                eventPayload: item
            };

            channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)));
            res.sendStatus(201);
        }

        async function getEntity(id, type) {
            const result = await client.query(`SELECT event_payload FROM event WHERE entity_id = $1 AND entity_type = $2`, [id, type]);
            return result.rows.reduce((item, row) => ({ ...item, ...row.event_payload }), {});
        }

        async function queueHandler(msg) {
            const { eventId, eventType, entityType, entityId, eventPayload } = JSON.parse(msg.content.toString());
            await client.query(
                `INSERT INTO event (event_id, event_type, entity_type, entity_id, event_payload) values($1, $2, $3, $4, $5)`,
                [eventId, eventType, entityType, entityId, JSON.stringify(eventPayload)]
            );

            switch (eventType) {
                case 'correction_status_changed':
                    if (eventPayload.status === 'approved') {
                        await updateItems(eventPayload.changes);
                    }
                break;
            }
        }
    } catch (error) {
        console.log(error);
    }
})();
