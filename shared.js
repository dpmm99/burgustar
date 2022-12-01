//To-do list:
//Disabling anything doesn't change the numbers for the current turn, which feels kinda weird; maybe it should show somewhere exactly how much your resource income is reduced by disabling and increased by enabling units. I think the HUD should switch modes to show last-turn change/value, projected next-turn change/value, and current value/storage, and the Enable/Disable menu should simulate the next turn 2x to see the difference caused by enabling/disabling.
//Quick tutorial game on first login
//Mid-game player invites
//Special turn features, like being forced to replay a turn or turns if someone else prevents your action in an earlier turn, and probably an indicator that both shows *when* you're playing relative to the "actual" turn and lets you view past turns
//Button to toggle the way other players' units appear to you
//P2P trade agreements (there should be fewer spawns of rare resources than there are players, so they have to share)
//MakePoster just results in a pure BG-color image on mobile
//Tooltips need to be shown on mobile somehow--e.g. on tap
//Consider making a story log button (which would basically just be the intro + the times you almost lost and it said "ha ha, I'm in danger")
//Possibly dedicated storage structures instead of boundless storage (dorms and tents are already set up to use the storage system)
//Map ping flag placement and removal
//Simple player chat (a Discord embed would be awesome)
//Push updates from the server to all connected clients (e.g. via long-polling or web sockets), if it's not hard

//Put everything in the global scope because NodeJS doesn't trust developers to make their own decisions (aaand now all my constants are variables instead)
//Non-gameplay info about the players
globalThis.players = [];
globalThis.gameStates = []; //The current state of the game followed by the last n states; the current state should always be deep-cloned before updating it to the next turn
//Categories for the units *and* other sprites that we can store with the unitDefinitions for convenience
globalThis.unitCategories = [{ name: "Amenities", nameJP: "アメニティ" }, { name: "Weapons", nameJP: "武器" }, { name: "Energy", nameJP: "電力" }, { name: "Command", nameJP: "幹部" }, { name: "Defense", nameJP: "防御" }, { name: "Mining", nameJP: "採掘" }, { name: "Blockers", hide: true }, { name: "Resources", hide: true }, { name: "HUD", hide: true }, { name: "Markers", hide: true }, { name: "Warnings", hide: true }, { name: "Errors", hide: true }];
//Definitions of all the units in the game (and other sprites). I could store these and their behaviors (as JS) in the database, allowing old games to be reproduced exactly even if I update the unit behaviors.
globalThis.unitDefinitions = [{ name: "Tent", nameJP: "テント", sprite: 0, tier: 0, category: 0, nobuild: true, invulnerable: true, storage: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2], description: "As intense as camping. When insufficient dorms are available, tents will pop up near your other structures so that the extra personnel have a place to stay. The presence of tents puts off would-be immigrants, so build dorms quickly.", descriptionJP: "キャンプみたいに猛烈！（英語のダジャレは翻訳できないな・・・）寮が足りない場合、テントはほかの建物の周りに現れる。おかげで軍人が住む場所が不足していない。テントがあるなら内定者が引くので、速く寮を立てましょう。" },
{ name: "Dorm", nameJP: "寮", sprite: 1, tier: 1, category: 0, cost: [1, 1], activeCost: [0, 1, 0, 0, 0, 0, 0, -4], storage: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4], description: "Everybody's favorite communal housing, because there's no lawn to mow. Both enlisted personnel and officers can stay here, and it's a thousand times nicer than a tent.", descriptionJP: "みんなの大好きな共同住宅・・・刈る芝がないのだから。士官も入隊要員も住まえるこの建物はテントより千倍マシ。" },
{ name: "Dining Facility", nameJP: "食堂", sprite: 2, tier: 2, category: 0, cost: [2, 1, 1], activeCost: [0, 1, 1, 0, 0, 0, 0, 0, -8, 0, 1], demoCost: 2, description: "Healthy, free food, and you don't even have to make it yourself? Can't be beat! Our personnel can survive on powdered food indefinitely, but luxuries like this draw in more volunteers to join our frontier planet base. The dining facility consumes more water than its on-premises condensers can reclaim due to hygiene standards and the garden on the roof.", descriptionJP: "自炊しなくてもいい健全で無料の食事？勝るわけがない！当将兵は粉末食品で無期限に生き残ることができるが、こういう贅沢が有志を私たちのフロンティアプラネットベースにもっと誘導させる。食堂は衛生基準や屋上庭園の為に場内の水凝縮器が再生できる水量より飲料水を費やす。" },
{ name: "Entertainment Complex", nameJP: "レクリエーション施設", sprite: 3, tier: 3, category: 0, cost: [2, 5], activeCost: [0, 5, 0, 0, 0, 0, 0, 0, -6, 0, 1], demoCost: 2, description: "You'll never be bored here with an endless supply of lights and other things that turn electricity into dopamine. The fear of boredom may be the only thing holding many people back from volunteering to join our frontier planet base.", descriptionJP: "ここは無限みたいな電灯などの電気をドーパミンに転換する装置のお陰で将兵が退屈になるわけがない。希望者が私たちのフロンティアプラネットベースに組もうかどうかは退屈恐怖症によるしかないのかもしれない。" },
{ name: "Small Arms Assembly", nameJP: "小型武器組立", sprite: 4, tier: 1, category: 1, cost: [3, 1], activeCost: [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1], description: "Not *those* arms. This unit provides facilities for making handheld weaponry from common resources, providing a small boost to our apparent battle power--as long as there are enough arms to wield them.", descriptionJP: "ベアー・アームズじゃなく・・・。このユニットは小型武器を一般的な資源から生産する施設を提供する。　戦力をわずかに高める・・・アームズ（人手）がある限り。\n\n（翻訳できない冗談：米国憲法修正第2条に搭載する「the right to bear arms」というフレーズは「武器を持つ権利」と意味する。その「bear arms」（武器を持つ）は「a bear's arms」（熊の腕）としてワザと勘違いされてダジャレになる。）" },
{ name: "Explosives Production", nameJP: "爆発物生産所", sprite: 5, tier: 2, category: 1, cost: [5, 3, 0, 1], activeCost: [1, 1, 0, 1, 0, 0, -1, 0, 0, 1, 1], description: "Hit the deck! This facility produces demolition charges and rocket-propelled explosives, both allowing us to demolish structures safely and boosting our battle strength.", descriptionJP: "危ない！この施設は成型炸薬とロケット推進爆薬を生産する。お陰で建物を安全に解体できて、戦力も高める。" },
{ name: "Laser Manufacturing", nameJP: "レーザー工場", sprite: 6, tier: 3, category: 1, cost: [3, 8], activeCost: [0, 8, 0, 0, 0, 0, 0, 0, 0, 1, 1], demoCost: 2, description: "Sharks not included. This production facility produces handheld laser weapons and battery packs. Each battery is only good for one shot, since lasers aren't exactly power-efficient.", descriptionJP: "サメは含まれていません。この生産施設は携帯レーザー武器とバッテリーパックを生み出す。レーザーは特にエネルギー効率が高くないので、各バッテリーが一発しか持たない。" },
{ name: "Solar Panels", nameJP: "ソーラーパネル", sprite: 7, tier: 1, category: 2, cost: [2], activeCost: [0, -1], demoCost: 0, multiConstruct: 3, description: "Free energy! Okay, not exactly, since you can't build a solar panel without any materials. Still, these long-lasting solar panel arrays can power our base for decades to come.", descriptionJP: "無料エネルギー！いや、正確に言えば、資源なしでソラーパネルを作ることができないので有料だ。でもまあ、こういう長持ちするソラーパネルアレイは我々の基地に何十年も電力を供給できるだろう。" },
{ name: "Fission Reactor", nameJP: "核分裂炉", sprite: 8, tier: 2, category: 2, cost: [8, 3, 3, 0, 5], activeCost: [0, -25, 0, 0, 1, 0, 0, 0, 0, 0, 3], demoCost: 2, description: "Have you ever thought that there are too many heavy elements in the universe? If so, then you're in luck, but also weird! This fission reactor splits uranium and converts the generated heat into electricity. The whole 'chance of a nuclear meltdown' thing makes it a bit risky, though.", descriptionJP: "大宇宙に重元素が多すぎると思ったことがありますか？思ったなら変な人だろうけど運が良い！この核分裂炉はウランを分解して、その発生した熱を電気に変換する。炉心溶融の可能性があるので危険だけどね。" },
{ name: "Fusion Reactor", nameJP: "核融合炉", sprite: 9, tier: 3, category: 2, cost: [12, 20, 3, 0, 0, 5], activeCost: [0, -40, 1, 0, 0, 1, 0, 0, 0, 0, 3], demoCost: 3, description: "High-pressure, high-temperature, high-power! No, we're not talking about being scolded by the base commander. Fusion reactors merge the common deuterium and rare tritium to produce heavier elements, and they generate electricity from the waste heat of that process.", descriptionJP: "高圧、高温、高電力！いや、基地司令官に叱れるということじゃない。核融合炉は一般的な重水素と希少なトリチウムを融合して、より重い元素を生産する。発生した廃熱によって、エネルギーを生み出す。" },
{ name: "Breeder Fusion Reactor", nameJP: "核融合増殖炉", sprite: 10, tier: 4, category: 2, cost: [20, 20, 3], activeCost: [0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1], upgradeFrom: 9, demoCost: 0, description: "Power to the particles! By lining the walls of a fusion reactor with lithium, we can produce our own tritium for use in the fusion reactor, eliminating the need for an external tritium supply.", descriptionJP: "パワー・トゥ・ザ・パーティクルズ（原子に力を）！核融合炉の壁をリチウムで裏打ちする経由で、原子炉で活用するトリチウムを自作できる。よっては外部からのトリチウムの補給が不必要になる。" },
{ name: "Command Post", nameJP: "指揮所", sprite: 11, tier: 1, category: 3, cost: [3, 2], activeCost: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2], description: "It's easy to stop someone with a chain, but it's hard to make someone move without a chain of command. These fancy tents provide enlisted leaders a place to meet and dispense commands, but they lose effectiveness as you build more of them. After all, who manages the managers?", descriptionJP: "チェーン（鎖）で誰かを縛れることは易いが、チェーン・オブ・コマンド（命令系統）で誰かを動かすことは難しい。この豪華なテントは打ち合わせて命令を与えるところを下士官に備える。でも、立てれば立てるほど効果が下がる。誰が管理者を管理するだろう？" },
{ name: "Office", nameJP: "事務所", sprite: 12, tier: 2, category: 3, cost: [6, 3, 1], activeCost: [0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2], demoCost: 2, description: "Officers manage the managers. As the enlisted force grows, the chain of command starts to look more like a wall, and that's where these offices come in. Having offices to unify the command posts reduces the diminishing returns of building additional command posts and directly increases the amount of work that can get done in a day. More important people get to demand better treatment, so offices are proper structures that need running water.", descriptionJP: "士官が管理者を管理する。入隊要員が増えるにつれて、チェーン・オブ・コマンド（命令系統）はチェーンじゃなく壁に見えてくる。そこで当の事務所が登場。指揮所を統一する事務所は指揮所数を増やす収穫逓減を減らす。そして一日でできる仕事を直接増やす。大物がもっとよい待遇を請求するので、事務所はちゃんとした建物で、水道が必要。" },
{ name: "Headquarters", nameJP: "本部", sprite: 13, tier: 3, category: 3, cost: [10, 5, 1], activeCost: [0, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 5], demoCost: 2, description: "It's all coming together! Or it would, anyway, if there was a place for it to all come together. Higher-ranked officers can join forces at the headquarters to organize the lower-ranked leaders better, having a cascading positive effect on the chain of command.", descriptionJP: "計画通り！計を描く通りがあったらそうだろう、な。上位士官は本部で組になって下位指導者をよりよく整理できて、命令系統に良好なカスケード効果をもたらす。" },
{ name: "Sandbag Wall", nameJP: "土嚢の壁", sprite: 14, tier: 1, category: 4, cost: [2], demoCost: 0, multiConstruct: 5, blocker: true, description: "Isn't it weird how useful something as common as dirt can be? Surrounding our base with sandbag walls will provide us some protection and buy us some time to respond in the event of an enemy attack.", descriptionJP: "土ほど一般的なものが有用ってことが変だと思わないか？土嚢の壁で私達の基地を囲むことで防衛になって、敵襲が来たらそれにこたえる時間も稼ぐだろう。" },
{ name: "Watch Tower", nameJP: "監視塔", sprite: 15, tier: 2, category: 4, cost: [2, 2], activeCost: [0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 2], description: "It's a guard shack on stilts. Keeping a watch tower manned all day and night is the easiest way to ensure we have sufficient time to react to any incoming attack.", descriptionJP: "竹馬上のガード小屋！敵襲に反応する余裕を保証するには昼夜を問わず監視塔を有人にしていることが確かで一番易しい仕方だ。" },
{ name: "Radar Facility", nameJP: "レーダー施設", sprite: 16, tier: 3, category: 4, cost: [6, 10], activeCost: [0, 10, 0, 0, 0, 0, 0, 0, 0, 2, 3, 1], demoCost: 2, description: "Ooh, spinny! This facility acts as an eye on the sky so we can react as fast as possible to an attack by air and be prepared for bad weather.", descriptionJP: "オォ～くるくる！﻿この施設は空に目を向けて空襲に反応する時間と悪天候のために準備する時間を増やす。" },
{ name: "Dig Site", nameJP: "発掘現場", sprite: 17, tier: 1, category: 5, activeCost: [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], demoCost: 0, description: "Grab a shovel and make some trouble! This planet is covered with resources that suit most of our construction needs; all we need to do is dig them up! ...and process them through simple things like centrifuges, forges, and chemical baths, but let's not think too deeply into it.", descriptionJP: "ショベルを掴んでヤンキー座りでしゃがんで！この惑星は建築に適切な資源まみれで、我々はそれを掘り出すことだけだ！・・・そして遠心機や鍛冶場や化学浴に加工するが・・・あまり深く考えないようにしましょう。" },
{ name: "Drill Site", nameJP: "ドリル現場", sprite: 18, tier: 2, category: 5, mustBuildOn: [22, 23], cost: [5, 3], activeCost: [0, 1, -1, -1, 0, 0, 0, 0, 0, 0, 1], description: "Ever had an itch you just couldn't quite reach? Yeah, don't use a drill for that. If it's a resource, though, that's another story. Drilling machinery provides us access to resources a short distance below the planet's surface, through harder minerals than personnel could break up with shovels.", descriptionJP: "手が届かない痒みがあったことがある？うん、そういうときはドリルを使わないでね。資源だったら話は別だけどね。掘削機械のお陰で人員がショベルで砕けないくらい固い鉱物を通して地殻の下の短距離にある資源に達することができる。" },
{ name: "Deep Mine", nameJP: "深い鉱山", sprite: 19, tier: 3, category: 5, mustBuildOn: [24, 25], cost: [15, 8, 1], activeCost: [-1, 4, 0, 0, -1, -1, 0, 0, 0, 0, 2], demoCost: 3, description: "You've only seen the tip of the iceberg 'til now! These vertical mines will reach deep to extract rare resources.", descriptionJP: "今まで氷山の一角しか見ていない！こういう垂直鉱山は希少な資源を抜き出すために深くまで達する。" },
{ name: "Rough Terrain", nameJP: "険しい地形", sprite: 20, tier: 2, category: 6, cost: [8] /*so you get a 'refund' of 4*/, demoCost: 3, blocker: true, description: "Rugged, rough, and rocky enough! In many places, the ground is so uneven and covered with boulders and outcroppings that our personnel can hardly walk on it, not to mention transport tools and materials through the area. Leveling areas like this with explosives is bound to lead to some kind of discovery eventually.", descriptionJP: "We can't really be sure how they got here, but these ancient ruins often contain resources we can't find elsewhere--at least not in useful quantities or concentrations." },
{ name: "Ancient Ruins", nameJP: "古代遺跡", sprite: 21, tier: 3, category: 6, cost: [4], demoCost: 2, blocker: true, description: "We can't really be sure how they got here, but these ancient ruins often contain resources we can't find elsewhere--at least not in useful quantities or concentrations.", descriptionJP: "古代遺跡はこんなところにある経緯がよくわからないが、他のどこでも見つからない資源がよくある。少なくとも、他の場所では有用な量と濃度がない資源がよく噴飯にある。" },
{ name: "Water Source", nameJP: "水源", sprite: 22, tier: 1, category: 7, invulnerable: true, resourceSupply: [0, 0, 4], description: "Old Faithful's cousin, Fred. Underground rivers are common in this region, so accessing them takes some drilling.", descriptionJP: "オールド・フェイスフル・ガイザーのいとこ、フレッド。この地域では地下河川が一般的であるので、水源につくまで結構な掘削が必要。" },
{ name: "Fuel Deposit", nameJP: "燃料鉱床", sprite: 23, tier: 2, category: 7, invulnerable: true, resourceSupply: [0, 0, 0, 4], description: "What's that smell? Poof! Aluminum and sulfur deposits--or aluminium and sulphur if you like extra letters--provide the base we need for most of our explosive demands.", descriptionJP: "何か臭くない？フッ！鉱床に潜むアルミと硫黄、または（文字の多いほうが好きならば）アルミニウムとサルファが、私達が必要な爆発物の大部分の基礎になる。" },
{ name: "Uranium Deposit", nameJP: "ウラン鉱床", sprite: 24, tier: 3, category: 7, invulnerable: true, resourceSupply: [0, 0, 0, 0, 8], description: "Heavy metal! Heavier elements release more energy when broken apart in a nuclear fission reaction, and uranium is the heaviest stable element found in nature.", descriptionJP: "ヘヴィメタル！元素は核分裂反応で分解されると重ければ重いほどエネルギーを発散する。で、ウランはそのうちの最も重い天然で安定な元素。" },
{ name: "Tritium Source", nameJP: "トリチウム源", sprite: 25, tier: 4, category: 7, invulnerable: true, resourceSupply: [0, 0, 0, 0, 0, 8], description: "No tritium, no life! Actually, not much life even if you have tritium! Tritium has such a short half-life that it's not generally found in nature beyond trace quantities produced in the upper atmosphere, which makes it super handy that the ancient ruins we keep finding tend to have tritium producers that are still functional. Who knows how they work, though.", descriptionJP: "ノートリチウム・ノーライフ！実際にトリチウムがあってもライフはあんまりない！トリチウムは上層大気に微量が生成されるが、大体自然界に見つからないほどハーフライフ（半減期）が短い。それなのに、私達が見つかり続ける古代遺跡にまだ機能しているトリチウム生成機があるということはメッチャ便利。その機械の仕組みは誰もしらんけどな。" },

