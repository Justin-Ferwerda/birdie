/**
 * The 18 social rules of Birdie for Shurdy 2026.
 *
 * Each rule is data: a key, display strings, a shape (which drives the UI
 * picker behavior), one-time-use flag, optional photo / par-3 constraints,
 * and three pure functions:
 *
 *   computeDelta(outcome)  — score modifier this rule applies
 *   eligible(ctx)          — can the rule be activated in this context?
 *   notificationText(...)  — feed / toast text after activation
 *
 * Phase 5: data + types + tests only. Phase 6+ wires the picker.
 */

export type RuleShape =
  | 'self_modifier'
  | 'conditional_modifier'
  | 'multi_player'
  | 'whole_card'
  | 'cross_card_target'
  | 'pre_declared'
  | 'tournament_event'
  | 'flag_only';

/**
 * What the UI passes to computeDelta. Fields are optional because they
 * only apply to certain rule shapes — the rule itself knows what it needs.
 */
export interface RuleOutcome {
  /** Raw strokes the player took on this hole. */
  strokes?: number;
  /** Hole par. */
  par?: number;
  /** Explicit success flag (trust_fall putt made, marshmallow held). */
  success?: boolean;
  /** Shotgun: was this player the fastest finisher? */
  isFastest?: boolean;
  /** Whole-card rules: scores-to-par for every player on the card. */
  cardScoresToPar?: number[];
}

export interface EligibilityContext {
  hole: {
    par: number;
    course_id: string;
    hole_number: number;
  };
  /** Rule keys this player has already used in the tournament. */
  usedRuleKeys: Set<string>;
  /** If a rule was already applied on this hole for this player, its key. */
  ruleAppliedThisHole?: string;
  /** Where in the lifecycle: pre-hole declaration or post-hole score entry. */
  phase: 'declare' | 'score_entry';
}

/** Subset of the activity_events / rule_activations row used by notificationText. */
export interface RuleActivationLike {
  rule_key: string;
  primary_player_number: number;
  target_player_number?: number | null;
  partner_player_numbers?: number[] | null;
  card_number?: number | null;
  hole_id?: string | null;
  outcome?: Record<string, unknown> | null;
  delta_applied?: number | null;
}

export interface PlayerLike {
  player_number: number;
  display_name: string;
}

export interface Rule {
  key: string;
  displayName: string;
  description: string;
  emoji: string;
  shape: RuleShape;
  requiresPhoto?: boolean;
  parThreeOnly?: boolean;
  oneTimePerPlayer: boolean;
  computeDelta: (outcome: RuleOutcome) => number;
  eligible: (ctx: EligibilityContext) => boolean;
  notificationText: (activation: RuleActivationLike, players: PlayerLike[]) => string;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const toPar = (o: RuleOutcome): number => {
  if (o.strokes == null || o.par == null) return 0;
  return o.strokes - o.par;
};

const nameOf = (n: number | null | undefined, players: PlayerLike[]): string => {
  if (n == null) return 'someone';
  return players.find((p) => p.player_number === n)?.display_name ?? `Player ${n}`;
};

const partnerNames = (
  partners: number[] | null | undefined,
  players: PlayerLike[],
): string => {
  if (!partners || partners.length === 0) return '';
  return partners.map((n) => nameOf(n, players)).join(' & ');
};

/**
 * defineRule wraps every rule with the standard eligibility checks
 * (oneTimePerPlayer, parThreeOnly, ruleAppliedThisHole, pre-declared phase
 * gating). Each rule can layer extra checks via customEligible.
 */
interface RuleSpec extends Omit<Rule, 'eligible'> {
  customEligible?: (ctx: EligibilityContext) => boolean;
}

function defineRule(spec: RuleSpec): Rule {
  const { customEligible, ...rest } = spec;
  return {
    ...rest,
    eligible: (ctx) => {
      if (spec.oneTimePerPlayer && ctx.usedRuleKeys.has(spec.key)) return false;
      if (spec.parThreeOnly && ctx.hole.par !== 3) return false;
      if (ctx.ruleAppliedThisHole && ctx.ruleAppliedThisHole !== spec.key) {
        return false;
      }
      // Pre-declared rules can only be picked during the declare phase.
      // Everything else is picked during score entry. (Pre-declared rules
      // are reconciled at score entry by the UI, not by re-running eligible.)
      if (spec.shape === 'pre_declared' && ctx.phase !== 'declare') return false;
      if (spec.shape !== 'pre_declared' && ctx.phase === 'declare') return false;
      return customEligible ? customEligible(ctx) : true;
    },
  };
}

// --------------------------------------------------------------------------
// The 18 rules
// --------------------------------------------------------------------------

export const RULES: Rule[] = [
  // 1
  defineRule({
    key: 'the_shotgun',
    displayName: 'The Shotgun',
    description:
      'Mid-round at Crockett: all participants race to finish a beer. Fastest gets the biggest boost.',
    emoji: '🍺',
    shape: 'tournament_event',
    oneTimePerPlayer: true,
    computeDelta: (o) => (o.isFastest ? -3 : -1),
    // Fired from a dedicated screen, never from score entry's rule picker.
    customEligible: () => false,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} survived The Shotgun (${
        a.delta_applied ?? 0
      })`,
  }),

  // 2
  defineRule({
    key: 'the_caddie_shack',
    displayName: 'The Caddie Shack',
    description: 'Pick a partner from your card. If you both score par or better, both get –1.',
    emoji: '🎒',
    shape: 'multi_player',
    oneTimePerPlayer: true,
    computeDelta: (o) => (toPar(o) <= 0 ? -1 : 0),
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} ran The Caddie Shack with ${partnerNames(
        a.partner_player_numbers,
        players,
      )}`,
  }),

