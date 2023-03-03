const db = require("./../../db");
const {
    PutItemCommand
} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { uuid } = require('uuidv4');

const createAuction = async (event) => {
    const response = { statusCode: 200 };

    try {
        const { title } = JSON.parse(event.body);
        const body = {
            id: uuid(),
            title: title,
            status: 'OPEN',
            createdAt: new Date().toISOString()
        }
        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Item: marshall(body || {}),
        };
        const createResult = await db.send(new PutItemCommand(params));

        response.body = JSON.stringify({
            message: "Successfully created auction.",
            createResult,
        });
    } catch (e) {
        console.error(e);
        response.statusCode = 500;
        response.body = JSON.stringify({
            message: "Failed to create auction.",
            errorMsg: e.message,
            errorStack: e.stack,
        });
    }

    return response;
};


module.exports = {
    createAuction
};