{ name: "Construction Materials", nameJP: "建材量", sprite: 26, tier: 2, category: 8, baseStorage: 999999, canStockpile: true, refundRate: 0.5, description: "Various chemical compounds and elements that are useful for construction and manufacturing are readily found on the surface of Burgustar, such as iron, limestone, and sandstone.", descriptionJP: "鉄や石灰岩や砂岩など、建設と製造のために役に立つ色々な化学物質や元素はバーガスター惑星の表面にあっさり見つかる。" },
{ name: "Electricity", nameJP: "発電量", sprite: 27, tier: 2, category: 8, producerPriority: 20, baseStorage: 0, description: "Nearly every piece of equipment we use runs on electricity, including our electricity producers and construction equipment, so be sure to keep some slack in the power grid.", descriptionJP: "建設装置も発電施設も、ほぼ私達が使う装置毎は電気で動くので、配電網に余裕を持たせましょう。" },
{ name: "Water", nameJP: "水量", sprite: 28, tier: 2, category: 8, producerPriority: 100, description: "It's always sunny on Burgustar! While we can collect enough water for our survival needs using cheap vapor condensers, for other applications, we need to pump it from underground water sources.", descriptionJP: "バーガスターは今日も晴れ！生存ができる程度に安い大気水収穫機で飲料水を獲得してるが、他の用途のために地下水源から水を汲み上げなければならない。" },
{ name: "Fuel", nameJP: "燃料量", sprite: 29, tier: 2, category: 8, baseStorage: 999999, canStockpile: true, description: "Aluminum deposits provide the basis for producing condensed explosives for all our demolition and rocket propulsion needs.", descriptionJP: "アルミニウム鉱床は、私達のすべての解体やロケット推進のニーズに対応する凝縮爆薬を製造するための基礎を提供する。" },
{ name: "Uranium", nameJP: "ウラン量", sprite: 30, tier: 2, category: 8, baseStorage: 999999, canStockpile: true, description: "Uranium-235 is among the heaviest naturally-occurring elemental isotopes, making it an excellent fuel for heat-producing nuclear fission reactions.", descriptionJP: "ウラン235は、天然に存在する最も重い元素同位体の一つ。そのため、熱を発生する核分裂反応の優れた燃料だ。" },
{ name: "Tritium", nameJP: "トリチウム量", sprite: 31, tier: 2, category: 8, baseStorage: 999999, canStockpile: true, description: "Tritium, also known as hydrogen-3, is a lightweight radioactive element with a half-life of only 12.3 years. Nuclear fusion reactors combine deuterium, which can easily be found in water, with tritium under extreme heat and pressure to produce vast amounts of power.", descriptionJP: "水素3とも呼ばれるトリチウムは、半減期がわずか12.3年の軽量放射性元素だ。核融合炉は、水で見つかりやすい重水素と、トリチウムを極度の熱と圧力で融合して、大量の電力を生成する。" },
{ name: "Demolition Charges", nameJP: "成型炸薬数量", sprite: 32, tier: 2, category: 8, baseStorage: 999999, canStockpile: true, description: "These demolition charges have specially designed shells that focus their explosive force, allowing us to dish out carefully calculated destruction.", descriptionJP: "こういう成形炸薬には、爆発力を集中させる特別に設計された筐体があり、慎重に計算された破壊力を与える。" },
{ name: "Housing", nameJP: "空家数", sprite: 33, tier: 2, category: 8, description: "Humans are very fond of living in permanent shelters. If there aren't enough dorms to house our entire population, they will pitch tents wherever they find space around the base, but they won't be happy about it.", descriptionJP: "人間は恒久住宅にこだわる。人員は全員宿るのに十分な寮がない場合、基地の空き地にどこでもテントを立てるが、全然嬉しくないだろう。" },
{ name: "Luxury", nameJP: "贅沢数量", sprite: 34, tier: 2, category: 8, description: "Not many people want to live somewhere without showers, good food, and fun things to do. On Earth, those may be taken for granted, but such luxuries are the difference between going on a gruelling mission to a frontier planet and and simply making Burgustar your new home. If you need more workers, prepare luxuries to draw them in.", descriptionJP: "シャワー、おいしい食事、楽しいことのないところに住みたいと思う人は少ないだろう。地球上では、それらは当然のことと思われるかもしれないが、そのような贅沢は、フロンティア惑星への激しい任務を遂行することと、単にバーガスター惑星を新しい家にすることの違いだ。 より多くの労働者が必要な場合は、彼らを引き込むための贅沢を準備したほうがいい。" },
{ name: "Command", nameJP: "指揮量", sprite: 35, tier: 2, category: 8, description: "Some units can do their jobs without any guidance from above, but others--particularly, units that are primarily defensive or offensive--require the kind of coordination and cooperation that can only be achieved with a proper chain of command.", descriptionJP: "一部のユニットは上からの指導なしに任務を果たすことができるが、他のユニット、特に防御的または攻撃的であるユニットは、調整と協力を必要とする。それは、適切な指揮系統によってのみ達成できる。" },
{ name: "Enlisted Personnel", nameJP: "入隊要員数", sprite: 36, tier: 2, category: 8, canStockpile: true, reserveInsteadOfConsume: true, description: "Enlisted military members make the bulk of our work force. These denizens are used to getting their hands dirty, but most of them only have an average level of education, so we reserve some jobs for officers.", descriptionJP: "入隊した軍人が私達の労働力の大部分を占めている。 そんな住人は手を汚すのに慣れているが、彼らのほとんどは平均的なレベルの教育しか受けていないので、いくつかの仕事が士官の専務だ。" },
{ name: "Officers", nameJP: "士官数", sprite: 37, tier: 2, category: 8, baseStorage: 1, canStockpile: true, shareStorage: 6, reserveInsteadOfConsume: true, description: "Officers primarily serve as the chain of command. There aren't very many officers, and due to their higher education, they demand better treatment than enlisted personnel, so we have to provide extra luxuries to draw them in.", descriptionJP: "士官は主に指揮系統として機能する。士官は少なく、高等教育を受けているため、入隊した人員よりも優れた待遇を求めている。お陰で、士官を引き込むには余分な贅沢を提供しなければならない。" },
{ name: "Military Readiness", nameJP: "軍事態勢", sprite: 38, tier: 2, category: 8, description: "Our apparent military strength is the one thing--if you can call it a single thing--stopping the hostile species from attacking us out of fear. We can prepare ourselves by constructing defensive and offensive structures and making use of the natural terrain to wall ourselves in, and hopefully, we'll never need any of it.", descriptionJP: "私達の見かけの軍事力は、敵対的な種が恐怖から私達を攻撃するのを阻止する唯一のものだ（もの一つであれば）。防御的で攻撃的な構造を構築し、自然の地形を利用して壁に基地を包むことで、自分自身を準備することができる。うまくいけば、そういうユニット自体は必要にならない。" },
{ name: "Enemy Strength", nameJP: "敵勢", sprite: 39, tier: 2, category: 8, description: "We hesitate to call the alien species' colony our enemy, but we are pitted against one another in a cold war as long as they maintain a hostile attitude. As long as our preparedness exceeds their strength, we believe they will continue to watch and wait, and eventually, they will trust that we never intended any harm.", descriptionJP: "私達は外来種のコロニーを敵と呼ぶことを躊躇するが、彼らが敵対的な態度を維持している限り、冷戦で戦うことになる。私達の準備が彼らの実力を超えている限り、彼らは監視と待機を続け、最終的には私達が害を及ぼすことを決して意図していなかったと彼らは信じるだろう。" },
{ name: "Info", nameJP: "情報", sprite: 40, tier: 2, category: 8, hudButton: true },
{ name: "Screenshot", nameJP: "スクリーンショット", sprite: 41, tier: 2, category: 8, hudButton: true },
{ name: "View Mode", nameJP: "ビューモード", sprite: 42, tier: 2, category: 8, hudButton: true },
{ name: "Flag", nameJP: "旗", sprite: 43, tier: 2, category: 9 },
{ name: "Disabled", nameJP: "無効中", sprite: 44, tier: 2, category: 10, description: "This icon appears on units that the player has disabled.", descriptionJP: "このアイコンは、プレイヤーが無効にしたユニットに表示されまる。" },
{ name: "Warning", sprite: 45, tier: 2, category: 10 },
{ name: "No", sprite: 46, tier: 2, category: 11 },
{ name: "Problem", nameJP: "問題状態", sprite: 47, tier: 2, category: 11, description: "This icon appears on units that lack sufficient resources to function.", descriptionJP: "このアイコンは、機能するのに十分なリソースが不足しているユニットに表示される。" }
];
globalThis.CAT_AMENITIES = 0;
globalThis.CAT_COMMAND = 3;
globalThis.CAT_HUD = 8;
globalThis.CAT_ERRORS = 11;
globalThis.resourceDefinitions = unitDefinitions.filter(p => p.category == CAT_HUD && !p.hudButton);
globalThis.RES_ELECTRICITY = 1;
globalThis.RES_EXPLOSIVES = 6;
globalThis.RES_LUXURY = 8;
globalThis.RES_COMMAND = 9; //Specially calculated command resource
globalThis.RES_PEOPLE = 10; //Enlisted Personnel, for 'storing' people
globalThis.RES_READINESS = 12; //Specially calculated Military Readiness resource
globalThis.RES_ENEMY_STRENGTH = 13; //Specially calculated--the enemy you're up against is just a score
globalThis.UNIT_TENT = 0; //The tents that pop up for free to ensure our people storage is never less than our people count
globalThis.UNIT_SMALL_ARMS = 4;
globalThis.UNIT_EXPLOSIVES = 5;
globalThis.UNIT_LASERS = 6;
globalThis.UNIT_SOLAR_PANELS = 7;
globalThis.UNIT_CMD_POST = 11;
globalThis.UNIT_OFFICE = 12;
globalThis.UNIT_HQ = 13;
globalThis.UNIT_WALL = 14;
globalThis.UNIT_TOWER = 15;
globalThis.UNIT_RADAR = 16;
globalThis.UNIT_DIG_SITE = 17;
globalThis.UNIT_MOUNTAIN = 20;
globalThis.UNIT_RUINS = 21;
globalThis.UNIT_DEP_WATER = 22;
globalThis.UNIT_DEP_FUEL = 23;
globalThis.UNIT_DEP_URANIUM = 24;
globalThis.UNIT_DEP_TRITIUM = 25;
globalThis.HUD_BUTTON_INFO = 40;
globalThis.HUD_BUTTON_SCREENSHOT = 41;
globalThis.HUD_BUTTON_HUD_VIEW_MODE = 42;
globalThis.UNIT_DISABLED = 44;
globalThis.UNIT_INSUFFICIENT_RESOURCES = 47;
//multiple players are allowed to pre-emptively perform their next m moves, but if another player does something that makes one of their moves impossible (which they should perhaps be warned about), their future moves are cancelled
globalThis.TILE_SIZE = 32, NEUTRAL_PLAYER = -1;
globalThis.viewAsPlayerIdx = 0;
globalThis.viewingGameStateIdx = 0; //viewingGameStateIdx is index in gameStates of the state being viewed/played currently
globalThis.baselineGameStateIdx = 0; //The true "current" state of the game--the most recent turn that all active players have played

