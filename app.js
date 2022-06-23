const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const { App } = require('@slack/bolt');
const PORT = process.env.PORT || 8080

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  port: PORT,
  socketMode: false
});

(async () => {
  await app.start();

  console.log(`⚡️ Bolt app is running on port: ${PORT}`);
})();

app.event('app_mention', async ({ event, context, client, say }) => {
  try{
    let channelMessages = await getChannelMessages(client, event, 10);

    if(isThread(event)){
      let threadMessages = await getThreadMessages(client, event, 10);

      // Removing last channel message so that it's not included in both thread and channel messages
      // Keeping the last 10 of conbined messages
      channelMessages = channelMessages.pop(); 

      console.log(channelMessages);

      channelMessages = channelMessages.concat(threadMessages).slice(-10);
    }

    let prompt;

    channelMessages.forEach(message => {
      let messageText = message.text;

      if(message.user !== context.botUserId){
        messageText = messageText.replace(messageText.substring(messageText.indexOf('<'), messageText.indexOf('>') + 1), '')
      }

      prompt += `<@${message.user}>: ${messageText}\n`
    });
   
    const response = await openai.createCompletion({
      model: "text-davinci-002",
      prompt: `${prompt} <@${context.botUserId}>: `,
      temperature: 0,
      max_tokens: 100,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });
    
    await say({
      text: response.data.choices[0].text,
      thread_ts: isThread(event) ? event.thread_ts : '',
    });
  }
  catch(err) {
    throw err
  }
});

app.event('app_home_opened', async ({ event, client, context }) => {
  try {
    /* view.publish is the method that your app uses to push a view to the Home tab */
    const result = await client.views.publish({

      /* the user that opened your app's app home */
      user_id: event.user,

      /* the view object that appears in the app home*/
      view: {
        type: 'home',
        callback_id: 'home_view',

        /* body of the view */
        blocks: [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*OpenAI's GPT-3 Bot*"
            }
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "You can identify me and ask me anything,\nI'll answer with an AI generated response following the context of the conversation."
            },
            "accessory": {
              "type": "image",
              "image_url": "https://openai.com/content/images/2022/05/openai-avatar.png",
              "alt_text": "Open AI Logo"
            }
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "OpenAi GPT-3 Playground"
                },
                "url": "https://beta.openai.com/playground"
              }
            ]
          }
        ]
      }
    });
  }
  catch (err) {
    throw err;
  }
});

const isThread = (event) => {
  if(event.thread_ts) return true;
  return false;
}

const getChannelMessages = async (client, event, limit) => {
  try{
    const result = await client.conversations.history({
      channel: event.channel,
      limit: limit
    });
  
    let messages = result.messages.filter((message) => message.subtype == undefined);
    messages = messages.reverse();
  
    return messages;
  }
  catch(err){
    throw err
  }
}

const getThreadMessages = async (client, event, limit) => {
  try{
    const result = await client.conversations.replies({
      channel: event.channel,
      limit: limit,
      ts: event.thread_ts
    });

    let messages = result.messages;

    return messages;
  }
  catch(err){
    throw err
  }
}