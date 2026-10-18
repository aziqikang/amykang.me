import { CABO_PENALTY, KAMIKAZE_PENALTY, LIMIT } from '@/features/cabo/engine'
import styles from './Cabo.module.css'

/** The house rules, written out so nobody has to argue about them. */
export function Rules() {
  return (
    <div className={styles.rules}>
      <section>
        <h3>the aim</h3>
        <p>
          Finish each round holding the lowest total. Your four cards sit face down in front of
          you, and at the start of a round you get to peek at just two of them — the rest is
          memory, nerve and a little sabotage.
        </p>
      </section>

      <section>
        <h3>card values</h3>
        <ul className={styles.values}>
          <li><b>red K</b> −1</li>
          <li><b>A</b> 1</li>
          <li><b>2–10</b> face value</li>
          <li><b>J</b> 11</li>
          <li><b>Q</b> 12</li>
          <li><b>black K</b> 13</li>
        </ul>
      </section>

      <section>
        <h3>your turn</h3>
        <p>Do one of these:</p>
        <ul className={styles.bullets}>
          <li>
            <b>Draw from the deck.</b> Swap it in for one of your cards (the old one goes face up
            on the discard pile), or discard it. A discarded power card can be used.
          </li>
          <li>
            <b>Take the top discard.</b> It has to be swapped in for one of yours.
          </li>
          <li>
            <b>Call Cabo</b> instead of drawing, if you think you are lowest.
          </li>
        </ul>
        <p>
          You can also swap the drawn card in for <em>several</em> of your cards at once, if they
          are all the same value. Get it wrong and the cards stay where they were, shown to
          everyone, and the drawn card joins your hand as a penalty.
        </p>
      </section>

      <section>
        <h3>powers</h3>
        <ul className={styles.values}>
          <li><b>7 · 8</b> peek at one of your cards</li>
          <li><b>9 · 10</b> spy on someone else’s card</li>
          <li><b>J · Q</b> blind swap one of yours with one of theirs</li>
          <li><b>black K</b> look at one of yours and one of theirs, then swap or not</li>
        </ul>
        <p>Powers only work when the card is drawn from the deck and discarded straight away.</p>
      </section>

      <section>
        <h3>stacking</h3>
        <p>
          At any time during play — even on someone else’s turn — you can throw a card onto the
          discard pile if it matches the top card’s rank. It can be one of yours or anyone
          else’s.
        </p>
        <ul className={styles.bullets}>
          <li>Your own card: it’s gone, and your hand is one card lighter.</li>
          <li>Someone else’s card: you give them one of your cards to fill the gap.</li>
          <li>
            Wrong card: it’s shown to everyone and goes back, and you take a penalty card from the
            deck.
          </li>
        </ul>
        <p>The Cabo caller’s cards can’t be stacked, and the caller can’t stack.</p>
      </section>

      <section>
        <h3>calling cabo</h3>
        <p>
          Everyone else gets one last turn, and the caller’s cards are locked — nobody can spy on
          or swap them. Then all hands are turned over.
        </p>
      </section>

      <section>
        <h3>scoring</h3>
        <ul className={styles.bullets}>
          <li>The lowest hand scores 0; everyone else scores their total.</li>
          <li>
            If the caller is not the lowest (ties go to the caller), they score their total
            +{CABO_PENALTY}.
          </li>
          <li>
            Kamikaze: finish with exactly Q Q K K (black kings) and everyone else takes{' '}
            {KAMIKAZE_PENALTY}.
          </li>
          <li>
            Landing on exactly {LIMIT} drops you to {LIMIT / 2}. Once anyone passes {LIMIT}, the
            game ends and the lowest score wins.
          </li>
        </ul>
      </section>
    </div>
  )
}