//Enemy strength / defeat condition constants, shared by the game logic and updateMenu()
globalThis.ENEMY_APPROACH_NOTICE = 2;
globalThis.ENEMY_REPEL_CHECK = 5;
globalThis.GAME_OVER = 99;

//Action types
//Each confirmed player action (resulting in a "delta") is saved in a GameState so that replaying each player's "future" moves (relative to another player's current state) to check for newly invalid moves is easier and we don't have to store the entire game state for every turn
globalThis.actionProperties = [["playerIdx", "x", "y", "unitDefID"], ["playerIdx", "x", "y"], ["playerIdx", "x", "y"], ["playerIdx", "x", "y"], ["playerIdx", "x", "y", "endX", "endY", "unitDefID"], ["playerIdx" /*Turn takes 2 bytes so it's separate*/]];
globalThis.ACT_BUILD = 0;
globalThis.ACT_ENABLE = 1;
globalThis.ACT_DISABLE = 2;
globalThis.ACT_DEMOLISH = 3;
globalThis.ACT_LINE_BUILD = 4;
globalThis.ACT_PLAYER_ACTIVATE = 5;
globalThis.turnEndingActions = [ACT_BUILD, ACT_LINE_BUILD, ACT_DEMOLISH];

//Upgrades should include the parent's demoCost and activeCost automatically. The code here assumes both of them have an activeCost. Also, if there are multiple upgrade levels for the same unit, they need to be in order from lowest to highest level.
//For the construction cost, you'll need to call the addParentActiveCostToUpgrade function, and for the refund cost, call addParentConstructionCostToUpgrade.
unitDefinitions.filter(p => p.upgradeFrom !== undefined).forEach(upg => {
	baseType = unitDefinitions[upg.upgradeFrom];
	for (var x = Math.max(upg.activeCost.length, baseType.activeCost.length); x >= 0; x--) upg.activeCost[x] = (upg.activeCost[x] || 0) + (baseType.activeCost[x] || 0);
	if (baseType.demoCost !== 0) upg.demoCost = (upg.demoCost === undefined ? 1 : upg.demoCost) + (baseType.demoCost || 1); //Demolition cost defaults to 1 when unspecified, so for an upgrade to not increase the demolition cost, its demoCost needs to explicitly be set to 0.
});

globalThis.PlayerState = class {
	constructor(cloneFrom) {
		if (cloneFrom) {
			Object.assign(this, cloneFrom);

			//Any needed deep-copying would go here
			this.resources = this.resources.slice(); //Clone array properly
			this.resourcesProduced = resourceDefinitions.map(_ => 0); //Zeroes out every turn
			this.resourcesConsumed = resourceDefinitions.map(_ => 0);
			this.resourcesInsufficient = resourceDefinitions.map(_ => 0);
			this.treaties = this.treaties.map(p => Object.assign({}, p));
		} else {
			this.playerID = 0; //ID of the player represented by this state. Players can have data not linked to the game turns, such as username, email address, password, last login date... and not all players may be in every game. That info belongs in the global players array.
			this.active = true; //A player can become inactive at any point, permanently or otherwise. Upon reactivating, they can retroactively reactivate up to config.maxAdvancePlays states behind the most recent state that ALL other active players have played. This is the only event when a player may be forced to replay more than config.maxAdvancePlays turns (e.g. A is playing at step n, B is ahead by 5, and C reactivates retroactively at n-5 and constructs a building that blocks B's move at state n-4. Now B has to redo their actions starting from n-4.)
			this.lastImmigrationTurn = 0;
			this.turnsBetweenImmigrations = 5; //Immigrate every 5 turns at the beginning
			this.resources = resourceDefinitions.map(_ => 0); //Array of resource amounts parallel to the resourceDefinitions array.
			this.resourcesProduced = resourceDefinitions.map(_ => 0);
			this.resourcesConsumed = resourceDefinitions.map(_ => 0);
			this.resourcesInsufficient = resourceDefinitions.map(_ => 0); //Resources you wanted to consume but couldn't because production couldn't keep up (note: this may include costs that COULD have been covered, if they weren't together in the same unit with costs that couldn't, but it won't include production that should've happened but couldn't. Compare it to your excess production/stockpile to find the actual deficiency numbers.)
			this.treaties = []; //TODO: Unordered list of active trade agreements (or whatever other agreements I may come up with) with other players.
		}
	}
}

