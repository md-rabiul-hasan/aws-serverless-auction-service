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
      await sendMail(item_data); // Add await keyword here to wait for email to be sent before moving to the next item

     
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
    ExpressionAttributeValues: marshall({ ":status": "CLOSE" }), // specify the attribute value
  };
  await db.send(new UpdateItemCommand(params)); 

};

const sendMail = async (item) => {
  const { title, seller, highestBid } = item;

  await notifySeller(seller, title, highestBid.amount); //seller notification 
  await notifyBidder(highestBid.email, title, highestBid.amount); //bidder notification 

};

const notifySeller = async (seller, title, amount) => {
  const params = {
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
      subject: 'Your item has been sold!',
      recipient: seller,
      body: `Woohoo! Your item "${title}" has been sold for $${amount}.`,
    }),
  };
  
  try {
    const data = await sqs.send(new SendMessageCommand(params));
    return data;
  } catch (err) {
    console.error(`Error sending message to ${seller} for ${title}: ${err}`);
  }
};

const notifyBidder = async (bidder, title, amount) => {
  const params = {
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
      subject: 'You won an auction!',
      recipient: bidder,
      body: `What a great deal! You got yourself a "${title}" for $${amount}.`,
    }),
  };
  
  try {
    const data = await sqs.send(new SendMessageCommand(params));
    return data;
  } catch (err) {
    console.error(`Error sending message to ${bidder} for ${title}: ${err}`);
  }
};




module.exports = {
  handler,
};
