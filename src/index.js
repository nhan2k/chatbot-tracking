/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Messenger Platform Quick Start Tutorial
 *
 * This is the completed code for the Messenger Platform quick start tutorial
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 * To run this code, you must do the following:
 *
 * 1. Deploy this code to a server running Node.js
 * 2. Run `yarn install`
 * 3. Add your VERIFY_TOKEN and PAGE_ACCESS_TOKEN to your environment vars
 */

"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();

// Imports dependencies and set up http server
const axios = require("axios"),
  express = require("express"),
  app = express();

// Parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Parse application/json
app.use(express.json());

// Respond with 'Hello World' when a GET request is made to the homepage
app.get("/", function (_req, res) {
  res.send("Hello World");
});

// Adds support for GET requests to our webhook
app.get("/webhook", (req, res) => {
  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for your webhook
app.post("/webhook", async (req, res) => {
  let body = req.body;

  // Checks if this is an event from a page subscription
  if (body.object === "page") {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(async function (entry) {
      console.log("🚀 ~ entry", JSON.stringify(entry, null, 4));
      // Gets the body of the webhook event
      let webhookEvent = entry.messaging[0];
      console.log("webhookEvent", webhookEvent);

      // Get the sender PSID
      let senderPsid = webhookEvent.sender.id;
      console.log("Sender PSID: " + senderPsid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function

      if (webhookEvent.message) {
        await handleMessage(senderPsid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(senderPsid, webhookEvent.postback);
      }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {
  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // Construct the message body
  let requestBody = {
    recipient: {
      id: senderPsid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  axios
    .post(
      `https://graph.facebook.com/v15.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      requestBody
    )
    .then((res) => console.log("Message sent!", res.data))
    .catch((err) => {
      console.log("Unable to send message:" + err);
    });
}

// Handles messages events
async function handleMessage(senderPsid, receivedMessage) {
  let response;

  // Checks if the message contains text
  if (receivedMessage.text.includes("/t")) {
    try {
      const orderIds = receivedMessage.text.split(" ")[1];
      const res = await axios.get(
        `https://api.globex.vn/tmm/api/v1/nonAuthen/tracking?keySearch=${orderIds}&sort=createdAt|desc,statusId|desc`
      );

      if (res.data.isSuccess) {
        // Create the payload for a basic text message, which
        // will be added to the body of your request to the Send API
        response = {
          text: `Bấm vào link để xem tình trạng đơn hàng ${orderIds} : https://globex.vn/tra-cuu?trackingNumber=${orderIds}. Nhập mã đơn hàng để xem tình trạng đơn hàng khác.`,
        };
      } else {
        response = {
          text: `Không tìm thấy tình trạng đơn hàng ${orderIds}. Nhập mã vận đơn để xem tình trạng đơn hàng khác.`,
        };
      }
    } catch (error) {
      console.log(error);
      response = {
        text: `Không tìm thấy tình trạng đơn hàng ${orderIds}. Nhập mã vận đơn để xem tình trạng đơn hàng khác.`,
      };
    }
  } else if (receivedMessage.attachments) {
    // Get the URL of the message attachment
    let attachmentUrl = receivedMessage.attachments[0].payload.url;
    response = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Is this the right picture?",
              subtitle: "Tap a button to answer.",
              image_url: attachmentUrl,
              buttons: [
                {
                  type: "postback",
                  title: "Yes!",
                  payload: "yes",
                },
                {
                  type: "postback",
                  title: "No!",
                  payload: "no",
                },
              ],
            },
          ],
        },
      },
    };
  } else {
    try {
      response = {
        text: `Cú pháp không hợp lệ, nhập mã vận đơn với cú pháp : /t (mã vận đơn) hoặc tìm nhiều mã vận đơn : /t (mã vận đơn 1,mã vận đơn 2,...)`,
      };
    } catch (error) {
      console.log(error);
      response = {
        text: `Cú pháp không hợp lệ, nhập mã vận đơn với cú pháp : /t (mã vận đơn) hoặc tìm nhiều mã vận đơn : /t (mã vận đơn 1,mã vận đơn 2,...)`,
      };
    }
  }

  // Send the response message
  callSendAPI(senderPsid, response);
}

// Handles messaging_postbacks events
function handlePostback(senderPsid, receivedPostback) {
  let response;

  // Get the payload for the postback
  let payload = receivedPostback.payload;

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  } else if (payload === "TRACKING") {
    response = {
      text: "Nhập mã vận đơn với cú pháp : /t (mã vận đơn) hoặc tìm nhiều mã vận đơn : /t (mã vận đơn 1,mã vận đơn 2,...)",
    };
  } else if (payload === "get_started") {
    response = {
      text: "Nhập mã vận đơn với cú pháp : /t (mã vận đơn) hoặc tìm nhiều mã vận đơn : /t (mã vận đơn 1,mã vận đơn 2,...)",
    };
  } else {
    response = {
      text: "Cú pháp không hợp lệ, nhập mã vận đơn với cú pháp : /t (mã vận đơn) hoặc tìm nhiều mã vận đơn : /t (mã vận đơn 1,mã vận đơn 2,...)",
    };
  }
  // Send the message to acknowledge the postback
  callSendAPI(senderPsid, response);
}

const handleSetupInfor = async (req, res) => {
  let request_body = {
    get_started: {
      payload: "get_started",
    },

    greeting: [
      {
        locale: "default",
        text: "Hello {{user_full_name}}!",
      },
    ],

    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            type: "postback",
            title: "Tracking",
            payload: "TRACKING",
          },
        ],
      },
    ],
  };

  return new Promise((resolve, reject) => {
    try {
      axios({
        url: `https://graph.facebook.com/v2.6/me/messenger_profile?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
        method: "POST",
        data: request_body,
      })
        .then((res) => {
          console.log(
            "-----------------------------------------------------------"
          );
          console.log("Logs setup button", res.data);
          console.log(
            "-----------------------------------------------------------"
          );
          return res.send("Setup done!");
        })
        .catch((err) => {
          console.log(err);
          return res.send("Something wrongs");
        });
    } catch (error) {
      reject(error);
    }
  });
};
app.post("/set", handleSetupInfor);

// (function () {
//   let request_body = {
//     get_started: {
//       payload: 'get_started',
//     },

//     greeting: [
//       {
//         locale: 'default',
//         text: 'Hello {{user_full_name}}!',
//       },
//     ],

//     persistent_menu: [
//       {
//         locale: 'default',
//         composer_input_disabled: false,
//         call_to_actions: [
//           {
//             type: 'postback',
//             title: 'Tracking',
//             payload: 'TRACKING',
//           },
//         ],
//       },
//     ],
//   };

//   return new Promise((resolve, reject) => {
//     try {
//       axios({
//         url: `https://graph.facebook.com/v2.6/me/messenger_profile?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
//         method: 'POST',
//         data: request_body,
//       })
//         .then((res) => {
//           console.log(
//             '-----------------------------------------------------------'
//           );
//           console.log('Logs setup button', res.data);
//           console.log(
//             '-----------------------------------------------------------'
//           );
//         })
//         .catch((err) => {
//           console.log(JSON.stringify(err));
//         });
//     } catch (error) {
//       reject(error);
//     }
//   });
// })();

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