globalThis.GameState = class {
	constructor(cloneFrom) {
		if (cloneFrom) {
			Object.assign(this, cloneFrom);
			this.turn++; //on the assumption that you only clone when advancing the turn
			this.turnsAheadOfBaseline++;

			//Any needed deep-copying would go here
			this.units = this.units.map(p => Object.assign({}, p)); //Don't have to worry about anything beyond shallow-cloning the objects in this array; DOM sprite object references will remain the same
			this.players = this.players.map(p => new PlayerState(p));
			this.actions = [];
		} else {
			this.turn = 0; //Turn should advance by one for every new GameState, and the types of moves a player can perform without advancing to the next GameState should be very limited.
			this.units = []; //All units owned by all players should be in this array.
			this.players = []; //A PlayerState for every player who ever took part in this game should be stored in here.
			this.actions = []; //Once a player performs an action that advances their turn (probably constructing a unit), an object describing their action will be placed in this array. Player turns are first-come, first-serve, but earlier turns always take higher priority over later turns when it comes to making actions invalid.
			this.turnsAheadOfBaseline = 1;
		}
	}

	//Check validity of the given delta (player action) and get the reason as an object (with a string per language and 'hide' if the reason text should normally not display) if the delta is an invalid move
	getReasonIfInvalid(config, delta) { //delta should be a PlayerTurnAction
		if (this.enemyApproach == GAME_OVER) return { text: "Game over", textJP: "ゲームオーバー" }; //No moves allowed after you lose. :P
		if (this.turnsAheadOfBaseline > config.maxAdvancePlays) return { text: "Please wait for other players to catch up.", textJP: "他のプレイヤーが追いつくまで待機してください。" };
		//Check if the move is valid
		var player = this.players[delta.playerIdx];
		if (delta.action == ACT_BUILD) {
			var unitType = unitDefinitions[delta.unitDefID];
			if (unitType.nobuild || unitCategories[unitType.category].hide) return { text: "Unit type cannot be built by players.", textJP: "プレイヤーはこのユニット種を建設できない。" };

			if (delta.x < 0 || delta.y < 0 || delta.x >= config.w || delta.y >= config.h) return { text: "Location out of bounds.", textJP: "地点はマップの範囲外。" };

			//Check that there is a path from the player's other owned units not fully blocked by Blocker units
			if (!player.buildabilityMatrix) player.buildabilityMatrix = player.buildabilityMatrix || getBuildableLocationsForPlayer(config, this, delta.playerIdx); //Calculate if missing when needed
			if (!player.buildabilityMatrix[delta.x + delta.y * config.w]) return { text: "Location out of reach.", textJP: "地点はプレイヤーの範囲外。" };

			//If it's overlapping a unit and shouldn't, or if it needs to overlap a unit and isn't or is overlapping units that don't match the overlap filter, the build is disallowed.
			var overlaps = this.units.filter(p => p.x == delta.x && p.y == delta.y);
			if (unitType.mustBuildOn && (!overlaps.length || overlaps.some(p => !unitType.mustBuildOn.includes(p.unitDefID)))) return { text: "Must be built on specific unit types.", textJP: "特定のユニット種の上に建設しなくてはいけない。" }; //TODO: Say which types. :)

			//Similar, for upgrade units (the last condition is a little different than for mustBuildOn, in case you want to be able to upgrade resource extractors)
			if (unitType.upgradeFrom !== undefined && (!overlaps.length || !overlaps.some(p => unitType.upgradeFrom == p.unitDefID && p.playerIdx == delta.playerIdx))) return { text: "This upgrade can only be applied to your own " + unitDefinitions[unitType.upgradeFrom].name + ".", textJP: "このアップグレードは自分の" + unitDefinitions[unitType.upgradeFrom].nameJP + "にしか当てはまらない。" };

			if (!unitType.mustBuildOn && unitType.upgradeFrom === undefined && overlaps.length) return { text: "Cannot be built on other units.", textJP: "他のユニットの上に建設できない。" }; //Can't overlap

			if (!unitType.cost) return null; //Valid move if there's no cost

			//Include the parent's activeCost in the build cost if it's and upgrade and the parent was active at the start of the turn
			if (overlaps.find(p => unitType.upgradeFrom == p.unitDefID && p.playerIdx == delta.playerIdx && p.wasActiveAtTurnStart)) unitType = addParentActiveCostToUpgrade(unitType);

			//Compare resources
			for (var x = 0; x < resourceDefinitions.length && x < unitType.cost.length; x++) {
				if (!resourceDefinitions[x].reserveInsteadOfConsume && player.resources[x] < unitType.cost[x]) return { text: "Insufficient resources.", textJP: "素材不足。", hide: true }; //Reserved resources can't be part of the construction cost by design
			}
		} else if (delta.action == ACT_DEMOLISH) {
			var unit = this.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == delta.playerIdx);
			if (!unit) unit = this.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == NEUTRAL_PLAYER && !unitDefinitions[p.unitDefID].invulnerable) || this.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == NEUTRAL_PLAYER); //Check if it's a neutral unit (prefer destructible)
			if (!unit) return { text: "Can only demolish your own or neutral units.", textJP: "自分か中立のユニットしか取り壊せない。" }; //Can't demolish if it's not your own or a neutral unit

			var unitType = unitDefinitions[unit.unitDefID];
			if (unitType.invulnerable) return { text: "Unit is invulnerable.", textJP: "このユニットは不滅。" };

			//Check that there is a path from the player's other owned units not fully blocked by Blocker units. Also allow demolition of a unit if there's an accessible tile on any of its four cardinal-direction sides.
			var tilesToCheck = [delta.x + delta.y * config.w];
			if (delta.x > 0) tilesToCheck.push(delta.x - 1 + delta.y * config.w);
			if (delta.x < config.w - 1) tilesToCheck.push(delta.x + 1 + delta.y * config.w);
			if (delta.y > 0) tilesToCheck.push(delta.x + (delta.y - 1) * config.w);
			if (delta.y < config.h - 1) tilesToCheck.push(delta.x + (delta.y + 1) * config.w);
			if (!player.buildabilityMatrix) player.buildabilityMatrix = getBuildableLocationsForPlayer(config, this, delta.playerIdx); //Calculate if missing when needed
			if (tilesToCheck.every(p => !player.buildabilityMatrix[p])) return { text: "Location inaccessible.", textJP: "この地点は到達不能。" }; //If you can't get to it from any side, you can't demolish it; if any one side is accessible, it's accessible enough.

			if (player.resources[RES_EXPLOSIVES] < (unitType.demoCost == undefined ? 1 : unitType.demoCost)) return { text: "Insufficient resources.", textJP: "素材不足。", hide: true }; //Use explosives
		} else if (delta.action == ACT_DISABLE || delta.action == ACT_ENABLE) {
			var unit = this.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == delta.playerIdx && (!p.disabled == (delta.action == ACT_DISABLE))
				&& unitDefinitions[p.unitDefID].activeCost && unitDefinitions[p.unitDefID].activeCost.some(q => q > 0)); //Can't disable buildings that have no per-turn cost, as that would be pointless
			return unit ? null : { text: "No unit or wrong state.", textJP: "ユニットがない、または状態が違う。", hide: true };
		} else if (delta.action == ACT_LINE_BUILD) {
			//At least one of the spaces must be buildable, and the player must have enough resources for at least one unit of that type (but I can easily change that to "enough resources to construct a building in every open space")
			var unitType = unitDefinitions[delta.unitDefID];
			var numberAttempted = 0;
			var tiles = vectorToTiles(delta.x, delta.y, delta.endX, delta.endY);
			for (var x = 0; x < tiles.length; x++) {
				var tempDelta = { action: ACT_BUILD, x: tiles[x].x, y: tiles[x].y, playerIdx: delta.playerIdx, unitDefID: delta.unitDefID };
				if (!this.getReasonIfInvalid(config, tempDelta)) numberAttempted++;
			}
			if (numberAttempted == 0) return { text: "Construction not possible for any unit in the specified line.", textJP: "指定された一行に建設できるユニットがない。" };

			//See if any of your resource amounts are less than the required amount
			for (var x = 0; x < resourceDefinitions.length && x < (unitType.cost || []).length; x++) {
				if (!resourceDefinitions[x].reserveInsteadOfConsume && Math.floor(player.resources[x] / unitType.cost[x]) < numberAttempted) return { text: "Insufficient resources", textJP: "素材不足。", hide: true }; //Reserved resources can't be part of the construction cost by design
			}
		}

		return null;
	}

	//Apply the given change to the current state (for the current player) and advance to the next turn
	update(config, delta) {
		var player = this.players[delta.playerIdx];
		var unitType = unitDefinitions[delta.unitDefID]; //Not all deltas have a unit type, but no problem for JavaScript! (Also, the ACT_DEMOLISH block changes the unit type to the type being demolished.)
		if (delta.action == ACT_BUILD) {
			if (unitType.upgradeFrom !== undefined) { //Upgrade the unit in-place if it's an upgrade; otherwise, add a new unit
				var upgradingFrom = this.units.find(p => p.x == delta.x && p.y == delta.y && unitType.upgradeFrom == p.unitDefID && p.playerIdx == delta.playerIdx);

				//Include the parent's activeCost in the build cost if it's and upgrade and the parent was active at the start of the turn
				if (upgradingFrom.wasActiveAtTurnStart) unitType = addParentActiveCostToUpgrade(unitType);

				upgradingFrom.unitDefID = delta.unitDefID;
			} else {
				this.units.push({ x: delta.x, y: delta.y, playerIdx: delta.playerIdx, unitDefID: delta.unitDefID });
			}

			for (var x = 0; x < resourceDefinitions.length && x < (unitType.cost || []).length; x++) {
				if (!resourceDefinitions[x].reserveInsteadOfConsume) player.resources[x] -= unitType.cost[x]; //Reserved resources can't be part of the construction cost by design
			}
		} else if (delta.action == ACT_DEMOLISH) {
			var unitIndex = this.units.findIndex(p => p.x == delta.x && p.y == delta.y && p.playerIdx == delta.playerIdx);
			if (unitIndex == -1) unitIndex = this.units.findIndex(p => p.x == delta.x && p.y == delta.y && p.playerIdx == NEUTRAL_PLAYER && !unitDefinitions[p.unitDefID].invulnerable); //Check if it's a neutral unit (obviously not allowed to be indestructible)
			unitType = unitDefinitions[this.units[unitIndex].unitDefID];
			if (this.units[unitIndex].sprite) this.units[unitIndex].sprite.remove(); //CLIENT ONLY
			this.units.splice(unitIndex, 1);
			player.resources[RES_EXPLOSIVES] -= (unitType.demoCost == undefined ? 1 : unitType.demoCost); //Use explosives

			unitType = addParentConstructionCostToUpgrade(unitType); //Always include the parent's cost in the refund here if it's an upgrade

			//Potentially give a refund for other involved resources
			(unitType.cost || []).forEach((amount, idx) => player.resources[idx] += Math.floor((resourceDefinitions[idx].refundRate || 0) * amount));
			if (unitType.upgradeFrom !== undefined) (unitDefinitions[unitType.upgradeFrom].cost || []).forEach((amount, idx) => player.resources[idx] += Math.floor((resourceDefinitions[idx].refundRate || 0) * amount)); //If it's an upgrade, also refund for the base unit
		} else if (delta.action == ACT_DISABLE || delta.action == ACT_ENABLE) {
			var unit = this.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == delta.playerIdx && (!p.disabled == (delta.action == ACT_DISABLE)));
			unit.disabled = (delta.action == ACT_DISABLE);
			unit.isActive = !unit.disabled; //to prevent the "problem" icon from appearing when you enable a unit that was disabled at the start of the turn
		} else if (delta.action == ACT_LINE_BUILD) {
			var numberConstructed = 0;

			//Construct a unit in each of the buildable spaces between (inclusive) the two endpoints. Basically, draw a line from (delta.x, .y) to (.endX, .endY).
			var tiles = vectorToTiles(delta.x, delta.y, delta.endX, delta.endY);
			for (var x = 0; x < tiles.length; x++) {
				var tempDelta = { action: ACT_BUILD, x: tiles[x].x, y: tiles[x].y, playerIdx: delta.playerIdx, unitDefID: delta.unitDefID };
				if (!this.getReasonIfInvalid(config, tempDelta)) { //Use the standard validity check to see if this tile is buildable
					this.units.push({ x: tempDelta.x, y: tempDelta.y, playerIdx: delta.playerIdx, unitDefID: delta.unitDefID });
					numberConstructed++;
				}
			}

			//Deduct resources for the number of units that were actually built (same code as for the ACT_BUILD delta type, but with a multiplier of numberConstructed)
			for (var x = 0; x < resourceDefinitions.length && x < (unitType.cost || []).length; x++) {
				if (!resourceDefinitions[x].reserveInsteadOfConsume) player.resources[x] -= unitType.cost[x] * numberConstructed; //Reserved resources can't be part of the construction cost by design
			}
		}

		//Update buildability matrix only if needed (it's a bit of a misnomer--the buildability matrix stored in the player object is only based on unit types with blocker=true)
		//TODO: I can be even more efficient by only running this if the action took place cardinally adjacent to an empty but non-buildable tile (i.e. only when it renders *more* than one new tile buildable, and in other cases, just set the one tile's new state). I can also not update the matrices for players that haven't gotten to this turn yet...
		if (unitType && unitType.blocker) for (var x = 0; x < this.players.length; x++) this.players[x].buildabilityMatrix = getBuildableLocationsForPlayer(config, this, x); //Update ALL players' buildability matrices (since the units changed) so the tent spawns know where to go

		//TODO: (in the caller) for all players, validate the next turn's action if they have one, and if it's invalid, remove it and every following action for that player...or rather than "removing" the action, the server should show the player what they tried to do that is no longer possible, so they can keep their other future moves if they want.
		if (!player.active) {
			if (delta.action != ACT_PLAYER_ACTIVATE) this.actions.push({ action: ACT_PLAYER_ACTIVATE, playerIdx: delta.playerIdx, turn: this.turn }); //Avoid duplicating activation deltas on the server when one is submitted
			player.active = true;
		}
		this.actions.push(delta);
		if (this.players.every((p, idx) => !p.active || this.actions.some(q => q.playerIdx == idx && turnEndingActions.includes(q.action)))) this.turnsAheadOfBaseline = 0; //This is equal to or before the 'baseline' state if every player is either inactive or has completed this turn.
	}
}

/**
 * Get a set of tiles (objects with x and y fields) to treat as desirable candidates for placing units. May return tiles outside the map bounds, including with negative coordinates.
 * This is basically a non-antialiased rasterizing function that never adjoins 3 tiles (including diagonally).
 * @param startX Vector initial X position in tiles
 * @param startY Vector initial Y position in tiles
 * @param endX Vector final X position in tiles
 * @param endY Vector final Y position in tiles
 */
globalThis.vectorToTiles = function (startX, startY, endX, endY) {
	const angle = Math.atan2(endY - startY, endX - startX);
	const count = Math.max(Math.abs(startX - endX), Math.abs(startY - endY)) + 1;
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	const b = (dx == 0 ? 0 : startY + 0.5 - dy / dx * (startX + 0.5)); //Not used if dx is 0, in which case it's also not calculable. Start in the middle of the first square.

	var filledTiles = []; //array of tiles we want to fill in, with x and y in terms of tiles

	function getArea(tile) { //note that "top" is the lesser y value in this function definition
		const topIntersect = (tile.y - b) * dx / dy; //the X position where the top of the tile intersects the main line
		const bottomIntersect = (tile.y + 1 - b) * dx / dy;
		const leftIntersect = dy / dx * tile.x + b;
		const rightIntersect = dy / dx * (tile.x + 1) + b;

		//Special cases thanks to perfect 45-degree angles. It might only intersect two sides according to the below booleans, but in reality, what it intersects are *corners* (so it's basically intersecting all four sides)
		//The machine epsilon shouldn't matter in any other case with a reasonably small maximum length.
		if (leftIntersect + 0.0000000000001 >= tile.y && leftIntersect <= tile.y + 1.0000000000001 && rightIntersect + 0.0000000000001 >= tile.y && rightIntersect <= tile.y + 1.0000000000001 && topIntersect + 0.0000000000001 >= tile.x && topIntersect <= tile.x + 1.0000000000001 && bottomIntersect + 0.0000000000001 >= tile.x && bottomIntersect <= tile.x + 1.0000000000001) return 1;

		const intersectsTop = (topIntersect >= tile.x && topIntersect < tile.x + 1);
		const intersectsBottom = (bottomIntersect >= tile.x && bottomIntersect < tile.x + 1);
		const intersectsLeft = (leftIntersect >= tile.y && leftIntersect < tile.y + 1);
		const intersectsRight = (rightIntersect >= tile.y && rightIntersect < tile.y + 1);

		if (!intersectsTop && !intersectsBottom) { //Horizontal or no intersection
			return intersectsLeft && intersectsRight ? 1 : 0; //Range is 0 to 1 so we're returning the fraction of the rectangle covered
		} else if (intersectsTop) {
			if (intersectsBottom) return 1;
			if (intersectsLeft) return (topIntersect - tile.x) * (leftIntersect - tile.y); //double the smaller cut-off triangle's area
			else return (tile.x + 1 - topIntersect) * (rightIntersect - tile.y); //top-right piece
		} else if (intersectsBottom) {
			if (intersectsLeft) return (bottomIntersect - tile.x) * (tile.y + 1 - leftIntersect);
			else return (tile.x + 1 - bottomIntersect) * (tile.y + 1 - rightIntersect); //bottom-right piece
		}
	}

	var lastPos = { x: startX, y: startY };
	filledTiles.push(lastPos);
	while (filledTiles.length < count) {
		//Check around the last tile filled in to find all the adjacent tiles that aren't already filled in that are our candidates.
		var tiles = [];
		if (dx == 0) tiles.push({ x: lastPos.x, y: lastPos.y + 1 });
		else if (dy == 0) tiles.push({ x: lastPos.x + 1, y: lastPos.y });
		else if (dx < 0) {
			if (dy < 0) {
				tiles = [{ x: lastPos.x - 1, y: lastPos.y }, { x: lastPos.x - 1, y: lastPos.y - 1 }, { x: lastPos.x, y: lastPos.y - 1 }];
			} else {
				tiles = [{ x: lastPos.x - 1, y: lastPos.y }, { x: lastPos.x - 1, y: lastPos.y + 1 }, { x: lastPos.x, y: lastPos.y + 1 }];
			}
		} else { //dx > 0 and dy != 0
			if (dy < 0) {
				tiles = [{ x: lastPos.x + 1, y: lastPos.y }, { x: lastPos.x + 1, y: lastPos.y - 1 }, { x: lastPos.x, y: lastPos.y - 1 }];
			} else {
				tiles = [{ x: lastPos.x + 1, y: lastPos.y }, { x: lastPos.x + 1, y: lastPos.y + 1 }, { x: lastPos.x, y: lastPos.y + 1 }];
			}
		}
		tiles.forEach(p => p.area = getArea(p));
		while (tiles.length > 1) if (tiles[0].area < tiles[1].area) tiles.splice(0, 1); else tiles.splice(1, 1); //Get the max
		filledTiles.push(lastPos = tiles[0]);
	}

	return filledTiles;
}

