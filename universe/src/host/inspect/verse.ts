// What a people sing (T1, classic 58 and 50): the words of a song about what really happened to them, made from the event and from what
// they know: their town and their foe by name, their own stone and beasts and water. Pure: the same facts give the same song.
//
// A song wears as it is told. Under sixty years old it still counts: the number, the town, the foe, the one who ruled. Under four
// hundred the numbers are round and the names hold. Under twelve hundred the numbers are gone, the names are worn short and the foe is
// "they". Older than that no name is left, only what it felt like.
//
// A line is words with holes in it. A hole the song cannot fill (no foe, no number, a name worn away) drops the whole line, so a line
// never says "undefined" and an old song can't count.

export type SongKind =
  | "battle"
  | "struck"
  | "fire"
  | "plague"
  | "hunger"
  | "fall"
  | "ruler"
  | "rising"
  | "freed"
  | "coup"
  | "first"
  | "strangers"
  | "faith"
  | "peace"
  | "leaving"
  | "sky"
  | "beast"
  // What a town raised because it was asked (H1).
  | "asked";

/** What a song is made from. */
export type SongFacts = {
  /** Its own draw: the event's. */
  readonly key: number;
  readonly kind: SongKind;
  /** How long ago (years). */
  readonly age: number;
  readonly year: number;
  readonly town: string | null;
  readonly land: string | null;
  /** Those who sing it, and their foe: a realm's own name, "Gel". */
  readonly us: string | null;
  readonly them: string | null;
  /** One person it is about. */
  readonly who: string | null;
  /** How many died (0: not told). */
  readonly dead: number;
  readonly homes: number;
  /** How long it held (0: not told). */
  readonly years: number;
  /** What it was: a sickness's name, a faith's, the strangers'. */
  readonly what: string | null;
  /** Whether those who sing it won (null: no one to win). */
  readonly won: boolean | null;
  readonly water: boolean;
  readonly fireless: boolean;
  readonly stone: string;
  readonly beast: string | null;
  readonly god: string | null;
};

/** How worn a song is: 0 still counts, 1 round numbers, 2 worn names, 3 no names at all. */
export function wornBy(age: number): 0 | 1 | 2 | 3 {
  return age < 60 ? 0 : age < 400 ? 1 : age < 1200 ? 2 : 3;
}

