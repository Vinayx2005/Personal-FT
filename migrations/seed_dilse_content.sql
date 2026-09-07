-- Seed the 5 published dilse stories and the 1 published book that used
-- to live hardcoded in apps/dilse/src/lib/data.ts.
--
-- Idempotent — `on conflict (slug) do nothing` skips rows already there.
-- Delete a row from the DB (via CMS or SQL) if you want to re-seed a
-- corrected version.
--
-- Prereq: run migrations/create_content_tables.sql first (creates schemas
-- + tables + RLS).

-- ─── 5 stories ─────────────────────────────────────────────────────────
insert into dilse.stories
  (slug, title, excerpt, body_md, read_time, genre, date_display, published_at, author_email)
values
(
  'a-lifelong-promise',
  'A Lifelong Promise',
  'A heartfelt birthday confession where love turns into a lifelong promise built on trust.',
  $STORY$Surya is overjoyed today, his face glowing with excitement. He feels as if he has achieved something incredible, and the reason for his happiness is Vaishali. It's December 19, Vaishali's birthday, and she turned 25. Surya couldn't wait to meet her.

At 8:00 a.m., Surya picked up his phone and called Vaishali. She had just woken up, her eyes still heavy with sleep. As she opened them, the first thing she saw is her phone ringing with Surya's name on the screen. Forgetting it was her birthday, she answered in a drowsy voice, "Ahhh... What happened? Why are you calling me this early?"

Surya chuckled and replied sarcastically, "Ohh, so I need permission to call you in the morning now? Should I write you a formal request next time, madam?"

Vaishali smirked, "Stop teasing me. Just tell me, why did you call me so early?"

Surya asked curiously, "Do you realize something?"

Vaishali, confused, began wondering if something had gone wrong. She asked innocently, "What should I realize?"

Surya smiled and said, "Vaishu, today you've completed 25 years of your life. Happy Birthday, Vaishu!"

Suddenly, the realization hit Vaishali. Her drowsiness disappeared, and she jumped out of bed, startled. "Oh no! It's December 19! It's my birthday!" she exclaimed.

Surya smiled and said, "Vaishu, I want to see you today."

Vaishali hesitated, "But my dad's at home; he hasn't gone to work today."

Surya teased, "It's your birthday, which means you have to listen to me today!" Vaishali laughed, "Oh, I thought it's the other way around. Alright, I'll figure something out. Let's meet at Beach Road?"

Surya agreed, "Mmm… sure, Vaishu."

Vaishali was thrilled. She thought about how Surya always remembered the special days in her life. Meanwhile, Surya got ready, feeling both excited and a little nervous.

By 10:00 a.m., Vaishali arrived at the Submarine Museum on Beach Road. She wore a white saree, her hair tied traditionally, adorned with elegant accessories. She looked like an angel. Surya, already waiting on his bike, was mesmerized by her beauty.

Vaishali expected Surya to have a gift for her. Instead, he shyly said, "Vaishu, can we ride on my bike together?" She raised her eyebrows in surprise, "Alright, Surya. I'll park my scooter here and join you."

As they started the ride, Vaishali sat sideways on the bike, her right hand resting gently on Surya's shoulder. Surya smiled, but he remained unusually quiet. Vaishali wondered why he was so silent on her birthday.

After a 50-minute ride, they reached Yarada Beach, a serene spot in Visakhapatnam with soft sand and clear waters. The beach was nearly empty, making it even more peaceful. They walked to a small open hut surrounded by coconut trees. The gentle breeze and mild sunlight created a magical atmosphere.

Surya hesitated but finally spoke, "Vaishu, today is your birthday… and we've known each other for 7 years. It's been an amazing journey. I have something to confess."

Vaishali looked at him intently, curious and a bit anxious.

Surya took a deep breath. "Vaishu, I love you."

Vaishali smiled playfully, "I know, Surya."

Surya blushed, "Please, let me say it. I'm already nervous!"

He continued, "In these 7 years, you've changed me completely. I was so immature when we first met. At first, I was just attracted to your looks, but you taught me how to understand my emotions. You've been my best teacher and the biggest blessing in my life."

Vaishali stepped closer, her eyes soft with emotion. "Surya, you're my responsibility. When I say I love you, it means I love all of you—your good, your flaws, your happiness, your pain. It's my job to make you feel loved and cared for, just as you do for me."

Surya's heart swelled with happiness. Smiling, he pulled out a small box with two beautifully crafted rings. The rings had shiny stones and a unique design that made them look special and full of meaning.

Vaishali's eyes widened. "Are these engagement rings?"

Surya chuckled, "No, Vaishu. These are even more special. I call them the Rings of Trust. And no, don't laugh at the name!"

Vaishali giggled but was deeply moved. Surya took one ring and gently slid it onto her finger. "Vaishu, whenever you look at this ring, remember this day. I promise to always trust you, no matter what life brings."

Vaishali was overwhelmed with emotion. Without saying a word, she took the second ring and gestured for Surya to show his hand. As she slid the ring onto his finger, she paused and asked, "Surya, does trust come from love, or does love come from trust?"$STORY$,
  '3 min read',
  'Love',
  '2/14/2025',
  '2025-02-14 00:00:00+05:30',
  'vinayteja23@gmail.com'
),
(
  'lets-finds-a-way',
  'Let''s Finds A Way',
  'Two hearts trying to hold onto each other while life keeps testing them.',
  $STORY$It had been a month since Surya and Vaishali last met. Both had been so busy with their careers that they couldn't find the time to see each other. A rare long weekend brought them together in Vaishali's home. Sitting on the couch under the warm glow of ambient light, their hands entwined, they poured their hearts out to each other, speaking of love, dreams, and fears. In that intimate space, time seemed to vanish.

Vaishali's father left for his office early in the morning, his usual routine. Her mother had plans to attend a wedding in her village. She packed a small bag and left shortly after breakfast, reminding Vaishali to take care of the house while she was away. It was around 4:30 PM, close to the time her father usually returned home, but neither Vaishali nor Surya noticed, as they were completely engrossed in their conversation.

The creak of stairs shattered their bubble. Vaishali's father entered, his stern gaze falling on Surya. "Hey Surya, how are you?" he asked.

Surya tried to remain calm. "Hello Uncle, I'm good, I was passing by and thought I'd meet you and Vaishali. It's been a while."

Her father gave a sarcastic smile and said, "Oh, Surya! How thoughtful of you to care so much about an old man like me. That's really sweet of you."

His tone slowly changed as he narrowed his eyes and looked directly at Surya. "But tell me, Surya," he said, his voice now serious, "wouldn't it be better if all this care were only for me and not for Vaishali? What do you say?"

Surya immediately understood the suspicion in his words. Trying to stay calm, he smiled and replied, "Uncle, I don't know what you mean…"

Before he could finish, Vaishali's father interrupted him, his voice rising in anger. "Stop lying, Surya! I know exactly why you're here. Let me make it clear, this is your last warning. Stay away from Vaishali! Don't come to my house or meet her anywhere else!"

The sharpness in his words made it clear he wasn't open to any excuses.

With that, he grabbed Surya by the shirt and pushed him out of the house, slamming the door behind him. Turning to Vaishali, he said firmly, "If you see him again, consider me dead."

Vaishali, heartbroken and helpless, locked herself in her room, crying. She didn't eat or come out for the rest of the day. Her room was dark, and she felt completely alone. Eventually, she cried herself to sleep.

Time passed. It's now 10 PM, and Surya couldn't bear the thought of Vaishali suffering alone. Determined to comfort her, he quietly climbed the wall of her house. Standing outside her window, he whispered, "Vaishu, wake up. It's me."

Vaishali, startled, opened her eyes and saw him. Her sadness turned to joy as she hurried to the window. Seeing him there made her feel less alone.

With a gesture, Surya signalled her to come outside.

She tiptoed out of the house and ran into his arms. They hugged tightly, finding comfort in each other. Needing fresh air and some peace, they decided to go for a bike ride.

Surya started the bike and gestured for Vaishali to hop on with a slight nod of his head. She climbed on, her eyes brimming with tears that threatened to fall. Unable to hold back her emotions, she gently rested her head on his shoulder, seeking comfort in his presence.

As they rode, Vaishali held Surya tightly, her heart full of love. The cool breeze brushed against their faces, making them feel free for the first time in weeks. It was like they had escaped their worries, even if only for a while.

Back home, Vaishali's father woke up coughing and noticed her room was empty. Panic set in as he realised she was gone. He tried calling her, but her phone was on silent. Worried, he woke the relatives and called them home, explaining the situation to them. Soon, the house was filled with his people, all anxious and angry.

Meanwhile, Surya and Vaishali walked along a quiet beach under dim streetlights. The silence of the night and the gentle breeze made them feel alive. For that time, they felt like they could breathe.

Suddenly, Vaishali's phone lit up with her cousin's name. Surya noticed it and said, "Vaishali, your phone is ringing." She glanced at the screen and froze, her face filled with fear.

"It's my cousin," she whispered nervously. "I think they've figured out we're not at home. My father must have told him to call me. They'll kill me! I can't answer this call."

Seeing how tense she was, Surya tried to reassure her. "Vaishali, it's okay. Just pick up the call. Nothing will happen, I'm here with you."

But she shook her head, panicked. "No, I can't. I'm scared."

Surya took the phone from her. Answering calmly, he said, "Hello, this is Surya. Vaishali is with me, and there's nothing to worry about. We're not doing anything wrong. We'll be back in 30 minutes, so don't overthink."

He then ended the call and switched off the phone.

Everyone at home was furious after hearing how Surya had spoken to Vaishali's cousin. Meanwhile, Vaishali's cousin kept trying to call her, but every attempt went to voicemail as her phone was switched off. The growing anger and fear in the family only intensified.

At the same time, Surya turned to Vaishali with a reassuring smile and said, "Vaishu, let's go home."

Shaking her head, Vaishali replied anxiously, "No, Surya. Are you crazy? My father is furious with both of us. He'll kill us! We can't go back."

Surya looked at her calmly and said, "Do you trust me? Then sit on the bike, Vaishu."

Still overwhelmed with fear, Vaishali hesitated, refusing to move. She became more tense. Surya drew her close, his hand resting softly on her waist. Looking straight into her eyes, he said firmly, "Trust me, Vaishu. We're in this together. I'll handle everything. Don't worry."

His words gave her some courage, and she finally climbed onto the bike without another word. As they rode toward her house, a storm of thoughts swirled in Vaishali's mind. She wondered if this would be her last day with Surya, yet a part of her hoped it marked the beginning of their happiness together. Emotions and fears clashed in her heart, but she held on tightly as Surya drove toward their uncertain fate.

As they finally reached home, Surya parked his bike and smiled at Vaishali, saying, "We're here, get down." And suddenly, Vaishali's calm expression turned tense again. When they returned, the atmosphere in the house was tense. Relatives glared, Vaishali's father fumed, and her cousin rushed toward them, but Surya stopped him with a calm gesture.

"Nothing has happened like you're all thinking," Surya said. Then he turned to Vaishali and told her, "Go sit down."

Vaishali looked into Surya's eyes, and he nodded, reassuring her with a silent gesture, "I'm here with you. Don't worry. Just go sit. I'll handle."

Vaishali walked over to the couch, sitting away from her father, where no one else was sitting. Her father and relatives stared at her with anger.

Surya confidently walked into the room, sat beside Vaishali, and, smiling, asked, "Why are you so scared, Vaishu? We're all human. We need time to understand each other's feelings. The same goes for your father, your cousin, and all your relatives who are angry at us."

Vaishali stared at him, confused. Surya got up from the couch and faced everyone.

"I love Vaishali," he said. "I want to marry her. If any of you think I'm not a good match for her, please tell me one thing about me that makes me unfit for her."$STORY$,
  '5 min read',
  'Love',
  '11/21/2024',
  '2024-11-21 00:00:00+05:30',
  'vinayteja23@gmail.com'
),
(
  'the-1-minute-and-9-seconds-kiss',
  'The 1 Minute & 9 Seconds Kiss',
  'A tender moment where nervousness slowly gives way to trust and love.',
  $STORY$Surya stands outside Vaishali's college, staring at the tall walls. It is a women's college with tight security, and no one without an ID can enter. For men, it is even tougher. But none of that matters to Surya. He has been missing Vaishali a lot, and today, he decides nothing will stop him from seeing her.

After carefully looking around, he finds a spot where he can climb the wall. His heart races as he climbs over and sneaks into the college. He manages to avoid the security guards and staff, making his way up to the first floor. Vaishali is a B.Sc. Economics student has a practical session scheduled today. Surya learned this from a mutual friend, and now he waits beside the lab she is heading to.

Vaishali and her friends are walking down the corridor, chatting. When he sees her, his face lights up with excitement. He feels so happy that he can't help but silently cheer.

Surya whispers, "Vaishu, Vaishu...."

Vaishali stops, confused. She thinks she hears something but isn't sure where it's coming from.

"Vaishu! Over here!" Surya says, waving his hand.

Her friends notice and nudge her. "Vaishali, who is that guy? He's waving at you!"

Vaishali's heart sinks. She feels nervous and panicked. Turning to her friends, she whispers, "Please go inside the lab. I'll explain everything later. Don't tell anyone about this, okay?"

Reluctantly, her friends enter the lab. Vaishali quickly walks over to Surya, her face full of anger and fear. "Surya, what are you doing here?" she whispers harshly. "This is a women's college! Do you have any idea how big of a problem this could be if someone catches you? Please leave right now!"

But Surya smiles. "I know, Vaishu. I know this is risky, but I can't help it. I miss you so much that I have to see you today."

Vaishali sighs, looking around nervously. "We're lucky my HOD isn't here today. If he catches us, it'll be a disaster. Please, Surya, leave. We can talk after college."

Surya shakes his head. "I'll leave, but there's something I need to say first."

Vaishali, now even more anxious, says, "What is it? Say it quickly. My roll call is about to start."

Surya hesitates, speaking softly, "Vaishu, I...I.…I want to kiss you."

Vaishali's eyes widen in shock. She stares at him, unable to believe what she has just heard. Thoughts race through her mind; what if someone sees them? Why would Surya come here and say something so bold?

"Have you lost your mind?" she whispers angrily. "If anyone sees us like this, it'll be a huge problem! Please leave, Surya."

Surya doesn't move. "I'll go, but only if you kiss me."

Vaishali clenches her fists. "You're crazy. Just leave!"

Inside the lab, the roll call is going on. "13… 14… 15…"

Vaishali's roll number is 19, and her anxiety grows as her turn approaches. She is angry, nervous, and confused all at once. Finally, in her panic, she gives in. "Fine! Kiss me quickly and leave!"

Surya's face lights up. "Really?"

"Yes! But do it fast!" she whispers harshly.

Surya moves closer, Vaishali's heart pounding in her chest. Surya leans in, holding her hands lightly. The moment is electric and fleeting.

"19...Roll number 19!"

Vaishali's eyes shoot open, and she quickly pushes Surya away. "That's my number!" she whispers and starts running toward the lab.

Surya sighs as he watches her go. "Why couldn't her roll number be 30 or 40? Just my luck," he mutters while sneaking out of the college.

Vaishali slips into the lab through the back door. Her heart is still racing as she quickly sits down at her desk. "I'm here, Miss," she says breathlessly.

Her teacher frowns. "Why didn't you respond earlier? Do I have to call you twice for attendance?"

"Sorry, Miss," Vaishali mumbles. "I was so focused on the practicals that I didn't hear you."

The rest of the day passes in a blur, but Vaishali can't stop thinking about that event. She is shocked by Surya's boldness, but a small part of her can't deny the excitement she felt.

That night, Surya can't sleep. He replays everything that happened and feels restless. Finally, he decides to see Vaishali again. This time, he goes to her house.

It's 10 pm, the wall around her house is shorter than the college wall, so he easily climbs over. He finds her bedroom window, and quietly slips inside. Just as he enters, Vaishali steps out of the washroom.

She gasps, her eyes wide with fear. She opens her mouth to scream, but Surya rushes over and gently covers her mouth. "Vaishu, it's me! Don't shout. Please calm down."

Vaishali pushes his hand away, glaring at him. "Are you crazy? First my college, and now my house? Do you have any idea how much trouble we'll be in if someone catches you? Please leave!"

Surya smiles softly. "Relax, Vaishu. I just wanted to see you again."

"You said the same thing this morning, and look what happened!" she says angrily.

Surya chuckles. "Okay, forget about that. Just tell me something; what did you feel when I tried to kiss you today?"

Vaishali looks away. "I didn't feel anything," she lies.

"Vaishu," Surya says firmly, "I know that's not true. Don't lie to me. Tell me; did you feel nervous?"

After a pause, she nods. "Yes."

"Were you feeling curious?"

"Yes."

Surya steps closer to Vaishali and softly asks, "And… did you want me to kiss you?" he asks softly.

After a long silence, Vaishali finally admits, "Yes..."

Surya smiles and moves even closer. "Close your eyes, Vaishu."

"Why?" she whispers nervously.

"Just trust me," he says.

Slowly, Vaishali closes her eyes. The world seemed to fade away around them, and all they could hear was the soft ticking of the clock. Slowly, Surya leaned in, and their lips met in the first kiss.

In that moment, all of Vaishali's nervousness melts away. She stops clenching her fists and lets herself relax. The kiss is tender and intense, and for a moment, time seems to stand still.

It's 1 minute and 9 seconds before they finally pull apart. They look into each other's eyes and share a soft smile. They were so caught up in the moment that the silence around them was only broken by the ticking of the clock.

Then, Vaishali spoke, breaking the silence. "Is this what we need in our life?"$STORY$,
  '4 min read',
  'Love',
  '12/1/2025',
  '2025-12-01 00:00:00+05:30',
  'vinayteja23@gmail.com'
),
(
  'the-mirror-maze',
  'The Mirror Maze',
  'A romantic journey through reflections, laughter, and unforgettable moments.',
  $STORY$Wow, Surya! This is incredible—it feels like we've stepped into an entirely new world. The pink background, the mirrors reflecting our sweet moments together, everything feels so magical. Getting lost in this maze is actually giving us more time to talk, laugh, and create beautiful memories. I love this, Surya—I don't ever want to leave this maze!

It's a bright and beautiful Sunday, Surya and Vaishali finally get a break from their professional lives. Today, Surya has planned something special, something Vaishali isn't expecting.

They are at a grand five-floor mall, with so many people around. Stores filled with the latest fashion, restaurants with delicious food, and a massive theater—all of it feels exciting. But neither of them knows what surprises the day holds.

As they ride the escalator to the top floor, Surya's eyes suddenly light up. A group of kids is playing in the fun zone, their laughter filling the air. The sight awakens the child within him.

"Vaishu, do you see that?" Surya asks, his excitement bubbling over.

"What?" Vaishali responds, looking around.

"There! The kids playing. Doesn't it look fun?"

She chuckles. "So? What about it?"

"What do you mean so? Come on, let's go there!"

Vaishali smiles and shakes her head. "Surya, are you a kid?"

"Is there a rule that only kids can play?" he counters sarcastically.

She sighs. "And what exactly are you planning to do there?"

"Let's go inside first, then we'll decide."

Before she can say anything, Surya holds her wrist and pulls her to the fun zone, his excitement spreading.

"Now tell me, what do you want to play?" he asks, grinning like a little boy.

Vaishali folds her arms. "Surya, are you serious?"

"For the next hour, let's forget we're adults. Just once, let the child in you take over. Trust me, this will be a beautiful memory."

She sighs dramatically. "Suryaaaaaa…."

"Please, dear? For me?" he pleads.

With an exaggerated innocent expression, she finally nods. "Okay, fine."

Surya cheers and rushes to the billing counter to buy an access card for the games. They start playing, with Surya diving into the games enthusiastically, but Vaishali finds herself growing bored. She's happy watching Surya enjoy, but this isn't really her thing.

Fifteen minutes pass, and Surya suddenly notices her lack of interest. Realizing he has been selfishly enjoying himself, he decides to take her somewhere different—somewhere peaceful and magical.

That's when he spots a glowing pink board:

"The Mirror Maze"

The soft, dreamy colors of the board instantly capture his attention. He turns to Vaishali, excitement gleaming in his eyes.

"Vaishu, look at that!" he exclaims.

She looks where he is looking. The pink glow and its mysterious charm seem interesting.

"What is this place?" she asks.

"I don't know, but it looks interesting. Let's check it out?"

Vaishali, wanting a peaceful place, nods.

Surya enters the maze first, then turns back with a playful smile, gesturing for Vaishali to go inside. She smiles and walks in.

As soon as they enter, the operator shuts the door behind them. There's only one way out now—by solving the maze.

The atmosphere is unlike anything they've experienced before. Soft pink lighting surrounds them, creating a romantic and dreamy ambiance. This isn't a terrifying, horror-movie-style maze; it's warm, enchanting, and inviting.

They take their first turn and suddenly find themselves surrounded by mirrors. Endless reflections of themselves stretch in all directions. Confusion sets in, but so does excitement.

"Wow, Surya, this is amazing! It feels like we're in a completely new world," Vaishali exclaims, her eyes sparkling.

"You like it, Vaishu?" he asks, watching her reaction.

"Hmmm. And do you know the best part?"

"What?"

"No one else is here. No one watching, no sounds—just peace."

Surya smirks. "And with this pink lighting, it almost feels like… our first night together as husband and wife."

"Ayy! Chuppp!" she scolds, nudging him playfully.

Surya gives a playful grin, his face glowing with a familiar romantic look. Vaishali knows too well. She narrows her eyes.

"My dear Surya, I know what's running through your mind. Don't get any ideas. If you come closer, I'll kick you."

He chuckles, already expecting this response. Instead of answering, he takes a step toward her and suddenly pulls her into his arms. His voice drops to a soft whisper.

"Vaishu, do you really think I'd do that?" he teases.

Before she can react, he lets go of her and walks ahead. He knows she will stand still for a few seconds, trying to understand what just happened. As expected, when he looks back, she is standing there, blinking in shock.

"What happened, darling? Seems like you're stuck. Don't you want to complete the maze?" he teases playfully.

Vaishali snaps out of her daze and walks toward him, her eyes narrowed.

"What did you just do?".

"What did I do?"

"You don't know what you did, right?"

She reaches him and starts playfully smacking his back. "Will you ever dare to put your hands on me again?" she scolds between laughs.

Surya laughs, enjoying every moment. "No, darling," he lies cheekily.

But this time, he pulls her against the mirror, blocking her escape. Trapped between him and the glass, she looks up at him, her heart racing.

"Will you ever dare to hit me again?" he asks, raising an eyebrow.

Without hesitation, she grins mischievously. "Yes, I would. What will you do, uncle?"

Surya sighs dramatically. "What will I do? Nothing." He steps back, releasing her from his playful trap.

Still lost in the moment, he puts an arm around her shoulder as they walk through the maze. With every turn, their reflections appear everywhere, showing their laughter, teasing, and stolen looks.

The maze becomes more challenging as they progress. The mirrors play tricks on them, creating illusions of endless pathways. It seems like they'll be here for at least another thirty minutes.

Pausing to figure out their next move, Vaishali suddenly notices something.

"Surya, look at that."

"What?"

She points to their reflection. The way they stand—his arm on her shoulder, their faces close—looks like a perfect romantic portrait.

"Isn't that beautiful?" she asks softly.

Surya smirks. "Yes, the mirror is very beautiful."

"Stop joking! Look at us. We look so… romantic."

He grins. "Do you want to do something romantic too?"

"Ayyy, chuppp…."

He chuckles. "Hmmm. I'm chuppp…."

Vaishali turns to him, a thoughtful look in her eyes. "Surya, if we were stuck in this maze for five days, just the two of us, what would you do?"

His smile widens. "I'd be very happy."

"Why?"

"Because I'd have the chance to create 99 romantic moments with you."

She bursts into laughter. "Cheee, Surya! You're impossible."

"What happened?" he asks.

"Do you ever think of anything other than romance?"

Surya smirks. "Tell me, why shouldn't I?"

"I know, only people like you think that way. No other work except romance!

"You're mistaken, darling. Tell me, what do you think romance means?"

"I know what romance is, sir. Everything we've done so far is romance."

"True, but romance isn't just that. Loving conversations can be romantic too."

"So, if we were stuck here, you'd just talk to me?"

"I love the kind of romance where we simply be together and share moments. It could be anything—you holding my hand for support, me kissing or hugging you, you resting on my shoulder, me wrapping my arm around you, or even just a five-minute chat remembering about old memories. Aren't all of these romantic?"

"Maybe… maybe not…"

"Vaishu, listen. You decide what makes a moment romantic. If you believe it's romantic, then it is. If you don't, then it isn't."

She rolls her eyes. "And what's with that number—99?"

"I just said it to make it special."

Vaishali shakes her head. "Ahhh…, I should kick you." and she smiles.

Something about Surya's words stays with her. She has always believed romance was just about kisses and hugs, but now she sees it differently. Romance is in the stolen looks, in the teasing, in the laughter.

Looking into Surya's eyes, she asks, "Surya, is there any consequence of being too romantic?"$STORY$,
  '5 min read',
  'Romance',
  '3/30/2025',
  '2025-03-30 00:00:00+05:30',
  'vinayteja23@gmail.com'
),
(
  'i-want-to-be-happy',
  'I Want To Be Happy',
  'A deeply emotional conversation about love, happiness, and the truth behind human emotions.',
  $STORY$The sun was setting, filling the sky with a warm, golden glow. Surya and Vaishali stood on the terrace of her apartment, five floors above the ground. From up there, it felt like they were on top of a mountain, looking at the vast horizon. A cool breeze blew around them, making the evening even more peaceful. The soft sunlight touched Surya's face, making him look calm and relaxed. Vaishali, however, felt a little uneasy because of the height. But as long as Surya was with her, she knew she would be fine.

Both of them had a long and tiring day. Vaishali had been busy with work, while Surya had just finished his music practice. They decided to meet and spend some time together. They wanted to relax, talk, and make some memories. But today, something felt different. Vaishali's mind was filled with thoughts, and once again, the reason was Surya.

Surya had arrived at Vaishali's home around 5:15 PM. He had a small conversation with her father, who even offered him some snacks. After a while, her father went inside to take a phone call. That's when Surya turned to Vaishali and said,

"Vaishu, can we go up to the terrace? I want to spend some time with you."

Vaishali smiled and said, "Okay, let's go."

They took the lift, which was empty. As soon as the doors closed, Surya leaned his head on Vaishali's shoulder and sighed.

"I'm so tired, Vaishu…" he murmured.

Vaishali smiled and teased him, "Congratulations, darling! You have the best girlfriend who lets you rest on her shoulder."

Surya smiled but didn't move.

When they reached the terrace, the view was breathtaking. Far away, the mountains stood tall, and the sky was filled with a soft orange colour as the sun slowly went down. A cool breeze blew around them, and they could hear birds chirping. Surya's tiredness disappeared as he took in the beauty of the moment. He always loved being in places like this. Vaishali, on the other hand, felt nervous because of the height, but she knew she would be fine as long as Surya was with her.

Surya held her hand and led her to a cemented block near the water tank. They sat down, enjoying the peaceful evening. After a few minutes of silence, Vaishali finally spoke.

"Surya, I've never asked you this question before. We've known each other for more than seven years."

Surya turned to her with curiosity. "A question after seven years? Now I'm interested. What is it?"

Vaishali hesitated before speaking. "It's not something I've been waiting to ask. But today, I just feel like knowing."

"Go ahead, Vaishu. Ask me."

She took a deep breath. "Ummm! Who do you love the most in this world?"

Vaishali expected Surya to say her name without thinking. But his answer surprised her.

"Can I lie to you?" he asked with a playful smile.

Vaishali laughed. "Of course. Go ahead, sir."

"Then it's you," Surya said.

Vaishali smiled at first but then realized something. "Wait… so does that mean I'm not the most important person to you?"

"You are important, but there's someone I love even more."

She frowned. "Who?"

"Myself."

She looked at him and sarcastically said, "Shuuuu..."

"Yes," Surya said calmly. "And I can prove it."

Vaishali raised an eyebrow, accepting his challenge. "Alright, let's see if you can prove that you love yourself more than you love me."

Surya was a deep thinker, always learning from the people around him. And now, he was about to explain one of his beliefs to Vaishali.

He looked into her eyes and held her hand.

"Vaishu, tell me… why do you talk to me?"

Vaishali was confused by the question. "To talk to you, obviously. What kind of question is that?"

"Not just that. Tell me the real reason why you talk to me."

She thought for a moment. "Because I feel better when I talk to you. If I'm stressed or sad, you make me happy."

Surya nodded. "So you call me because I make you happy. You are looking for happiness when you are with me."

Vaishali agreed. "Yes, I suppose so."

"Now imagine this," Surya said. "What if I decide to leave you and be with someone else?"

Vaishali gasped dramatically. "Surya! You would do that to me?" she teased.

"Just imagine," Surya laughed. "What would you do?"

Vaishali's smile faded. "I'd be heartbroken. I'd cry. I'd beg you not to leave me. I wouldn't know what to do."

"Why would you be heartbroken?"

"Because I love you, Surya. I feel connected to you. If you left, I would lose my happiness. I would feel empty."

Surya nodded again. "So, you would be sad because your happiness would be gone. You wouldn't actually be sad about me leaving—you'd be sad about how it affects you."

Vaishali frowned and sank into deep thought. Why is Surya asking me these questions? And why is he answering them himself? What is he trying to prove?

As time passed, the sun began to set behind the mountains, painting the sky in warm hues. The breathtaking view momentarily distracted Vaishali. With excitement, she turned to Surya and said, "Surya, let's take a selfie here! Isn't it amazing?"

Surya looked at her, smiled, and nodded. Vaishali moved closer to him, wrapping her arms around him in a gentle hug. With the golden sunset and majestic mountains in the backdrop, she captured the moment on her phone.

Seeing the photo, Vaishali's face lit up with happiness and excitement. Surya then turned to her and asked...

"Just now, you took a selfie with me. Why?"

She smiled. "Because it's a memory. Whenever I see it, I'll feel happy."

Surya leaned in slightly. "Again, you're thinking about your happiness."

Vaishali sighed, feeling a little irritated. "Surya, are you going to answer my question or just keep asking me more?"

Surya laughed. "Vaishu, I was just collecting some inputs for my answer."

She rolled her eyes. "Congratulations sir, for successfully investigating, now just tell me."

"Did you notice anything common in your answers?" he asked.

She shook her head.

"In every answer, the main person was you. You talk to me because you feel happy. You don't want me to leave because you don't want to feel sad. You take pictures to keep memories that make you happy. Everything is about your feelings. You aren't really thinking about me—you're thinking about yourself. And that's normal. We all love ourselves more than anyone else."

Vaishali didn't know what to say. She had never thought about love this way before. After a few moments, she quietly stood up and walked toward the lift. The sun had set, and the wind was blowing stronger now.

Just as she reached the lift, she stopped, turned around, and looked at Surya.

"If there was a situation where only one of us could live… I would choose you. I would close my eyes and leave this world, just so you could stay. Would that still mean I love myself more than you?"$STORY$,
  '5 min read',
  'Love',
  '12/2/2025',
  '2025-12-02 00:00:00+05:30',
  'vinayteja23@gmail.com'
)
on conflict (slug) do nothing;

-- ─── 1 book ────────────────────────────────────────────────────────────
insert into dilse.books
  (slug, title, description, body_md, date_display, genre, cover_url, buying_link, published_at, author_email)
values (
  'aksharaala-nuvve',
  'Aksharaala Nuvve (అక్షరాలా నువ్వే)',
  'A Telugu novel about love and sacrifice.',
  $BOOK$Through the journey of Chaitanya and Nidharshana, the book explores what happens when love is chosen over ego, understanding over anger, and sacrifice over selfishness.$BOOK$,
  '19 December 2025',
  'Novel',
  '/aksharaala-nuvve.jpg',
  null,
  '2025-12-19 00:00:00+05:30',
  'vinayteja23@gmail.com'
)
on conflict (slug) do nothing;
