const db = require("../../db");
const { QueryCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const sqs = new SQSClient();

const { SESClient } = require("@aws-sdk/client-ses");
const { SendEmailCommand } = require("@aws-sdk/client-ses");

const client = new SESClient({ region: "us-east-1" }); // replace with your region


const handler = async (event) => {
  const now = new Date();
  let count = 0;
  var updateResult;
  const response = { statusCode: 200 };
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      IndexName: "statusAndEndDate",
      KeyConditionExpression: "#status = :status and endingAt < :now",
      ExpressionAttributeValues: marshall({
        ":status": "OPEN",
        ":now": now.toISOString(),
      }),
      ExpressionAttributeNames: {
        "#status": "status",
      },
    };

    const { Items } = await db.send(new QueryCommand(params));

    Items.map((item) => {
      let item_data = unmarshall(item);

      // MAIL SEND 
      sendMail();

      updateResult = updateClosedAuction(item_data);
      console.log(updateResult);
      count++;
    });

    response.statusCode = 200;
    response.body = JSON.stringify({
      message: "Successfully closed " + count + " auction item",
      updateResult: updateResult
    });
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to get auction.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateClosedAuction = async (item) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Key: marshall({ id: item.id }),
    UpdateExpression: "set #status = :status", // set the attribute to a new value
    ExpressionAttributeNames: { "#status": "status" }, // specify the attribute name
    ExpressionAttributeValues: marshall({ ":status": "OPEN" }), // specify the attribute value
  };
  await db.send(new UpdateItemCommand(params)); 

};

const sendMail = async () => {

  
  const params = {
    Source: "mdrabiulhasan.me@gmail.com",
    Destination: {
      ToAddresses: ["rabiul.fci@gmail.com"],
    },
    Message: {
      Subject: {
        Data: "AWS",
      },
      Body: {
        Text: {
          Data:"AWS Send Mail",
        },
      },
    },
  };
  
  const sendEmailCommand = new SendEmailCommand(params);
  
  try {
    const response = await client.send(sendEmailCommand);
    return response;
  } catch (err) {
    console.error(err, err.stack);
  }
};

module.exports = {
  handler,
};
