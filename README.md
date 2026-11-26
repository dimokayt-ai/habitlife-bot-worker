# HabitLife instant bot (Cloudflare Workers)

Мгновенные ответы, бесплатно, без вашего ПК.

## Деплой в один клик

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dimokayt-ai/habitlife-bot-worker)

После деплоя откройте https://habitlife-bot-worker.<ваш-subdomain>.workers.dev/setup — webhook привяжется сам.

## Вручную

~~~bash
npm i -g wrangler
wrangler login
wrangler kv namespace create HL_DATA
wrangler secret put BOT_TOKEN
wrangler secret put ADMIN_TG_IDS
wrangler deploy
~~~

## Проверка

/start боту @habitlife_admin_bot — отвечает сразу.
