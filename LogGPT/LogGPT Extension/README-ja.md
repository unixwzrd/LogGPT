# LogGPT: Chat Log Export Downloader

LogGPT: Conversation Log Export Extension

<https://chatgpt.com/>

OpenAI の ChatGPT 会話ログを JSON 形式でエクスポート（ダウンロード）する拡張機能です。

※ダウンロードした JSON 形式会話ログを閲覧する機能はありません。

## 使い方

このコードは、OpenAI のチャットページで使えるブラウザ拡張機能 ( [FireFox ADD-ONS](https://addons.mozilla.org/ja/firefox/addon/chatgpt-chat-log-export/) )です。

チャットページで会話を行っている間、この拡張機能のアイコン <img src="./icons/download-icon.svg" width="24"> をクリックすると、会話を JSON 形式でダウンロードすることができます。

JSON データは無加工です。チャットのテキスト、日付、時刻など様々な情報が含まれてたままですので、適宜フィルターしてご活用してください。