globalThis.advanceTurn = function (config, currentState, nextState) {
	runTentSpawns(config, currentState, nextState); //We need to check for tent-spawning needs before running the resource calculations in case the player demolished any dorms, because the population would get capped and people would disappear otherwise.
	runResources(config, currentState, nextState);
	runImmigration(config, currentState, nextState);
	runTentSpawns(config, nextState); //Spawn tents right away for new migrants
}

globalThis.unitPriority = function (unitDef) { //A lower return value is a higher priority ranking (i.e. the lowest number is the most important unit)
	//Order roughly by producers (free) -> producers (using stockpiled resources only) -> producers (using non-stockpiled resources) -> pure consumers. It doesn't matter at all where units end up if they neither produce nor consume, but no such units should exist.
	var value = 0;
	if (unitDef.activeCost.every(p => p <= 0)) value -= 10000;
	//else if (unitDef.activeCost.every(p => p >= 0)) value += 10000; //Not really reasonable, as these must have *calculated* benefits, but that's a good argument for setting the priority manually

	for (var x = 0; x < resourceDefinitions.length && x < unitDef.activeCost.length; x++)
		value += unitDef.activeCost[x] * (unitDef.activeCost[x] < 0 ? (resourceDefinitions[x].producerPriority || 10) : (resourceDefinitions[x].canStockpile ? 1 : 10));
	//TODO: Later, I could actually prioritize by what resource you have the most excess of (although that would be awfully hard to do efficiently for command units)
	//Note: if all your power producers require water and your water producers require power, but they're both non-stockpiled resources, neither can activate (even though they could both be active if one could temporarily incur a debt or if you picked both at once instead of one at a time in the runResources() activation algorithm)

	return value;
}

globalThis.calculateCommandResource = function (playerUnits) { //playerUnits can be all the player's units or just their CAT_COMMAND ones; doesn't matter (but the latter is faster).
	var commandPosts = playerUnits.filter(p => p.unitDefID == UNIT_CMD_POST && p.isActive).length;
	var offices = playerUnits.filter(p => p.unitDefID == UNIT_OFFICE && p.isActive).length;
	var headquarters = playerUnits.filter(p => p.unitDefID == UNIT_HQ && p.isActive).length;
	var officeDebuff = Math.min(Math.max((4 * headquarters + 2) / (offices + 1), 0), 1); //Clamp between 0 and 1. Offices lose some fraction of their efficacy if there are too many proportionally to how many headquarters there are. This is the efficacy *multiplier*.
	var commandPostDebuff = Math.min(Math.max((4 * offices * officeDebuff + 2) / (commandPosts + 1), 0.2), 1); //Command posts can't be worse than 20% effective, just to be nice...

	return Math.ceil(commandPosts * commandPostDebuff * 2 + offices * officeDebuff * 5 + Math.sqrt(headquarters) * 15) + 5; //You get 5 base units of command just for being the colony's commander
}

globalThis.calculateDistanceDiffsFromWalls = function (config, units) {
	//Get a tilemap of the traversable and non-traversable spaces. Use 0 for blocked and 1 for traversable, so we can set the traversable ones to 2 when they've been traversed on the first loop iteration, 3 on the second iteration, etc. so we don't have to recreate the array each time.
	//TODO: This one might be worth only recalculating when a blocker unit is created or destroyed. In fact, we could ignore creation or destruction of blockers where all the adjacent non-blocker tiles have a distanceDiffs[] value of 12 (way off-course or unreachable anyway).
	var traversalMatrix = new Array(config.w * config.h).fill(1);
	for (var x = 0; x < units.length; x++) if (unitDefinitions[units[x].unitDefID].blocker) traversalMatrix[units[x].x + units[x].y * config.w] = 10; //Use any number larger than 5 (number of walls + 1) for fully blocked tiles
	var distanceDiffs = new Array(config.w * config.h).fill(0); //This will be updated from distanceMap after each iteration. It's the sum of the log of the difference from the expected distance to the minimum path-found distance for each iteration.
	for (var wall = 0; wall < 4; wall++) { //We'll go with 0=left wall, 1=top wall, 2=right wall, 3=bottom wall, so x & 2 == 0 means the numbers are 1-based and x & 2 == 1 means the numbers are config.w- or h-based, and x & 1 == 0 means horizontal and x & 1 == 1 means vertical
		var traversalConstant = wall + 2; //0 being non-traversable and anything between 0 and traversalConstant being traversable, with tiles equal to traversalConstant having already been visited for this iteration
		var distanceMap = new Array(config.w * config.h).fill(0); //For our distances, we'll start at 1 and reserve 0 for "unreachable". We need a new distance map for each of our 4 iterations so we can calculate a "how much farther to reach this tile than if it wasn't blocked" number for every tile and average that between the iterations.
		var curList = []; //Tiles to traverse during the current iteration
		var nextList; //Since we always increase distance by 1, we can check every tile in curList and add new ones to nextList, then when curList is empty, swap the lists and keep going

		if (wall == 0) nextList = Array.from({ length: config.h }, (_, i) => i * config.w); //Left
		else if (wall == 1) nextList = Array.from({ length: config.w }, (_, i) => i); //Top
		else if (wall == 2) nextList = Array.from({ length: config.h }, (_, i) => (i + 1) * config.w - 1); //Right
		else if (wall == 3) nextList = Array.from({ length: config.w }, (_, i) => config.w * (config.h - 1) + i); //Bottom

		//Prepare the edge tiles and prune 'nextList' (if there are any blocked map-edge tiles) before starting the flood fill
		for (var x = nextList.length - 1; x >= 0; x--) {
			if (traversalMatrix[nextList[x]] < 10) {
				traversalMatrix[nextList[x]] = traversalConstant; //Mark traversable tiles as already traversed
				distanceMap[nextList[x]] = 1; //Initial distance is 1 so that 0 indicates unreachable
			}
			else nextList.splice(x, 1); //Drop entries that lie on a non-traversable block
		}

		var currentDistance = 1; //Edge tiles were 1 (hence we increment at the *start* of the loop to get 2 for the next row/column of tiles near the edge)
		while (nextList.length) {
			currentDistance++;
			curList = nextList;
			nextList = [];

			//Visit via the 4 cardinal directions only. Adjacent tiles that are passable and not already traversed get put into nextList for the next loop iteration.
			for (var x = 0; x < curList.length; x++) {
				var L = curList[x] - 1;
				var R = curList[x] + 1;
				var U = curList[x] - config.w;
				var D = curList[x] + config.w;

				if (curList[x] % config.w != 0 /*in map bounds, no wrap*/ && traversalMatrix[L] < traversalConstant /*not yet visited from this wall OR impassable*/) { nextList.push(L); distanceMap[L] = currentDistance; traversalMatrix[L] = traversalConstant; }
				if (U >= 0								  /*in map bounds*/ && traversalMatrix[U] < traversalConstant /*not yet visited from this wall OR impassable*/) { nextList.push(U); distanceMap[U] = currentDistance; traversalMatrix[U] = traversalConstant; }
				if (R % config.w != 0		  /*in map bounds, no wrap*/ && traversalMatrix[R] < traversalConstant /*not yet visited from this wall OR impassable*/) { nextList.push(R); distanceMap[R] = currentDistance; traversalMatrix[R] = traversalConstant; }
				if (D < traversalMatrix.length			  /*in map bounds*/ && traversalMatrix[D] < traversalConstant /*not yet visited from this wall OR impassable*/) { nextList.push(D); distanceMap[D] = currentDistance; traversalMatrix[D] = traversalConstant; }
			}
		} //When this loop exits, we've completed the flood-fill starting at this wall.

		var expectedDistance;
		if (wall == 0) expectedDistance = (x) => x % config.w + 1; //Left (remember, distance starts at 1 along the edge where x is 0)
		else if (wall == 1) expectedDistance = (x) => Math.floor(x / config.w) + 1; //Top
		else if (wall == 2) expectedDistance = (x) => config.w - (x % config.w); //Right (if w is 64, x % w would be 63, so 1 is the minimum, just like we wanted)
		else if (wall == 3) expectedDistance = (x) => config.h - Math.floor(x / config.w); //Bottom

		for (var x = 0; x < distanceDiffs.length; x++) distanceDiffs[x] += (distanceMap[x] == 0 ? 3 : Math.min(3, Math.log(distanceMap[x] - expectedDistance(x) + 1))); //Add 1 so when the distance was exactly what was expected, the log is 0. Cap the value at 3 (path bent by about 20 units).
	}

	return distanceDiffs;
}

globalThis.calculateMilitaryReadiness = function (config, units, players) {
	//I really want this to be more specific than "each solar panel is worth a point", so, like, having a fusion reactor outside your walls with 0 excess power would be extremely bad, but having it just inside the wall would be slightly bad, and having 50 excess power would be good but 100 not much better
	var readinessScore = 0;
	var distanceDiffs = calculateDistanceDiffsFromWalls(config, units); //Allows us to increase each unit's value based on how much extra distance a valid land path from a map edge to the unit would cover. Note that the value ranges from 0 to 12 (4 for four walls times the cap of 3).

	//Reward the players for active (or never-able-to-disable), sufficiently-fueled units, depending on the tier/type
	var relevantUnits = units.filter(p => (p.isActive || !unitDefinitions[p.unitDefID].activeCost) && p.playerIdx != NEUTRAL_PLAYER);
	var unitCounts = unitDefinitions.map(_ => 0);
	relevantUnits.forEach(p => unitCounts[p.unitDefID]++);

	//Amassing unnecessary solar panels is an easy way to beat the game with nothing but power and a few dig sites, so apply diminishing returns to them when power production greatly exceeds the base's needs (say, 1.1x the needs + 15 power)
	var solarPowerExcessFactor = 1;
	if (unitCounts[UNIT_SOLAR_PANELS] > 10) {
		var electricProduction = -players.reduce((tot, cur) => tot + cur.resourcesProduced[RES_ELECTRICITY], 0);
		var electricConsumption = players.reduce((tot, cur) => tot + cur.resourcesConsumed[RES_ELECTRICITY], 0);
		solarPowerExcessFactor = 2 / (1 + Math.pow(1.5, (electricProduction - electricConsumption) / (electricConsumption * 1.1 + 25))); //Consumption can't possibly be higher than production, so this number ranges from 0 to 1 (always 1 at 0 excess production).
	}

	//Get a base score for just the active units (this kinda counts as rewarding the players for redundancy/excess units and also considers the walling)
	var towerWallMultiplierSum = 0, radarWallMultiplierSum = 0;
	relevantUnits.forEach(unit => {
		var wallMultiplier = distanceDiffs[unit.x + unit.y * config.w] / 6 + 1; //Well-defended units can be worth up to 3x as much (12/6 + 1).
		var baseValue = unitDefinitions[unit.unitDefID].tier * 0.05 + 0.45; //0.45, 0.5, 0.55, 0.6, so higher-tier units aren't just straight-up worth 3x what the lower-tier ones are.
		if (unit.unitDefID == UNIT_TENT) baseValue = -0.3; //Tents are uncomfortable enough to lower morale, so not only do they not give value, they take value away
		else if (unit.unitDefID == UNIT_TOWER) towerWallMultiplierSum += wallMultiplier; //Watch Towers and Radar Facilities use a diminishing returns formula, so we need to know their full count. We'll add up their wall multipliers and average it at the end. //TODO: It'd be better to add up their scores and track their counts here than to use a formula, though.
		else if (unit.unitDefID == UNIT_RADAR) radarWallMultiplierSum += wallMultiplier; //TODO: I'd actually also like watch towers and radar to be worth less when close together, but I'd need a good formula so that adding a radar/tower never REDUCES their total value.
		else if (unit.unitDefID == UNIT_WALL) baseValue = 0; //Walls are already worth a lot just because they block enemy paths; they shouldn't be worth extra to just build more of for no reason.
		else if (unit.unitDefID == UNIT_SOLAR_PANELS) baseValue *= solarPowerExcessFactor; //Greatly lower the value of excessive solar panels since they're easy to build en masse and are highly valuable, but it makes no sense for them to be valuable if you have much more than enough

		if (isNaN(wallMultiplier)) return; //This is a fix that normally wouldn't be needed, but I spawned some units outside the map bounds once.
		readinessScore += wallMultiplier * baseValue;
	});

	//Units of militaristic nature are worth much more, but only if there are people to wield them in case of weapons.
	var totalPopulation = players.map(p => p.resources[RES_PEOPLE] + p.resources[RES_PEOPLE + 1]).reduce((tot, cur) => tot + cur, 0);
	var militaristicUnits = [{ idx: UNIT_SMALL_ARMS, value: 2 }, { idx: UNIT_EXPLOSIVES, value: 3 }, { idx: UNIT_LASERS, value: 4 }]; //Lowest to highest priority--and note these values are per armed person
	while (militaristicUnits.length) { //Note: This loop would be pointless if I didn't make the armed-people-per-unit greater than one, because the units themselves require 1 employed person in order to be active.
		var type = militaristicUnits.pop();
		var employ = Math.min(totalPopulation, unitCounts[type.idx] * 5); //Each unit arms 5 people
		totalPopulation -= employ;
		readinessScore += employ * type.value;
	}

	//Some extra points for active observational units, but fewer points if you have no or almost no weapons
	var unarmedFactor = Math.min(7, 2 + unitCounts[UNIT_SMALL_ARMS] + unitCounts[UNIT_EXPLOSIVES] + unitCounts[UNIT_LASERS]) / 7; //Ranges from 2/7 when you have no offensive units to 1 when you have at least 5--basically just to keep the info-ops units from having their full value until you also have troops that can act on the information obtained
	if (unitCounts[UNIT_TOWER]) readinessScore += (Math.min(unitCounts[UNIT_TOWER], 20 / 4096 * config.w * config.h) * 5 + 7 * Math.log(1 + Math.max(0, unitCounts[UNIT_TOWER] - 20 / 4096 * config.w * config.h))) * towerWallMultiplierSum / unitCounts[UNIT_TOWER] * unarmedFactor; //Diminishing returns based on the map area; 20 on a 64x64 map is the max before the diminishing returns kick in.
	if (unitCounts[UNIT_RADAR]) readinessScore += (Math.min(unitCounts[UNIT_RADAR], 5 / 4096 * config.w * config.h) * 15 + 20 * Math.log(1 + Math.max(0, unitCounts[UNIT_RADAR] - 5 / 4096 * config.w * config.h))) * radarWallMultiplierSum / unitCounts[UNIT_RADAR] * unarmedFactor; //5 before diminishing returns; having 10 is worth 110 on a 64x64 map.

	//TODO: Reward the players for excess stock of stockpilable resources, but preferably in a way that doesn't cause them to immediately *lose* readiness when they build something that uses the resource (i.e. it can't easily be based on production, even though that makes sense)
	return Math.max(0, Math.ceil(readinessScore));
}