const unit = (key: number, n: number): number => {
  let x = Math.imul((key ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

const SMALL =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(
    " ",
  );
const TENS = "  twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
/** A number under a thousand, said. */
function under1000(n: number): string {
  if (n < 20) return SMALL[n]!;
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${SMALL[n % 10]}` : ""}`;
  return `${SMALL[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${under1000(n % 100)}` : ""}`;
}
/** A number said, as it would be sung: three figures at most. */
export function spoken(n: number): string {
  if (n < 1000) return under1000(Math.max(0, Math.round(n)));
  const scale = n >= 1e9 ? 1e9 : n >= 1e6 ? 1e6 : 1e3,
    word = scale === 1e9 ? "billion" : scale === 1e6 ? "million" : "thousand",
    head = Math.floor(n / scale),
    rest = n - head * scale,
    // (Three figures in all: what is left after the head, rounded to what those leave.)
    keep = head >= 100 ? 0 : head >= 10 ? scale / 10 : scale / 100,
    tail = keep ? Math.round(rest / keep) * keep : 0;
  if (tail >= scale) return spoken((head + 1) * scale);
  return tail ? `${under1000(head)} ${word}, ${spoken(tail)}` : `${under1000(head)} ${word}`;
}
/** A number said round: "some eleven thousand", "near six million". */
function round(n: number, key: number): string {
  const mag = 10 ** Math.floor(Math.log10(Math.max(1, n))),
    near = Math.round(n / mag) * mag,
    said = spoken(near);
  return `${unit(key, 77) < 0.5 ? "some" : "near"} ${said}`;
}

/** A name worn short by telling: the back of it gone, "Troupythford" to "Troupyth". */
export function wornName(name: string): string {
  const word = name.split(" ")[0]!;
  // (Not a name: "the hot desert", "the flood".)
  if (/^[a-z]/.test(word)) return name;
  if (word.length <= 5) return word;
  const m = /^(.{3,}?[aeiouy]+[^aeiouy]{1,2})/i.exec(word);
  return m && m[1]!.length < word.length ? m[1]! : word.slice(0, Math.ceil(word.length * 0.6));
}

type Bank = {
  /** What it is called, by how worn it is (the first that its holes can be filled, from its own draw on). */
  readonly titles: readonly (readonly string[])[];
  /** While it still counts or holds its names. */
  readonly near: readonly string[];
  /** Once the names are worn or gone. */
  readonly far: readonly string[];
  /** Cut on its stone. */
  readonly cut?: readonly string[];
};

// The holes: {town} {land} {us} {them} {who} {what} {dead} {homes} {years} {year} {stone} {beast} {god}, and what differs by a people's
// world: {roof} {hearth} {fields} {road} {bread} {ground} {sky} {sang} {door}.
const BANKS: Readonly<Record<SongKind, Bank>> = {
  beast: {
    titles: [
      ["The Song of {what}", "{what} at {town}", "Who Went After {what}"],
      ["{what}", "The Beast of {town}"],
      ["What Came Down to the {fields}", "The Long Winter's Beast"],
      ["The Beast", "What Walked the {ground}"],
    ],
    near: [
      "We named it {what}, so we could say who took them.",
      "{who} went out from {town} when no one else would go.",
      "It came down to the {fields} of {town} in the year {year}.",
      "You knew its track by morning, and by night you counted heads.",
      "{who} came back up the {road} and the whole of {town} came out.",
      "No {roof} in {town} slept easy while it walked the {ground}.",
      "It took {beast} from us and we called it by a name.",
    ],
    far: [
      "There was one of them, once, that people knew.",
      "It had a name. You wouldn't want it said after dark.",
      "They say it came down to the {fields} in a hard year.",
      "Bar your {door}, my grandmother would say, and she meant that one.",
      "No one living saw it. Everyone can tell you what it looked like.",
    ],
    cut: ["Here the {fields} were safe again", "{what} walked here"],
  },
  battle: {
    titles: [
      ["The Field at {town}", "How {us} Held at {town}", "The Day at {town}", "{dead} at {town}"],
      ["How {us} Held at {town}", "The Field at {town}", "The Long Day at {town}"],
      ["The Stand at {town}", "The Field of {town}", "Who Stood at {town}"],
      ["The Red Field", "The {field} No One {ploughs}", "The Morning They All Went Out"],
    ],
    near: [
      "{them} came up from the {road} to {town} in the year {year}.",
      "We left {dead} on that {ground} and we can name you most of them.",
      "{dead} went out past the last {roof} of {town} and did not come in to eat.",
      "{them} had the numbers. We had {town} behind us.",
      "Ask {them} how it went at {town}. They will tell you it was a good day.",
      "You can still find the arrow-heads, and you can still find the men who found them.",
      "My mother's brother went with {us} carrying a good knife and a bad cough.",
      "They said it would be over by the {bread}. It was.  There were fewer to feed.",
      "{us} held the {road} till dark and in the morning there was no one to hold it from.",
      "The {beast} would not graze that {ground} for three years, and we didn't ask them to.",
    ],
    far: [
      "They came up the {road} to {town}, and you could not see the end of them.",
      "Everyone's grandmother's grandmother was there, if you ask.",
      "There was a {ground} once where no one would stop to rest.",
      "The ones who stood did not come home. The ones who came home did not stand. That's all of it.",
      "They say a thousand, they say ten thousand. They say it louder every year.",
      "One stood in the gap and would not move, and no one now knows who.",
      "The {plough} still turns up what was left there.",
    ],
    cut: ["To those who stood at {town}.", "{us} stood here.", "Year {year}. Here they stopped."],
  },
  struck: {
    titles: [
      [
        "The Night of {town}",
        "What Fell on {town}",
        "{homes} Roofs of {town}",
        "Under {town}'s Sky",
      ],
      ["What Fell on {town}", "The Night of {town}", "The Burning of {town}"],
      ["When {town} Looked Up", "The Burning of {town}"],
      ["The Night Without Morning", "The Sky That Came Down", "What Fell at Supper"],
    ],
    near: [
      "They were {them}'s, and they came over {town} when the {bread} was on the table.",
      "{dead} in {town}. We know, because we dug.",
      "{homes} roofs were down by first light, and every one had a name on the door.",
      "No one on our side ever saw the face of anyone who did it.",
      "You could hear them a long time before anything happened. That was the worst of it.",
      "{them} never set a foot in {town}. They never had to.",
      "The children of {town} still go quiet when anything passes over.",
      "My neighbour went back in for the {beast} and I have kept the gate open since.",
    ],
    far: [
      "The sky over {town} opened, and no one had done anything.",
      "They were at supper. They are always at supper, when it is told.",
      "A hum, a light, and the street you knew was gone.",
      "They dug for a year, and then they built on top.",
      "No one saw who did it. No one has ever seen who does it.",
    ],
    cut: ["The people of {town}, at home.", "{dead}, at home.", "They were at home."],
  },
  fire: {
    titles: [
      ["The Light Over {town}", "{town}, and the Day After", "When {them} Lit the Sky"],
      ["The Light Over {town}", "The Wind from {town}"],
      ["The Second Sun", "The Light Over {town}"],
      ["The Second Sun", "The Day the Birds Fell", "The Ash Song"],
    ],
    near: [
      "A second sun came up over {town} and it was not morning.",
      "{them} did this. We say so at every feast, so that no one forgets to.",
      "{dead} in the time it takes to look up.",
      "The wind took it on past {town}, and the {fields} it crossed gave nothing for years.",
      "There are shadows on the walls that stayed behind when the people went.",
      "Nothing grows at the middle yet. We leave the stump there so you'll know where it is.",
      "Nobody who saw it wants to tell you, so listen when they do.",
    ],
    far: [
      "There was a sun that came up in the wrong place, once.",
      "They say the ground there shone at night, and that no one's children were right.",
      "Whatever it was, it was made by someone, and the someone thought it would end things.",
      "It did.",
      "No bird will cross the place. Nobody has asked the birds why.",
      "Don't dig there. That is the whole of the song. Don't dig there.",
    ],
    cut: ["Left as it was.", "Do not build here.", "This was {town}."],
  },
  plague: {
    titles: [
      ["{what}", "The Year of {what}", "Who Came Home from {town}", "The Doors of {town}"],
      ["The Year of {what}", "The Doors of {town}", "The Sick Year at {town}"],
      ["The Doors of {town}", "The Coughing Year"],
      ["The Sleeping Sickness", "The Quiet Street", "Don't Drink, Don't Knock"],
    ],
    near: [
      "{what} came to {town} on someone's breath, and they were only saying hello.",
      "{dead} before it let go, and it let go when it was ready.",
      "We marked the doors. Then we ran out of what we marked them with.",
      "The healer of {town} went from house to house until there was no healer of {town}.",
      "No one took it from {them}, no one brought an army. It simply walked in.",
      "The one who carried out my mother was carried out by someone I don't know.",
      "We kept the {bread} at the end of the street, and we left the money in water.",
      "It went on down the {road}, and we were ashamed of how glad we were.",
    ],
    far: [
      "There was a sleep that came down the {road}, and some got up from it.",
      "Don't knock at a marked door. Don't ask who marked it. Children still play this.",
      "All the old ones in that song are dead, and they were all dead by the end of it.",
      "They burned the bedding. They burned the beds. They looked at the houses for a while.",
      "A street in {town} has no name, and no one will tell you why.",
    ],
    cut: ["{dead}. We ran out of room for the names.", "All these, of {what}.", "Knock, and wait."],
  },
  hunger: {
    titles: [
      ["The Hungry Year at {town}", "The Lean Years of {land}", "When {town} Ate the Seed"],
      ["The Long Hunger", "The Empty Bowl at {town}", "When {town} Ate the Seed"],
      ["The Long Hunger at {town}", "The Empty Bowl of {town}", "When {town} Ate the Seed"],
      [
        "The Long Hunger",
        "The Old Hunger",
        "The Bowl Song",
        "The Seed Song",
        "The Thin Year",
        "The Winter They Ate the Seed",
        "Leave a Little",
        "Who Stopped Coming to Table",
      ],
    ],
    near: [
      "The {fields} of {land} gave half and then they gave less.",
      "We ate the {beast}, and then we ate what the {beast} ate.",
      "In {town} they ate the seed in the second winter, knowing what it was.",
      "My father stopped coming to the table so that it would look like there was enough.",
      "There was {bread} in the next land. There always is.",
      "No one was to blame, and we blamed everyone we could reach.",
      "The dead were light to carry. Nobody says that part.",
    ],
    far: [
      "There was a year with no end to it, and the children forgot what to ask for.",
      "Eat what's on the table. You know why. Everyone's mother said it, and hers said it.",
      "They ate the seed, and it's a sin now, and nobody can say why it's a sin.",
      "Leave a little in the bowl for the Long Hunger, so that it goes on to the next house.",
      "The {beast} came through it, and they remember, and they don't come when you call.",
    ],
    cut: [
      "Eat, and remember.",
      "Those the {fields} could not feed.",
      "An empty bowl, year {year}.",
    ],
  },
  fall: {
    titles: [
      ["The Fall of {what}", "The Last Day of {what}", "The End of the {what} Roll"],
      ["The Fall of {what}", "What Was Left of {what}"],
      ["When There Was {what}", "The Fall of {what}"],
      ["The Great Old Country", "The Kings Before", "The Land Before This One"],
    ],
    near: [
      "{what} stood {years} years, and then one morning we were told it had not.",
      "They took the seal down in {town} and no one knew where to put it.",
      "My father paid {what} its tithe the very week there stopped being a {what}.",
      "{them} marched through and the shops stayed open. It was that sort of ending.",
      "You can still see {what}'s mark over the doors, if you know which doors.",
      "There's an old one in {town} who will not call it anything else.",
    ],
    far: [
      "There was a great country here, before. They had a word for it. It's lost.",
      "The old road runs straight for no reason. {what} built it, and it's a good road.",
      "They had everything, says the song. The song was written by people who didn't.",
      "It ended the way they end, a little at a time, and then one tax collector didn't come.",
      "Some still set a place for the king of it. Most have forgotten that's what they're doing.",
    ],
    cut: ["Here was the seat of {what}.", "{what}. {years} years.", "{what} ended here."],
  },
  ruler: {
    titles: [
      ["{who} Is Dead", "For {who}", "The Burying of {who}"],
      ["For {who}", "{who}'s Long Reign", "{who} of {us}"],
      ["Old {who}", "When {who} Ruled"],
      ["The Old One Under the Hill", "The One Who Sleeps", "The King in the Ground"],
    ],
    near: [
      "{who} ruled {us} from {town}, and lived to be {age} years old.",
      "{who} sat {years} years and died in bed, and we're told that's how it should go.",
      "They put {who} in the ground at {town}, and {to} went straight back to work.",
      "Whatever you thought of {who}, you knew whose face was on it.",
      "There's a whole generation in {us} who never knew any other name to curse.",
      "{who} was hard, and the {bread} was cheap, and I would not go back.",
    ],
    far: [
      "Old {who} is under the hill at {town}, and will get up if you need it.",
      "They say {who} never slept, and never lost, and had a good word for everyone. They say that of all of them.",
      "When the {beast} are restless, the old ones say it's {who} walking the wall.",
      "Someone ruled here so long that it stopped being a name, and started being the weather.",
      "There is one asleep under the hill. Be polite when you walk on it.",
    ],
    cut: ["{who}. {years} years.", "{who} lies here.", "{who}, of {us}, aged {age}."],
  },
  rising: {
    titles: [
      ["The Rising at {town}", "{dead} in the Square at {town}", "What {us} Did at {town}"],
      ["The Rising at {town}", "What We Asked For", "The Square at {town}"],
      ["The Day the Square Filled", "What We Asked For"],
      ["The Day the Square Filled", "The Ones Who Asked"],
    ],
    near: [
      "We went to the square at {town} to ask for it, and we asked out loud.",
      "{us} answered, and it took about as long as you'd think.",
      "{dead} in one day, and the {bread} went up again the week after.",
      "Everyone knows who gave the word. It's on the coins.",
      "They'd have had us believe that no one was there. I was there.",
      "We didn't get it that year. We got it later, and some of us remembered why.",
    ],
    far: [
      "They filled the square, and no one had told them they could.",
      "Whoever it was, they asked for something, and it's the same thing we ask for now.",
      "Children play it: one is the wall and all the rest run.",
      "They say the stones of that square were washed for a month. Ask anyone. Ask why.",
    ],
    cut: ["They asked.", "{dead}, who asked.", "Here they asked, year {year}."],
  },
  freed: {
    titles: [
      ["The Day the Rolls Burned", "Free in {us}", "The Last Day of the Bond"],
      ["The Day the Rolls Burned", "Whose Hands These Are"],
      ["The Day the Rolls Burned", "Whose Hands These Are"],
      ["Whose Hands These Are", "The Unbound Song", "The Walking-Out Song"],
    ],
    near: [
      "{us} tore up the rolls and {freed} walked out of the yards with nowhere to go.",
      "The first thing my mother did was sit down in the middle of a working day.",
      "We owned nothing, and it was all ours.",
      "The ones who'd held the rolls said it would be the ruin of us. Some of us laughed for a year.",
      "Don't tell me it was a gift. Ask how many asked before it was given.",
    ],
    far: [
      "Once people were kept, as you keep a {beast}. No, truly. Ask anyone old.",
      "They walked out at the turn of the year, singing this, and it had different words.",
      "Whose hands are these? Mine. Whose are these? Mine. Say it to the children.",
    ],
    cut: ["No one is kept here.", "Whose hands these are.", "Walked out, year {year}."],
  },
  coup: {
    titles: [
      ["{who}'s Morning", "How {who} Took {us}", "The Guard at the Door"],
      ["How {who} Took {us}", "{who}'s Morning"],
      ["The General's Song", "The Guard at the Door"],
      ["The Guard at the Door", "The One Who Came In Armed"],
    ],
    near: [
      "{who} went in with soldiers at breakfast, and by noon there was a new law about breakfast.",
      "{us} woke up with the same {roof}s and a different name on the taxes.",
      "No one was asked. It's possible no one minded. No one was asked that either.",
      "Those at the gate in the morning were at the gate at night, and they were saluting.",
    ],
    far: [
      "There's always one who comes in with armed friends, and the song is always this song.",
      "They shut the door with the ruler on the wrong side of it.",
      "Mind who stands behind you at table. It's good manners and it's better sense.",
    ],
  },
  first: {
    titles: [
      ["The First at {land}", "How It Was Found in {land}", "{land} and the First"],
      ["The First at {land}", "How It Was Found in {land}"],
      ["The Beginning", "How We Came to Know It"],
      ["The Beginning", "Before Anyone", "The First Morning"],
    ],
    near: [
      "No one in all the world had done this, until someone in {land} did.",
      "It was an accident, and they did it again on purpose, and that's the whole of what we are.",
      "They say it was {year}. We've counted it back, and we keep getting it wrong.",
      "The ones who came after had it from us. We don't mind. We mention it.",
    ],
    far: [
      "Before the first of us there was {land}, and it had no one to name it.",
      "We came up out of the {ground} there, says the song. The old ones point to the place.",
      "Someone stood up, and looked about, and said a word. We've been saying it since.",
      "We were few. You could have fed all of us from one {beast}.",
      "Nothing had a name, and it was no one's fault.",
      "Take off your shoes at {land}. No one knows why. It's where we started.",
    ],
    cut: ["Here, first.", "From here.", "Everyone you know began here."],
  },
  strangers: {
    titles: [
      ["When {what} Came", "The Landing at {land}", "The Ones From the Sky"],
      ["When {what} Came", "The Landing at {land}", "The Ones From the Sky"],
      ["The Ones From the Sky", "The Strangers' Song"],
      ["The Ones From the Sky", "The Sky People", "Who Else There Is"],
    ],
    near: [
      "{what} came down at {land}, and they had no idea what we'd call them.",
      "Nobody here had ever been a stranger. We were bad at it.",
      "We had thought we were the only ones, and it was a comfortable thing to think.",
      "They looked at us as we look at a {beast}, trying to be kind about it.",
      "Some of us ran, and some brought {bread}. Both seemed right.",
    ],
    far: [
      "Others came out of the sky, and they weren't gods, and that was worse.",
      "Leave a door open. They might be from somewhere, and you might be from somewhere.",
      "No one knows what was said. Everyone knows what it meant.",
      "They went away again, or they didn't. Look at your neighbour's hands.",
    ],
    cut: ["They came down here.", "We were not alone. Year {year}.", "{what} landed here."],
  },
  faith: {
    titles: [
      ["The Word at {land}", "How {what} Began", "The First of {what}"],
      ["How {what} Began", "The Word at {land}"],
      ["The Word at {land}", "The First of the Faithful"],
      ["The First Prayer", "The One Who Heard"],
    ],
    near: [
      "Someone stood up in {land} and said what we'd all been afraid of, and called it holy.",
      "They called themselves {what}, and by the second winter there were more of them than graves.",
      "My aunt went to hear it to laugh. She's still there.",
      "It costs nothing to believe, and they will tell you exactly what it costs.",
    ],
    far: [
      "Someone heard something, and did not keep it to themselves.",
      "{god} spoke there, or something did, and everyone's been arguing about it since.",
      "The first of them had no name that we keep, and we kill each other over what they said.",
    ],
    cut: ["The word came here.", "Listen.", "Here it was first said."],
  },
  peace: {
    titles: [
      ["The {years} Years", "The End of the {years} Years", "Home from {them}"],
      ["The {years} Years' War", "Home from {them}"],
      ["The Long War", "Home from the Long War"],
      ["The Long War", "Coming Home"],
    ],
    near: [
      "{years} years of it, and then a page with two names on it, and everyone went home.",
      "No one can tell you what {us} got out of it. Ask what {them} got. Same answer.",
      "I went at sixteen. I came back and my {beast} didn't know me.",
      "We were told it was won. We looked at who was left, and we agreed.",
      "They rang everything that could be rung, and then it was very quiet.",
    ],
    far: [
      "It went on so long that no one could say who'd started it, and they kept fighting to find out.",
      "Fathers went, and sons went, and at last there was no one to send and that was the peace.",
      "The road home is longer than the road there, and it's the same road.",
    ],
  },
  leaving: {
    titles: [
      ["The Ship to the {year} Star", "Those Who Went from {land}", "Don't Wait Up"],
      ["Those Who Went from {land}", "Don't Wait Up"],
      ["Those Who Went", "Don't Wait Up"],
      ["Those Who Went Up", "The Empty Berth", "Those Who Went"],
    ],
    near: [
      "They left from {land}, with all that could be carried, and the rest of us stood and looked.",
      "My daughter sends word. It's old by the time it comes. She's older now than the word.",
      "Up there it isn't any season. She says you stop missing it. I don't believe her.",
      "No one who went will walk in {town} again, and they knew, and they went.",
    ],
    far: [
      "Some of us went up, says the song. We are the ones who stayed. We don't say why.",
      "Somewhere there's a world full of our cousins, with all our stories wrong.",
      "Leave a light. It will be a long time. Leave a light anyway.",
    ],
    cut: ["They left from here.", "Leave a light.", "Gone up, year {year}."],
  },
  asked: {
    titles: [
      ["What {town} Was Asked", "The Asking at {town}"],
      ["What {town} Was Asked", "The Asking"],
      ["The Asking", "The One Who Asked"],
      ["The Asking", "They Asked and We Built"],
    ],
    near: [
      "We were asked, and we carried it, and it stands, and no one has yet told us why us.",
      "The stone came from the yard one load at a time. I know. I carried some.",
      "It stands where the old homes stood, and they haven't stopped saying so.",
    ],
    far: [
      "Someone asked this of {town}, the song says. No one knows now who it was who carried it.",
      "Ask who built it, and they'll name no one. Ask who asked, and they look up.",
      "It was asked for, says the song, and it was raised, and that is all the song knows.",
    ],
    cut: ["We were asked.", "It was asked for.", "They asked and we built, year {year}."],
  },
  sky: {
    titles: [
      ["What Came Down on {town}", "The Year of {what} at {town}", "{town} Under {what}"],
      ["What Came Down on {town}", "The Year of {what}"],
      ["The Anger of {god}", "What Came Down"],
      ["The Anger", "The Hand", "The Day the God Looked Down"],
    ],
    near: [
      "No one did it. There was nobody to hate. We tried.",
      "{what}, in the year {year}, and those who'd gone to the {road} that day still say they were lucky.",
      "It took {dead}, and it took the {fields}, and it left the tax rolls.",
      "We rebuilt in the same place. We know. Where else is there?",
    ],
    far: [
      "{god} put a hand on the land once, and took it off, and it was never the same shape.",
      "There's a mark on the land. Everyone says it's the god's. No one says what we did.",
      "Keep the old ways on that day. No one has ever kept them and been struck. No one has checked.",
    ],
    cut: ["The hand fell here.", "Year {year}. Nobody did this.", "We rebuilt."],
  },
};

/** What ends a song, by how worn it is. */
const ENDS: readonly (readonly string[])[] = [
  [
    "Say the number. It's not a big thing to ask.",
    "That's as much as I know. I was there.",
    "We don't sing this one when they're listening.",
    "There are those still living. Mind how you sing it.",
    "Pass the bowl. Someone say the next one.",
    "It wasn't long ago. Ask anyone over forty.",
    "Now you know, and you can stop asking.",
    "There's a stone. Go and see it. Then come back and eat.",
  ],
  [
    "My grandmother had it from hers, and that one was there.",
    "They've changed the words since. These are the right ones.",
    "You'll hear it told otherwise, further down the {road}.",
    "Sing it at the turn of the year, and don't sing it twice.",
    "There's nobody left to be angry at. We manage.",
    "They taught it to us in the first year of school, and left out the second verse.",
    "Everyone knows this one. No one knows all of it.",
  ],
  [
    "That's how it goes. No one sings it the same way twice.",
    "It's only a song. Don't go up there at night.",
    "They say it's true. They say that of all of them.",
    "Nobody knows what it means now. We keep the tune.",
    "Hush. Go to sleep. It was all a long time ago.",
    "The rest of it is lost. It was the best part, they say.",
  ],
  [
    "No one remembers what it was about. Everyone knows when to go quiet.",
    "It's only a song for skipping, now.",
    "We sing it to the little ones, and they aren't afraid, and that's right.",
    "It is older than the words for it.",
    "There may never have been such a time. Sing it anyway.",
  ],
];

/** The form a song has come to, by what it tells and how worn: what it is called, and how it is laid out. */
const FORMS: Readonly<Record<string, string>> = {
  lament: "a lament",
  count: "a counting song",
  march: "a walking song",
  tale: "a tale told at table",
  rhyme: "a rhyme for children",
  boast: "a boast, sung loud",
  sea: "a swimming song",
  hymn: "a hymn",
  ballad: "a long ballad, cut short",
};

function formOf(f: SongFacts): keyof typeof FORMS {
  const w = wornBy(f.age),
    draw = unit(f.key, 9);
  if (w === 3 && draw < 0.5) return "rhyme";
  if (w >= 2 && draw < 0.75) return "tale";
  if ((f.kind === "faith" || f.kind === "sky" || f.kind === "first") && draw < 0.6) return "hymn";
  if ((f.kind === "battle" || f.kind === "rising" || f.kind === "freed") && f.won && draw < 0.6)
    return "boast";
  if (f.water && draw > 0.72) return "sea";
  if (w === 0 && f.dead >= 20 && draw < 0.34) return "count";
  if (f.kind === "peace" || f.kind === "leaving" || draw > 0.84) return "march";
  if (draw > 0.66) return "ballad";
  return "lament";
}

/** The word for a thing of a people's own world. */
function own(hole: string, f: SongFacts, k: number): string | null {
  const water = f.water;
  switch (hole) {
    case "roof":
      return water ? "vault" : "roof";
    case "door":
      return water ? "curtain" : "door";
    case "hearth":
      return water ? "hollow" : f.fireless ? "table" : "hearth";
    case "fields":
      return water ? "kelp beds" : "fields";
    case "road":
      return water ? "current" : "road";
    case "bread":
      return water ? "catch" : unit(k, 3) < 0.5 ? "harvest" : "bread";
    case "ground":
      return water ? "sand" : "ground";
    case "sky":
      return water ? "surface" : "sky";
    case "plough":
      return water ? "tide" : "plough";
    case "field":
      return water ? "Sand" : "Field";
    case "ploughs":
      return water ? "Crosses" : "Ploughs";
    default:
      return null;
  }
}

/** One line, its holes filled (null: one it can't fill, or that has no place in a song this worn). */
function fill(line: string, f: SongFacts, extra: Readonly<Record<string, string>>): string | null {
  const w = wornBy(f.age);
  let bad = false;
  const said = line.replace(/\{(\w+)\}/g, (_, hole: string): string => {
    const v = ((): string | null => {
      switch (hole) {
        case "town":
          return f.town && w < 3 ? (w === 2 ? wornName(f.town) : f.town) : null;
        case "land":
          return f.land && w < 3 ? (w === 2 ? wornName(f.land) : f.land) : null;
        case "us":
          return f.us && w < 2 ? f.us : null;
        case "them":
          return f.them && w < 2 ? f.them : w >= 2 ? null : null;
        case "who":
          return f.who && w < 3 ? (w === 2 ? (f.who.split(" ")[0] ?? null) : f.who) : null;
        case "what":
          return f.what && w < 3 ? (w === 2 ? wornName(f.what) : f.what) : null;
        case "dead":
          return f.dead > 0 && w < 2 ? (w === 0 ? spoken(f.dead) : round(f.dead, f.key)) : null;
        case "homes":
          return f.homes > 0 && w < 1 ? spoken(f.homes) : null;
        case "years":
          return f.years > 0 && w < 2 ? spoken(f.years) : null;
        case "year":
          return w < 1 ? String(f.year) : null;
        case "stone":
          return f.stone;
        case "beast":
          return f.beast;
        case "god":
          return f.god;
        default:
          return extra[hole] ?? own(hole, f, f.key);
      }
    })();
    if (v === null || v === undefined || v === "") {
      bad = true;
      return "";
    }
    return v;
  });
  if (bad) return null;
  const tidy = said.replace(/ {2,}/g, " ").trim();
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
}

/** Lines drawn from a bank without repeats, in a draw of its own, as many as can be filled. */
function drawn(
  bank: readonly string[],
  f: SongFacts,
  extra: Readonly<Record<string, string>>,
  most: number,
  salt: number,
): string[] {
  const order = bank
    .map((l, i) => ({ l, u: unit(f.key, salt + i * 7) }))
    .sort((a, b) => a.u - b.u)
    .map((x) => x.l);
  const out: string[] = [];
  for (const l of order) {
    if (out.length >= most) break;
    const s = fill(l, f, extra);
    if (s) out.push(s);
  }
  return out;
}

export type Song = {
  readonly title: string;
  /** What it is: "a lament". */
  readonly form: string;
  readonly lines: readonly string[];
  /** Its first line: for a card or the bar. */
  readonly line: string;
};

/** A song's name, its verse and its form. */
export function songOf(f: SongFacts, extra: Readonly<Record<string, string>> = {}): Song {
  const bank = BANKS[f.kind],
    w = wornBy(f.age),
    form = formOf(f),
    near = w < 2,
    // (Long and short: a verse of three to five lines, and an old rhyme less.)
    want = form === "rhyme" ? 2 : 3 + Math.floor(unit(f.key, 11) * 3),
    main = drawn(near ? bank.near : bank.far, f, extra, want, 20),
    // (Too few lines this worn: the worn ones' words go on, which hold no names.)
    more =
      main.length < 2
        ? drawn(near ? bank.far : bank.near, f, extra, 2 - main.length, 40).filter(
            (l) => !main.includes(l),
          )
        : [],
    lines = [...main, ...more],
    end = fill(ENDS[w]![Math.floor(unit(f.key, 13) * ENDS[w]!.length)]!, f, extra),
    laid = layOut(form, lines, end, f);
  return {
    title: titleOf(bank, w, f, extra),
    form: FORMS[form]!,
    lines: laid,
    line: laid[0] ?? "",
  };
}

/** The song in the shape its form gives it. */
function layOut(
  form: keyof typeof FORMS,
  lines: readonly string[],
  end: string | null,
  f: SongFacts,
): readonly string[] {
  const out = [...lines];
  switch (form) {
    case "count": {
      // (Said between its lines, as a count is.)
      const by = `Count them. ${sentenceCase(spoken(f.dead))}.`,
        mixed: string[] = [];
      out.forEach((l, i) => {
        mixed.push(l);
        if (i % 2 === 1 || i === out.length - 1) mixed.push(by);
      });
      return end ? [...mixed.slice(0, mixed.length - 1), by, end] : mixed;
    }
    case "march": {
      const burden = out[0];
      return burden && out.length > 2
        ? [burden, ...out.slice(1, 3), burden, ...out.slice(3), ...(end ? [end] : [])]
        : [...out, ...(end ? [end] : [])];
    }
    case "sea":
      return [
        ...out,
        ["Down and on, down and on.", "Round the reef and home.", "Hold your breath and sing it."][
          f.key % 3
        ]!,
        ...(end ? [end] : []),
      ];
    case "tale": {
      // (One breath, as it is told: "they say", where the first line isn't already saying so, or telling you to do something.)
      const told = out
        .map((l, i) =>
          i === 0 && !/^(They say|Eat|Leave|Don't|Keep|Take|Mind|Ask|Whose|No one|Nobody)\b/.test(l)
            ? `They say ${l.charAt(0).toLowerCase()}${l.slice(1)}`
            : l,
        )
        .join(" ");
      return [told, ...(end ? [end] : [])];
    }
    case "rhyme":
      return out;
    case "boast":
      return [...out, "And who's to say otherwise? Come here and say it.", ...(end ? [end] : [])];
    default:
      return [...out, ...(end ? [end] : [])];
  }
}

const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** What a song is called: the first of its titles it can fill, from its own draw on, or the older ones'. */
function titleOf(
  bank: Bank,
  w: number,
  f: SongFacts,
  extra: Readonly<Record<string, string>>,
): string {
  for (let band = w; band < bank.titles.length; band++) {
    const list = bank.titles[band]!,
      from = Math.floor(unit(f.key, 17) * list.length);
    for (let i = 0; i < list.length; i++) {
      const s = fill(list[(from + i) % list.length]!, f, extra);
      if (s) return titleCase(s);
    }
  }
  return "A Song No One Can Name";
}

/** A title's small words small and its numbers' words up. */
function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w, i) =>
      i > 0 && /^(of|the|at|and|in|on|to|from|a|an)$/i.test(w) ? w.toLowerCase() : sentenceCase(w),
    )
    .join(" ");
}

/** What is cut on its stone (null: it says nothing of its own). */
export function cutOn(f: SongFacts, extra: Readonly<Record<string, string>> = {}): string | null {
  const list = BANKS[f.kind].cut;
  if (!list) return null;
  // (A stone is cut once, and read as it was cut: its words don't wear as a song does, only as stone does.)
  const fresh: SongFacts = { ...f, age: 0 },
    from = Math.floor(unit(f.key, 19) * list.length);
  for (let i = 0; i < list.length; i++) {
    const s = fill(list[(from + i) % list.length]!, fresh, extra);
    if (s) return s;
  }
  return null;
}