  // 3
  defineRule({
    key: 'putter_sabotage',
    displayName: 'Putter Sabotage',
    description: 'Pick a player on another card. They must putter-only the next par 3.',
    emoji: '🎯',
    shape: 'cross_card_target',
    parThreeOnly: true,
    oneTimePerPlayer: true,
    computeDelta: () => 0,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} sabotaged ${nameOf(
        a.target_player_number,
        players,
      )} — putter only`,
  }),

  // 4
  defineRule({
    key: 'the_dui',
    displayName: 'The DUI',
    description: 'Take a designated shot from the tee. Par or better → –2; worse → 0.',
    emoji: '🍻',
    shape: 'conditional_modifier',
    oneTimePerPlayer: true,
    computeDelta: (o) => (toPar(o) <= 0 ? -2 : 0),
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} survived The DUI`,
  }),

  // 5
  defineRule({
    key: 'baja_blast',
    displayName: 'Baja Blast',
    description: 'At lunch at Baja Burrito: down a Baja Blast. Earns you –2 on any hole.',
    emoji: '🥤',
    shape: 'tournament_event',
    requiresPhoto: true,
    oneTimePerPlayer: true,
    computeDelta: () => -2,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} cashed in their Baja Blast`,
  }),

  // 6
  defineRule({
    key: 'birdie_for_shurdy',
    displayName: 'Birdie for Shurdy',
    description: 'Announce before any drives. Earns first-throw honors next hole.',
    emoji: '🐦',
    shape: 'pre_declared',
    oneTimePerPlayer: true,
    computeDelta: () => 0,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} called Birdie for Shurdy`,
  }),

  // 7
  defineRule({
    key: 'the_gentlemens_tee',
    displayName: "The Gentlemen's Tee",
    description:
      'Whole card commits to standstill throws. If everyone scores bogey or better, all get –1.',
    emoji: '🎩',
    shape: 'whole_card',
    oneTimePerPlayer: true,
    computeDelta: (o) => {
      if (!o.cardScoresToPar?.length) return 0;
      return o.cardScoresToPar.every((s) => s <= 1) ? -1 : 0;
    },
    notificationText: (a, _players) =>
      `Card ${a.card_number ?? '?'} pulled off The Gentlemen's Tee`,
  }),

  // 8
  defineRule({
    key: 'the_classic',
    displayName: 'The Classic',
    description:
      "Required on Seven Oaks H6. Clear the amateur pad. Fail → pants down for the next throw.",
    emoji: '👖',
    shape: 'flag_only',
    oneTimePerPlayer: true,
    computeDelta: () => 0,
    customEligible: (ctx) =>
      ctx.hole.course_id === 'seven_oaks' && ctx.hole.hole_number === 6,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} faced The Classic`,
  }),

  // 9
  defineRule({
    key: 'the_marshmallow',
    displayName: 'The Marshmallow',
    description:
      'Hold a marshmallow in your mouth, no chewing, the whole hole. Success → –1.',
    emoji: '🟪',
    shape: 'self_modifier',
    requiresPhoto: true,
    oneTimePerPlayer: true,
    computeDelta: (o) => (o.success ? -1 : 0),
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} ${
        (a.outcome as { success?: boolean } | null)?.success ? 'held' : 'failed'
      } The Marshmallow`,
  }),

  // 10
  defineRule({
    key: 'scramble_up',
    displayName: 'Scramble Up',
    description:
      'Pick a card partner. You both throw every shot from the best lie. Announce before driving.',
    emoji: '🔀',
    shape: 'multi_player',
    oneTimePerPlayer: true,
    computeDelta: () => 0,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} scrambled with ${partnerNames(
        a.partner_player_numbers,
        players,
      )}`,
  }),

  // 11
  defineRule({
    key: 'the_cheap_ass',
    displayName: 'The Cheap Ass',
    description: 'Bum a cigarette from a stranger. Photo required. Earns –1.',
    emoji: '🚬',
    shape: 'self_modifier',
    requiresPhoto: true,
    oneTimePerPlayer: true,
    computeDelta: () => -1,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} pulled The Cheap Ass`,
  }),

  // 12
  defineRule({
    key: 'blind_mulligan',
    displayName: 'Blind Mulligan',
    description: 'Re-throw any shot with your eyes closed. No score penalty.',
    emoji: '🙈',
    shape: 'self_modifier',
    oneTimePerPlayer: true,
    computeDelta: () => 0,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} took a Blind Mulligan`,
  }),

  // 13
  defineRule({
    key: 'going_steady',
    displayName: 'Going Steady',
    description: 'Hold hands with a partner the entire hole, including throws. Both get –3.',
    emoji: '🤝',
    shape: 'multi_player',
    oneTimePerPlayer: true,
    computeDelta: () => -3,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} went steady with ${partnerNames(
        a.partner_player_numbers,
        players,
      )}`,
  }),

  // 14
  defineRule({
    key: 'full_moon',
    displayName: 'Full Moon',
    description: 'Moon another card. Photo required. Earns –1.',
    emoji: '🌝',
    shape: 'self_modifier',
    requiresPhoto: true,
    oneTimePerPlayer: true,
    computeDelta: () => -1,
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} dropped a Full Moon`,
  }),

  // 15
  defineRule({
    key: 'the_trust_fall',
    displayName: 'The Trust Fall',
    description: 'Blindfolded putt from 5+ yards. Make it → –2.',
    emoji: '🙏',
    shape: 'conditional_modifier',
    oneTimePerPlayer: true,
    computeDelta: (o) => (o.success ? -2 : 0),
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} ${
        (a.outcome as { success?: boolean } | null)?.success ? 'sank' : 'missed'
      } The Trust Fall`,
  }),

  // 16
  defineRule({
    key: 'let_the_record_show',
    displayName: 'Let the Record Show',
    description: 'Call your shot from 10+ yards. Make it → –1. Miss → +1.',
    emoji: '📣',
    shape: 'conditional_modifier',
    oneTimePerPlayer: true,
    computeDelta: (o) => (o.success ? -1 : 1),
    notificationText: (a, players) => {
      const made = (a.outcome as { success?: boolean } | null)?.success;
      return `${nameOf(a.primary_player_number, players)} ${
        made ? 'called it and made it' : 'called it and missed'
      }`;
    },
  }),

  // 17
  defineRule({
    key: 'opposite_hand',
    displayName: 'Opposite Hand',
    description:
      'Throw the whole hole with your non-dominant hand. Bogey or better → –2.',
    emoji: '🪞',
    shape: 'conditional_modifier',
    oneTimePerPlayer: true,
    computeDelta: (o) => (toPar(o) <= 1 ? -2 : 0),
    notificationText: (a, players) =>
      `${nameOf(a.primary_player_number, players)} went Opposite Hand`,
  }),

  // 18
  defineRule({
    key: 'play_through_parade',
    displayName: 'The Play-through Parade',
    description:
      'Non-tournament player walks through your hole and you let them play through. Whole card –1.',
    emoji: '🎺',
    shape: 'whole_card',
    requiresPhoto: true,
    // Capped at once per card by the spec, not per player. The UI enforces
    // the per-card cap; the rule itself stays one-time per player.
    oneTimePerPlayer: true,
    computeDelta: () => -1,
    notificationText: (a, _players) =>
      `Card ${a.card_number ?? '?'} ran the Play-through Parade`,
  }),
];

// --------------------------------------------------------------------------
// Lookups
// --------------------------------------------------------------------------

export const RULE_BY_KEY: Map<string, Rule> = new Map(RULES.map((r) => [r.key, r]));

export function getRule(key: string): Rule | undefined {
  return RULE_BY_KEY.get(key);
}