function calculateEnemyStrength(config, prevState, newState) {
	var lastTurnEnemyStrength = prevState.players[0].resources[RES_ENEMY_STRENGTH];
	var teamReadiness = newState.players[0].resources[RES_READINESS];
	var playerMultiplier = newState.players.length * 0.9 + 0.1; //1 for 1 player, 1.9 for two players, 2.8 for three, 3.7 for four
	playerMultiplier *= 0.75 + config.difficulty / 200; //Include a difficulty adjustment in the player multiplier. Difficulty of 0 -> 0.75x; difficulty of 100 -> 1.25x
	var baseOnTurn = newState.turn - 3 + Math.floor(config.difficulty / 28); //Normally, you get a bit of a buffer, but playing on a higher difficulty makes the whole game harder (especially the beginning thanks to this part of the calculation).

	if (!newState.enemyApproach) {
		var target = baseOnTurn * 2.1 * playerMultiplier;
		if (target > 0 && teamReadiness > lastTurnEnemyStrength) { //make you feel a little better if the foe starts catching up
			target += (teamReadiness - target) * 0.15;
		}

		var enemyStrength = Math.max(0, Math.floor((lastTurnEnemyStrength * 4 + target) / 5)); //Basically a moving average
		if (teamReadiness < enemyStrength) {
			newState.enemyApproach = 1; //Next turn, we'll check once more before notifying the player of an impending attack
		}
	} else {
		newState.enemyApproach++;
		enemyStrength = lastTurnEnemyStrength; //Lock the enemy strength during the approach or return trip (but it'll get set when enemyApproach = 2 if the foe doesn't turn back)
		if (newState.enemyApproach == ENEMY_APPROACH_NOTICE && teamReadiness >= enemyStrength) { //Before the player is informed of the approaching attack, we'll give them one turn to fix any mistakes where they knocked out their own resource grid or whatever.
			newState.enemyApproach = 0;
		} else if (newState.enemyApproach == ENEMY_APPROACH_NOTICE) {
			enemyStrength = (baseOnTurn + 8) * 2.1 * playerMultiplier; //Lock it to 8 turns ahead of the usual target
		} else if (newState.enemyApproach == ENEMY_REPEL_CHECK && teamReadiness < enemyStrength) { //Check for failure or make the foe turn back
			newState.enemyApproach = GAME_OVER;
		} else if (newState.enemyApproach == ENEMY_REPEL_CHECK * 2 - ENEMY_APPROACH_NOTICE) { //*2 because it takes the same time to go back home as it does to start the approach
			newState.enemyApproach = 0; //Fully reset the enemy
			enemyStrength = (baseOnTurn - 2) * 2.1 * playerMultiplier; //Reset the strength to a little bit behind the norm
		}
	}

	return Math.floor(enemyStrength);
}

globalThis.runResources = function (config, prevState, newState) {
	var playerResources = prevState.players.map(p => p.resources.slice());
	var playerConsumption = prevState.players.map(p => resourceDefinitions.map(_ => 0));
	var playerProduction = prevState.players.map(p => resourceDefinitions.map(_ => 0));
	//Set any non-stockpiled resources' amounts to 0
	for (var x = 0; x < resourceDefinitions.length; x++) if (!resourceDefinitions[x].canStockpile) playerResources.forEach(p => p[x] = 0);

	var commandUnitsByPlayer = newState.players.map(_ => []);

	//Filter out units with no active cost (by the time of release, there should be no such units, I think)
	var activeCostUnits = prevState.units.filter(p => unitDefinitions[p.unitDefID].activeCost && unitDefinitions[p.unitDefID].activeCost.length);
	//Reorder the units for a hopefully decent prioritization in case resources are too low to keep everything running, but we'll loop a few times anyway to make sure everything that can run does run. (Lower numbers first, so energy producers are the highest priorities)
	activeCostUnits.sort((a, b) => unitPriority(unitDefinitions[a.unitDefID]) - unitPriority(unitDefinitions[b.unitDefID]));
	var somethingChanged, activeCommandUnitsChanged, firstIteration = true;
	do {
		somethingChanged = false;
		activeCommandUnitsChanged = newState.players.map(_ => false);
		for (x = 0; x < activeCostUnits.length; x++) {
			var unit = activeCostUnits[x]; //Alias
			var costs = unitDefinitions[unit.unitDefID].activeCost;
			var isActive = !unit.disabled && costs.every((cost, idx) => playerResources[unit.playerIdx][idx] >= cost);
			//Set the unit to active/inactive in the new state. We use forEach in case it was demolished during this turn--you still get the resources from it as a sort of bonus.
			newState.units.filter(p => p.x == unit.x && p.y == unit.y && p.playerIdx == unit.playerIdx).forEach(p => p.wasActiveAtTurnStart = p.isActive = isActive);

			//Apply costs
			if (isActive) {
				//Get the unit that it's built on and that it has to be built on, if there is one, and get the resource supply multipliers from that (which only apply to negative costs).
				var mustBuildOn = unitDefinitions[unit.unitDefID].mustBuildOn || [];
				var isBuiltOn = (prevState.units.find(p => p.x == unit.x && p.y == unit.y && mustBuildOn.includes(p.unitDefID)) || { unitDefID: 0 }).unitDefID; //Unit definition ID of what it's built on, or 0 if nothing (just for the sake of having a valid unit definition ID)
				var supplyMultipliers = unitDefinitions[isBuiltOn].resourceSupply || resourceDefinitions.map(_ => 1); //Defaults to 1x for all resources if resourceSupply is not specified or it's not built on a unit as required, e.g. so power production works anywhere
				costs.forEach((cost, idx) => playerResources[unit.playerIdx][idx] -= cost * (cost < 0 ? (supplyMultipliers[idx] || 0) : 1));
				costs.forEach((cost, idx) => playerConsumption[unit.playerIdx][idx] += (cost < 0 ? 0 : cost));
				costs.forEach((cost, idx) => playerProduction[unit.playerIdx][idx] += (cost < 0 ? (cost * (supplyMultipliers[idx] || 0)) : 0));
				if (unitDefinitions[unit.unitDefID].category == CAT_COMMAND) { //If the unit affects the Command resource, we need to recalculate it
					commandUnitsByPlayer[unit.playerIdx].push(unit);
					activeCommandUnitsChanged[unit.playerIdx] = true;
				}

				//Remove the active unit from the array and note that we did something on this loop, so we may be able to turn on another unit in the next iteration
				activeCostUnits.splice(x--, 1);
				somethingChanged = true;
			} else if (unit.disabled) { //Take player-disabled units out of the list before we calculate resource "insufficiency" because they didn't run out of resources on accident--they were shut off
				activeCostUnits.splice(x--, 1);
			}
		}

		//Recalculate the command resource for each player that it potentially changed for, since that may allow more of their units to activate
		newState.players.forEach((player, idx) => {
			if (firstIteration || activeCommandUnitsChanged[idx]) {
				var diff = calculateCommandResource(commandUnitsByPlayer[idx]) - playerProduction[idx][RES_COMMAND];
				playerProduction[idx][RES_COMMAND] += diff;
				playerResources[idx][RES_COMMAND] += diff;
			}
		});
		firstIteration = false;
	} while (somethingChanged);

	//What's left are the units we couldn't supply with resources
	playerResources.forEach((p, playerIdx) => p.forEach((res, idx) => {
		//Looks suspiciously similar to the storage calculation logic ;)
		newState.players[playerIdx].resourcesInsufficient = activeCostUnits.filter(q => q.playerIdx == playerIdx).map(q => unitDefinitions[q.unitDefID].activeCost).reduce((costSubtotals, curr) => resourceDefinitions.map((_, i) => costSubtotals[i] + Math.max(curr[i] || 0, 0)), resourceDefinitions.map(_ => 0));
	}));

	//Undo the damage to reserve-only resources by reverting the totals to what they were at the end of the previous state.
	playerResources.forEach((playerResourceSet, playerIdx) => playerResourceSet.forEach((p, resIdx) => { if (resourceDefinitions[resIdx].reserveInsteadOfConsume) playerResourceSet[resIdx] = prevState.players[playerIdx].resources[resIdx]; }));

	//Copy resource amounts to the next turn
	newState.players.forEach((player, idx) => player.resources = playerResources[idx]);
	newState.players.forEach((player, idx) => player.resourcesConsumed = playerConsumption[idx]);
	newState.players.forEach((player, idx) => player.resourcesProduced = playerProduction[idx]);

	//Cap all stockpilable resources
	var newStateUnitsByPlayer = newState.players.map((p, idx) => newState.units.filter(q => q.playerIdx == idx)); //Dictionary, keyed by player index, of active units for that player only
	playerResources.forEach((p, playerIdx) => p.forEach((res, idx) => {
		//Find out how much the player can store of each resource, in an array parallel to resourceDefinitions. (The filter() removes units that don't have any storage, and the "|| 0" is because the storage amount arrays don't have to be as long as resourceDefinitions is.)
		var storage = newStateUnitsByPlayer[playerIdx].map(q => unitDefinitions[q.unitDefID].storage).filter(q => q).reduce((storageSubtotals, curr) => resourceDefinitions.map((_, i) => storageSubtotals[i] + (curr[i] || 0)), resourceDefinitions.map(_ => 0));

		if (resourceDefinitions[idx].canStockpile) {
			//If two (yes, max of two) resources share storage and their sum exceeds the storage limit, proportionally reduce them to be equal to that limit. (Note that if a later resource references an earlier one, the earlier one may have already been clamped once, so it wouldn't be quite proportional.)
			//Also note: this logic probably isn't even going to get used, because I intended to spawn tents for people when you exceed the max storage in the dorms anyway, and that'll be handled by a separate immigration process
			if (resourceDefinitions[idx].shareStorage != undefined) {
				var altIdx = resourceDefinitions[idx].shareStorage;
				var maxStorage = (resourceDefinitions[altIdx].baseStorage || 0) + storage[altIdx];
				if (p[idx] + p[altIdx] > maxStorage) {
					p[idx] = Math.round(p[idx] * maxStorage / (p[idx] + p[altIdx])); //Reduce proportionally
					p[altIdx] = maxStorage - p[idx]; //Take up the remaining storage
				}
			} else p[idx] = Math.min(p[idx], (resourceDefinitions[idx].baseStorage || 0) + storage[idx]);
		}
	}));

	//Calculate Military Readiness for the group as a whole, AFTER capping resources
	var teamReadiness = calculateMilitaryReadiness(config, newState.units, newState.players);
	newState.players.forEach((player) => player.resourcesProduced[RES_READINESS] = player.resources[RES_READINESS] = teamReadiness);

	var enemyStrength = calculateEnemyStrength(config, prevState, newState);
	newState.players.forEach((player) => player.resourcesProduced[RES_ENEMY_STRENGTH] = player.resources[RES_ENEMY_STRENGTH] = enemyStrength);
}

