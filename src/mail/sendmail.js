const { SESClient } = require("@aws-sdk/client-ses");
const { SendEmailCommand } = require("@aws-sdk/client-ses");

const client = new SESClient({ region: "us-east-1" }); // replace with your region


const handler = async (event) => {
  const record = event.Records[0];
  console.log('record processing', record);

  const email = JSON.parse(record.body);
  const { subject, body, recipient } = email;


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
              Data:body,
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
