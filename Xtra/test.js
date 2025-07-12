require("dotenv").config({ path: "../.env.development" });
const { OpenAI } = require("openai"); //  npm i openai
console.log(process.env.OPEN_AI_TRANSLATOR_KEY);
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_TRANSLATOR_KEY });

async function translate(bn) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini", // or "gpt-4o" / "gpt-4-turbo"
    messages: [
      {
        role: "system",
        content:
          "You are a professional translator. Translate Bangla to clear, natural English. Keep meaning and tone; do not add commentary.",
      },
      { role: "user", content: bn },
    ],
  });
  return res.choices[0].message.content.trim();
}

translate(
  "কেনো গাল দাও আবার বুঝি না| খুব কালো কোনো কোণে, গান শোনাবো গোপনে দেখো যেনো আর কেউ শোনে নাগান গেয়ে চলে যাবো"
).then(console.log);
