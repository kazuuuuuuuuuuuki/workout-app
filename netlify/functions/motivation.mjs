export default async () => {
  // ランダムに返す言葉のリスト
  const quotes = [
    "筋肉は裏切らない！",
    "昨日の自分を超えろ！",
    "痛みなくして成長なし (No Pain, No Gain)",
    "継続は力なり",
    "限界だと思ったところがスタートライン",
    "明日やろうは馬鹿野郎"
  ];

  // ランダムに1つ選ぶ
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  const data = {
    message: randomQuote,
  };

  // React側にデータを返す
  return new Response(JSON.stringify(data));
};