/** Make a modified copy of the upgrade's unit definition in order to include the inverse of the production (negative active costs) of the base unit (it's like shutting it down for a turn but still having the run cost). This should only be called when constructing an upgrade on a unit that was active at the start of the turn. */
globalThis.addParentActiveCostToUpgrade = function (unitType) {
	var baseActiveCost = unitDefinitions[unitType.upgradeFrom].activeCost;
	if (unitType.upgradeFrom !== undefined && baseActiveCost) {
		unitType = Object.assign({}, unitType); //Clone the unit definition because we're going to make a temporary change
		unitType.cost = unitType.cost.slice(); //The array isn't deep copied by the above, so clone it, too
		for (var x = 0; x < baseActiveCost.length; x++)
			unitType.cost[x] = (unitType.cost[x] || 0) - (baseActiveCost[x] < 0 ? baseActiveCost[x] : 0);
	}
	return unitType;
}

/** Make a modified copy of the upgrade's unit definition in order to include the build cost of the base unit. This should only be called when demolishing an upgraded unit. */
globalThis.addParentConstructionCostToUpgrade = function (unitType) {
	if (unitType.upgradeFrom !== undefined && unitDefinitions[unitType.upgradeFrom].cost) {
		unitType = Object.assign({}, unitType); //Clone the unit definition because we're going to make a temporary change
		unitType.cost = unitType.cost.slice(); //The array isn't deep copied by the above, so clone it, too
		for (var x = 0; x < unitDefinitions[unitType.upgradeFrom].cost.length; x++)
			unitType.cost[x] = (unitType.cost[x] || 0) + unitDefinitions[unitType.upgradeFrom].cost[x];
	}
	return unitType;
}

globalThis.runTentSpawns = function (config, state, copyToState) {
	//Calculate people storage by player
	var storage = state.players.map(_ => 0);
	state.units.forEach(curr => { if (curr.playerIdx >= 0 && (curr.isActive || !unitDefinitions[curr.unitDefID].activeCost)) storage[curr.playerIdx] += (unitDefinitions[curr.unitDefID].storage || [])[RES_PEOPLE] || 0; }); //Check isActive so deactivated dorms are useless (though it'd be reasonable to stay in them anyway, I need SOME kind of detriment to disabling the dorms)

	//Calculate a position-occupation matrix
	var occupationMatrix = new Array(config.w).fill([]).map(p => new Array(config.h).fill(null)); //so the indices are [x][y] and the values are the player ID if the space is occupied and null otherwise (so "undefined" isn't a buildable tile but "null" is)
	for (var x = 0; x < state.units.length; x++) {
		var unit = state.units[x];
		if (occupationMatrix[unit.x][unit.y] === null) occupationMatrix[unit.x][unit.y] = unit.playerIdx;
	}

	for (var x = 0; x < state.players.length; x++) {
		var housingDeficit = state.players[x].resources[RES_PEOPLE] + state.players[x].resources[RES_PEOPLE + 1] /*officers*/ - storage[x];
		if (housingDeficit > 0) { //Need tents. Spawn them.
			//Get a list of unoccupied tiles surrounding this player's units //TODO: should make sure they're not occupied in the next turn either, just to be nice, if copyToState isn't empty. Especially don't put tents where OTHER players' units exist in the next turn. Actually would be best if you can avoid invalidating any future turn just because of tents spawning.
			var placementOptions = [], placementOptionsAdded = []; //The latter is for easily and efficiently ensuring we don't include the same tile twice in the former
			state.units.filter(p => p.playerIdx == x).reverse().forEach(unit => { //Reverse so when we pull from the *end* of the list later, we'll be looking to spawn next to the oldest units first
				var priority = unitDefinitions[unit.unitDefID].category == CAT_AMENITIES ? 10 : 0;
				if (unit.unitDefID == UNIT_TENT) priority--; //We don't want to make a bunch of tents in a diagonal line because that looks silly, so prefer placing new tents adjacent to a dorm more than adjacent to a tent
				for (var xPos = Math.min(config.w - 1, unit.x + 1); xPos >= Math.max(0, unit.x - 1); xPos--) { //check map bounds here since occupationMatrix[x] is an array. And we traverse right to left so that left technically ends up with higher priority due to the array sorting direction.
					for (var yPos = unit.y - 1; yPos <= unit.y + 1; yPos++) { //don't have to check map bounds for y since being out of array bounds is undefined, not null, and y is the inner array's index
						if (occupationMatrix[xPos][yPos] === null) {
							if (placementOptionsAdded[xPos * config.h + yPos] === undefined) {
								placementOptionsAdded[xPos * config.h + yPos] = placementOptions.length; //index of the freshly added tile
								placementOptions.push({ x: xPos, y: yPos, priority: priority });
							} else {
								placementOptions[placementOptionsAdded[xPos * config.h + yPos]].priority = Math.max(placementOptions[placementOptionsAdded[xPos * config.h + yPos]].priority, priority);
							}
						}
					}
				}
			});
			//TODO: I can totally use the selection algorithm (https://en.wikipedia.org/wiki/Selection_algorithm) to make this more efficient later if needed. var neededTents = Math.ceil(housingDeficit / unitDefinitions[UNIT_TENT].storage[RES_PEOPLE]); and select the neededTents-th largest
			placementOptions.sort((a, b) => a.priority - b.priority); //Sort from lowest to highest priority so we can take off the end of the list instead of shifting the whole list for each tent we spawn

			while (housingDeficit > 0) {
				if (!placementOptions.length) break; //TODO: in this case, I will have to search all reachable unoccupied tiles instead, and only if there are STILL none after that would I give up on spawning tents.
				var chosenSpot = placementOptions.pop();

				//Place the tent
				var newTent = { x: chosenSpot.x, y: chosenSpot.y, playerIdx: x, unitDefID: UNIT_TENT };
				state.units.push(newTent);
				if (copyToState) copyToState.units.push(Object.assign({}, newTent)); //Also copy the tent to the next state if state is the turn that's ending
				occupationMatrix[newTent.x][newTent.y] = x; //indicate that this space is now filled

				housingDeficit -= unitDefinitions[UNIT_TENT].storage[RES_PEOPLE];
			}

		} else if (housingDeficit < 0 && !copyToState) { //When copyToState is nothing, that means runImmigration just executed, so we don't need whatever extra tents exist now. We don't despawn them on the earlier call to runTentSpawns so that they stay in the same place if new people arrive the same turn a dorm was built.
			//Check if we have more tents than we need; despawn any extras
			var tents = state.units.filter(p => p.unitDefID == UNIT_TENT && p.playerIdx == x);
			while (housingDeficit <= -unitDefinitions[UNIT_TENT].storage[RES_PEOPLE] && tents.length) {
				//Despawn the newest tent
				var despawning = tents.pop();
				if (despawning.sprite) despawning.sprite.remove();
				state.units.splice(state.units.indexOf(despawning), 1); //Remove it from the actual game state
				occupationMatrix[despawning.x][despawning.y] = null; //indicate that this space is no longer filled

				housingDeficit += unitDefinitions[UNIT_TENT].storage[RES_PEOPLE];
			}
		}
	}
}

globalThis.runImmigration = function (config, prevState, newState) {
	var tents = [], HQs = [];
	prevState.units.filter(p => p.unitDefID == UNIT_TENT).forEach(p => tents[p.playerIdx]++); //Count the number of tents each player has (though it'd be better if this was averaged over several turns)
	prevState.units.filter(p => p.unitDefID == UNIT_HQ).forEach(p => HQs[p.playerIdx]++);

	for (var x = 0; x < newState.players.length; x++) {
		if (newState.players[x].lastImmigrationTurn <= newState.turn - newState.players[x].turnsBetweenImmigrations) {
			//var nonTentHousing = newState.units.filter(p => p.playerIdx == x && p.unitDefID != UNIT_TENT && unitDefinitions[p.unitDefID].storage).reduce((sum, p) => sum + unitDefinitions[p.unitDefID].storage[RES_PEOPLE], 0);
			var luxury = prevState.players[x].resources[RES_LUXURY]; //TODO: it really needs to be the average over the last N turns so you can't just deactivate your luxuries until the immigration turn, rendering them practically free to maintain
			var population = prevState.players[x].resources[RES_PEOPLE] + prevState.players[x].resources[RES_PEOPLE + 1];
			//Calculate the total number of officers that the player's units need, regardless of whether they have the units deactivated
			var neededOfficers = prevState.units.filter(p => p.playerIdx == x && unitDefinitions[p.unitDefID].activeCost).reduce((sum, p) => sum + (unitDefinitions[p.unitDefID].activeCost[RES_PEOPLE + 1] || 0), 0) - prevState.players[x].resources[RES_PEOPLE + 1];

			//Always have at least one person immigrate, but if there are more luxuries than population, we can allow several to immigrate
			var spawnablePeopleCount = Math.ceil(Math.log2(Math.max(2, luxury - population))); //negative numbers or up to 2 luxuries more than people -> 1 immigrant. 3 to 4 extra luxuries -> 2 immigrants. 5 to 8 extra luxuries -> 3 immigrants. 9 to 16 extra luxuries -> 4 immigrants.

			if (spawnablePeopleCount > 4 || (neededOfficers > -3 && spawnablePeopleCount > 1) || neededOfficers > 0) { //If we might need officers soon and can spawn multiple people, or if we need officers NOW, or we have a LOT of people coming in, then spawn ONE officer. We never get more than one officer per ship.
				newState.players[x].resources[RES_PEOPLE + 1]++;
				newState.players[x].resourcesConsumed[RES_PEOPLE + 1]++; //Don't make it look like you've got an officer wasting time doing nothing for the next turn (they're settling in) ;)
				spawnablePeopleCount--;
			}

			//Spawn Enlisted Personnel
			newState.players[x].resources[RES_PEOPLE] += spawnablePeopleCount;
			newState.players[x].resourcesConsumed[RES_PEOPLE] += spawnablePeopleCount; //If we don't reserve the new arrivals, it'll look like some of our 'insufficient resources' units should have activated because there were enough people--but the people arrived at the END of the turn

			newState.players[x].lastImmigrationTurn = newState.turn;

			//Adjust the number of turns to the next immigration event based on the amount of luxuries and the number of tents
			if (luxury < population - 6 + Math.floor(config.difficulty / 15) || tents[x] > 1 + (config.difficulty < 20 ? 1 : 0)) //Below difficulty 20, you're allowed 2 tents without detriments. Otherwise, you can only have 1. And luxuries must be closer to the population for higher difficulties.
				newState.players[x].turnsBetweenImmigrations = Math.min(newState.players[x].turnsBetweenImmigrations + 1, 9 + Math.floor(config.difficulty / 25)); //Caps at 9 turns up to difficulty 24, then 10, 11, 12, and 13 at difficulty 100.
			else if (luxury >= population + 10 && !tents[x]) //Large bonus to immigration rate, no more frequent than every 4, 5, or 6 turns (at 0-34, 35-69, and 70+ difficulty respectively). Having at least one HQ reduces the minimum by 1 to 3, 4, or 5 turns.
				newState.players[x].turnsBetweenImmigrations = Math.max(newState.players[x].turnsBetweenImmigrations - 2, 4 + Math.floor(config.difficulty / 35) + (HQs[x] ? -1 : 0));
			else //Small bonus to immigration rate, no more frequent than every 5 turns (or 6 turns if difficulty is at least 60). Having at least one HQ reduces the minimum by 1, making it 4 or 5.
				newState.players[x].turnsBetweenImmigrations = Math.max(newState.players[x].turnsBetweenImmigrations - 1, 5 + (config.difficulty >= 60 ? 1 : 0) + (HQs[x] ? -1 : 0));
		}
	}
}


/**
 * Get an array of tiles that are reachable and therefore buildable for the given player. (You should allow demolition of a unit as long as it's at least ADJACENT to a buildable tile, not only if it's on a buildable tile.)
 * In the resulting array, each index's coordinates in pixels are: (x % config.w * TILE_SIZE, Math.floor(x / config.w) * TILE_SIZE)
 */
globalThis.getBuildableLocationsForPlayer = function (config, state, playerIdx) {
	var matrix = new Array(config.w * config.h); //Indexed by position x + y*w, so getting x from the index is idx % w, and y is Math.floor(idx / w);
	for (var x = 0; x < state.units.length; x++) if (unitDefinitions[state.units[x].unitDefID].blocker) matrix[state.units[x].x + state.units[x].y * config.w] = 0; //Start with blocker units marked as 0 (we'll find out from this what tiles are accessible)

	//By starting with all the player's non-blocker (wall) units on the open list, we ensure that the player splitting up their own units with walls doesn't stop them from building
	var openList = state.units.filter(p => p.playerIdx == playerIdx && !unitDefinitions[p.unitDefID].blocker).map(p => p.x + p.y * config.w); //Convert the coordinates to indices in matrix for shorter code
	for (var x = 0; x < openList.length; x++) matrix[openList[x]] = 1; //Mark those locations in matrix so we don't add to the same tiles to the open list again
	while (openList.length) {
		var addAround = openList.pop();
		//Add the four tiles in the cardinal directions to the open list if they're not already marked as blocked or out of bounds
		if (addAround % config.w > 0 && matrix[addAround - 1] === undefined) { //Left
			matrix[addAround - 1] = 1;
			openList.push(addAround - 1);
		}
		if (addAround % config.w < config.w - 1 && matrix[addAround + 1] === undefined) { //Right
			matrix[addAround + 1] = 1;
			openList.push(addAround + 1);
		}
		if (addAround >= config.w && matrix[addAround - config.w] === undefined) { //Up
			matrix[addAround - config.w] = 1;
			openList.push(addAround - config.w);
		}
		if (addAround < matrix.length - config.w && matrix[addAround + config.w] === undefined) { //Down
			matrix[addAround + config.w] = 1;
			openList.push(addAround + config.w);
		}
	}

	return matrix;
}


