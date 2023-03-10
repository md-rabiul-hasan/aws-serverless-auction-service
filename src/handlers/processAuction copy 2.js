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

    // Use for loop instead of map to await for email to be sent before moving to the next item
    for (let i = 0; i < Items.length; i++) {
      let item_data = unmarshall(Items[i]);

      // SELLER MAIL SEND
      await sendMail(item_data.seller, 'Your item has been sold!', `Woohoo! Your itme "${item_data.title}" has been sold for $${item_data.highestBid.amount}.`); // Add await keyword here to wait for email to be sent before moving to the next item

      // BIDDER SEND MAIL
      await sendMail(item_data.highestBid.email, 'Your item has been sold!', `What a great deal! You got yourself a "${item_data.title}" for $${item_data.highestBid.amount}.`);

      updateResult = await updateClosedAuction(item_data);
      count++;
    }

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

const sendMail = async (recipient, subject, body) => {
  
  const params = {
    Source: "mdrabiulhasan.me@gmail.com",
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Subject: {
        Data: subject,
      },
      Body: {
        Text: {
          Data: body,
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