globalThis.generateMountainsAndResources = function (config, state) {
	var center = { x: Math.floor(Math.random() * config.w), y: Math.floor(Math.random() * config.h) }; //Pick a starting location absolutely anywhere in the map
	var angle = Math.atan2(config.h / 2 - center.y, config.w / 2 - center.x); //Pick an angle so that the mountain range is constructed from the starting location toward the map center initially
	var width = 1; //Start with just 1 tile wide
	var nextAngleChange = 5;
	var originalCenter = Object.assign({}, center); //Clone the center so we can adjust the width based on the distance from it

	var centerPoints = [originalCenter], leftPoints = [originalCenter], rightPoints = [];
	//At each point where the angle would change, add the right-hand point and left-hand point (from the perpendicular line of length 'width' that I'm currently using to rasterize directly) to separate lists. Then use a standard polygon rasterization algorithm to fill in the whole shape.
	while (center.x - width < config.w && center.x + width >= 0 && center.y - width < config.h && center.y + width >= 0 && width > 0) { //keep marking tiles while at least one of the candidate tiles is within map bounds or the width formula output dropped to zero
		if (centerPoints[centerPoints.length - 1].x != Math.floor(center.x) || centerPoints[centerPoints.length - 1].y != Math.floor(center.y)) centerPoints.push({ x: Math.floor(center.x), y: Math.floor(center.y) });

		center.x += Math.cos(angle);
		center.y += Math.sin(angle);
		if (!--nextAngleChange) {
			//Where the width or angle changes, we need a point at the extrema for our final polygon.
			var perpendicular = angle + Math.PI / 2;
			leftPoints.push({ x: center.x - Math.cos(perpendicular) * width / 2, y: center.y - Math.sin(perpendicular) * width / 2 });
			rightPoints.push({ x: center.x + Math.cos(perpendicular) * width / 2, y: center.y + Math.sin(perpendicular) * width / 2 });

			angle += Math.random() * (Math.PI / 4) - Math.PI / 8; //-22.5 to +22.5 degrees.
			nextAngleChange = 3 + Math.round(Math.random() * 5); //don't change angles any less frequently than every 3 tiles

			//Recalculate width
			var distance = Math.sqrt(Math.pow(originalCenter.x - center.x, 2) + Math.pow(originalCenter.y - center.y, 2));
			width = Math.round(1 + 4 * Math.sin(Math.PI * distance / config.w));
		}
	}

	//Combine the points into one list (in a proper winding order) and get the extrema of the shape
	leftPoints.push(center); //so the shape doesn't strangely stop near the edge of the map if nextAngleChange didn't quite make it to 0 one last time before the above loop ended
	var points = leftPoints.concat(rightPoints.reverse());
	var minX = Math.floor(Math.max(points.reduce((min, cur) => Math.min(min, cur.x), config.w - 1), 0)) + 0.5; //Add 0.5 so we rasterize based on the tile centers
	var minY = Math.floor(Math.max(points.reduce((min, cur) => Math.min(min, cur.y), config.h - 1), 0)) + 0.5;
	var maxX = Math.floor(Math.min(points.reduce((max, cur) => Math.max(max, cur.x), 0), config.w));
	var maxY = Math.floor(Math.min(points.reduce((max, cur) => Math.max(max, cur.y), 0), config.h));

	//Standard even-odd rule algorithm: https://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
	for (var x = minX; x < maxX; x++) {
		for (var y = minY; y < maxY; y++) {
			var fromPointIdx = points.length - 1; //first edge is from the last point to the first
			var oddCrossings = false;
			for (var toPointIdx = 0; toPointIdx < points.length; toPointIdx++) {
				if ((points[toPointIdx].y > y) != (points[fromPointIdx].y > y) && x < points[toPointIdx].x + (points[fromPointIdx].x - points[toPointIdx].x) * (y - points[toPointIdx].y) / (points[fromPointIdx].y - points[toPointIdx].y)) oddCrossings = !oddCrossings;
				fromPointIdx = toPointIdx;
			}
			if (oddCrossings) state.units.push({ x: Math.floor(x), y: Math.floor(y), playerIdx: NEUTRAL_PLAYER, unitDefID: UNIT_MOUNTAIN }); //Drop a "rough terrain" unit at each point in the shape instead of drawing pixels like a normal rasterizer
		}
	}

	//Prepare some resources inside the mountains
	var spawnRatios = [];
	spawnRatios[UNIT_DEP_WATER] = 2 / 4096; //Water will also spawn outside of the mountain ranges in plentiful amounts, so we don't need a lot in the mountains.
	spawnRatios[UNIT_DEP_FUEL] = 4 / 4096; //Fuel can only be obtained from natural sources, so we need several
	spawnRatios[UNIT_DEP_URANIUM] = 2 / 4096; //Uranium can only be obtained from natural sources, but it's basically a worse version of tritium, so we don't need a lot of it.
	spawnRatios[UNIT_DEP_TRITIUM] = 2 / 4096; //Tritium can be generated by upgraded fusion reactors, so it's actually only limited by water income.
	var desiredSpawns = spawnRatios.map((p, idx) => new Array(Math.ceil(p * config.w * config.h)).fill(idx)).flat().sort(() => Math.random() - 0.5);
	centerPoints = centerPoints.filter(p => p.x >= 0 && p.y >= 0 && p.x < config.w && p.y < config.h);
	var avgDistance = centerPoints.length / desiredSpawns.length; //should never be less than 1 because the center points should cross at least half of the map and desiredSpawns is based on map size--unless maybe we were to use a map with an extreme aspect ratio
	for (var x = 4; x < centerPoints.length && desiredSpawns.length; x += avgDistance) { //Start at x=4 because I have a special purpose for x=0 and some tiles aren't "rasterized" at the start of the mountain range
		var spawnAt = centerPoints[Math.floor(x + Math.random() * (avgDistance - 1))]; //Random placement, but not by too much
		if (!spawnAt) spawnAt = centerPoints[centerPoints.length - 1]; //in case we went out of range when adding a random distance
		//Avoid spawning right at the map edge, to be nice to the player
		if (spawnAt.x <= 0) spawnAt.x = 1; else if (spawnAt.x >= config.w - 1) spawnAt.x = config.w - 2;
		if (spawnAt.y <= 0) spawnAt.y = 1; else if (spawnAt.y >= config.h - 1) spawnAt.y = config.h - 2;

		var unit = state.units.find(p => p.x == spawnAt.x && p.y == spawnAt.y);
		if (!unit) { //If the center point wasn't rasterized into a tile (often happens near the start of the mountain range)
			unit = { x: spawnAt.x, y: spawnAt.y, playerIdx: NEUTRAL_PLAYER };
			state.units.push(unit);
		}
		//Find the unit at that point, switch it to the resource
		var spawnUnit = desiredSpawns.pop();
		unit.unitDefID = spawnUnit;

		//Plop a mountain range or ancient ruins on top of it
		state.units.push({ x: spawnAt.x, y: spawnAt.y, playerIdx: NEUTRAL_PLAYER, unitDefID: ((spawnUnit == UNIT_DEP_URANIUM || spawnUnit == UNIT_DEP_TRITIUM) ? UNIT_RUINS : UNIT_MOUNTAIN) });
	}

	var unit = state.units.find(p => p.x == centerPoints[0].x && p.y == centerPoints[0].y);
	if (!unit) {
		unit = { x: centerPoints[0].x, y: centerPoints[0].y, playerIdx: NEUTRAL_PLAYER };
		state.units.push(unit);
	}
	unit.unitDefID = UNIT_DEP_FUEL; //Guarantee that fuel is always accessible from the start by putting uncovered fuel at the very end of the mountain range, or else nobody could get to the resources

	var waterSpawns = Math.ceil(8 / 4096 * config.w * config.h); //Spawn plenty of water outside the mountain ranges
	for (var x = 0; x < waterSpawns; x++) {
		var retryLimit = 1000;
		var retry = true;
		while (retry && retryLimit--) { //It being random means this could be infinite, so there's a limit to the number of times it can retry, although it'd be pretty bad to be unable to spawn enough water.
			var unit = { x: 1 + Math.floor(Math.random() * (config.w - 2)), y: 1 + Math.floor(Math.random() * (config.h - 2)), playerIdx: NEUTRAL_PLAYER, unitDefID: UNIT_DEP_WATER }; //to be nicer to the player, don't spawn water right at the map edge
			retry = state.units.find(p => p.x == unit.x && p.y == unit.y);
			if (!retry) state.units.push(unit);
		}
	}

	//TODO: Also spawn some small mountainous blobs with 2 units of water in them; it should cost at least 3 turns to obtain any such water source.
}

globalThis.generatePlayerPlot = function (config, state, playerIdx, occupationMap) {
	var plot = [[UNIT_TENT, null, UNIT_TENT], //Needs to be rectangular, not jagged; preferably square
	[null, UNIT_DIG_SITE, null],
	[UNIT_TENT, null, UNIT_TENT]];
	const plotWidth = plot[0].length, plotHeight = plot.length;
	const centerX = Math.floor(config.w / 2 - plotWidth / 2), centerY = Math.floor(config.h / 2 - plotHeight / 2); //These double as the base magnitude

	var angle = Math.PI * 5 / 4 + playerIdx / state.players.length * Math.PI * 2; //0 to 2*PI radians depending on the number of players, so we can pretty evenly space their starting places no matter how many players there are. The 5/4*PI is to start at the top-left.

	//If our original position causes issues with mountains or other players' units, we'll try shifting the angle a few degrees, and if that's not good enough, also try changing the magnitude a bit.
	var toTry = [{ a: angle, m: 1 }, { a: angle - 0.3, m: 1 }, { a: angle + 0.3, m: 1 }, { a: angle - 0.4, m: 0.8 }, { a: angle + 0.4, m: 0.8 }, { a: angle - 0.8, m: 1 }, { a: angle + 0.8, m: 1 }, { a: angle, m: 0.5 }].reverse();
	var plotAt;
	tryNextPosition: while (plotAt = toTry.pop()) {
		//Check if the position is OK
		var plotBaseX = Math.floor(centerX + Math.cos(plotAt.a) * plotAt.m * centerX - plotWidth / 2);
		var plotBaseY = Math.floor(centerY + Math.sin(plotAt.a) * plotAt.m * centerY - plotHeight / 2);

		//It's possible for it to be a bit too far off the edge despite my efforts, apparently
		if (plotBaseX < Math.floor(plotWidth / 2)) plotBaseX = Math.floor(plotWidth / 2);
		else if (plotBaseX > config.w - Math.ceil(plotWidth / 2) - 1) plotBaseX = config.w - Math.ceil(plotWidth / 2) - 1;
		if (plotBaseY < Math.floor(plotHeight / 2)) plotBaseY = Math.floor(plotHeight / 2);
		else if (plotBaseY > config.h - Math.ceil(plotHeight / 2) - 1) plotBaseY = config.h - Math.ceil(plotHeight / 2) - 1;

		for (var y = 0; y < plotHeight; y++) {
			for (var x = 0; x < plotWidth; x++) {
				if (plot[y][x] != null) {
					if (occupationMap[plotBaseX + x + (plotBaseY + y) * config.w]) continue tryNextPosition;
				}
			}
		}

		//If it is, let's build the plot. Same three blocks as the above code, but with unit placement and updating buildabilityMap instead of just a buildabilityMap check.
		for (var y = 0; y < plotHeight; y++) {
			for (var x = 0; x < plotWidth; x++) {
				if (plot[y][x] != null) {
					state.units.push({ x: plotBaseX + x, y: plotBaseY + y, playerIdx: playerIdx, unitDefID: plot[y][x] });
					occupationMap[plotBaseX + x + (plotBaseY + y) * config.w] = true;
				}
			}
		}
		return;
	}

	throw "Uh-oh! No valid position could be found for the plot for player " + playerIdx + ".";
}

globalThis.generateInitialMap = function (config, state) {
	generateMountainsAndResources(config, state);

	//Generate passability map from all the units spawned so far
	var occupationMap = new Array(config.w * config.h); //Indexed by position x + y*w, so getting x from the index is idx % w, and y is Math.floor(idx / w);
	for (var x = 0; x < state.units.length; x++) occupationMap[state.units[x].x + state.units[x].y * config.w] = true;

	//Place player starting plots (also updating occupationMap along the way)
	for (var x = 0; x < state.players.length; x++) generatePlayerPlot(config, state, x, occupationMap);

	//Also set up the players' initial buildability matrix so we know where/what they can build/demolish during the first turn
	for (var x = 0; x < state.players.length; x++) state.players[x].buildabilityMatrix = getBuildableLocationsForPlayer(config, state, x);
}

//Distinct, preserving order of the given array
globalThis.distinct = function (arr) {
	var keys = {};
	var vals = [];
	arr.forEach(p => {
		if (!(p in keys)) {
			vals.push(p);
			keys[p] = true;
		}
	});
	return vals;
}