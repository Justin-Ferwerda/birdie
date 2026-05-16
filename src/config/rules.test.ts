import { describe, expect, it } from 'vitest';
import {
  RULES,
  getRule,
  type EligibilityContext,
  type Rule,
  type RuleOutcome,
} from './rules';

const baseHole = { par: 3, course_id: 'crockett', hole_number: 5 };

function ctx(over: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    hole: baseHole,
    usedRuleKeys: new Set(),
    phase: 'score_entry',
    ...over,
  };
}

function rule(key: string): Rule {
  const r = getRule(key);
  if (!r) throw new Error(`No such rule: ${key}`);
  return r;
}

const outcome = (o: RuleOutcome = {}) => o;

// --------------------------------------------------------------------------
// Catalogue invariants
// --------------------------------------------------------------------------

describe('rule catalogue', () => {
  it('has exactly 18 rules', () => {
    expect(RULES).toHaveLength(18);
  });

  it('has unique keys', () => {
    const keys = RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has every key resolvable via getRule', () => {
    for (const r of RULES) {
      expect(getRule(r.key)?.key).toBe(r.key);
    }
  });

  it('returns undefined for an unknown key', () => {
    expect(getRule('not_a_rule')).toBeUndefined();
  });
});

// --------------------------------------------------------------------------
// computeDelta
// --------------------------------------------------------------------------

describe('computeDelta', () => {
  it('the_shotgun: -1 participant, -3 fastest', () => {
    const r = rule('the_shotgun');
    expect(r.computeDelta(outcome({ isFastest: false }))).toBe(-1);
    expect(r.computeDelta(outcome({ isFastest: true }))).toBe(-3);
    expect(r.computeDelta(outcome())).toBe(-1);
  });

  it('the_caddie_shack: -1 only if (primary) par or better', () => {
    const r = rule('the_caddie_shack');
    expect(r.computeDelta(outcome({ strokes: 3, par: 3 }))).toBe(-1); // par
    expect(r.computeDelta(outcome({ strokes: 2, par: 3 }))).toBe(-1); // birdie
    expect(r.computeDelta(outcome({ strokes: 4, par: 3 }))).toBe(0); // bogey
  });

  it('the_caddie_shack: partnerDeltaSource is "primary" (partner inherits)', () => {
    const r = rule('the_caddie_shack');
    expect(r.partnerDeltaSource).toBe('primary');
  });

  it('going_steady: partnerDeltaSource is default ("self"-equivalent — flat -3 either way)', () => {
    const r = rule('going_steady');
    expect(r.partnerDeltaSource).toBeUndefined();
  });

  it('putter_sabotage: always 0 (constraint, not modifier)', () => {
    expect(rule('putter_sabotage').computeDelta(outcome())).toBe(0);
  });

  it('the_dui: -2 if par or better, else 0', () => {
    const r = rule('the_dui');
    expect(r.computeDelta(outcome({ strokes: 3, par: 3 }))).toBe(-2);
    expect(r.computeDelta(outcome({ strokes: 1, par: 3 }))).toBe(-2);
    expect(r.computeDelta(outcome({ strokes: 5, par: 3 }))).toBe(0);
  });

  it('baja_blast: flat -2', () => {
    expect(rule('baja_blast').computeDelta(outcome())).toBe(-2);
  });

  it('birdie_for_shurdy: 0 (positional only)', () => {
    expect(rule('birdie_for_shurdy').computeDelta(outcome())).toBe(0);
  });

  it("the_gentlemens_tee: -1 only if every card score is bogey-or-better", () => {
    const r = rule('the_gentlemens_tee');
    expect(r.computeDelta(outcome({ cardScoresToPar: [0, -1, 1, 0] }))).toBe(-1);
    expect(r.computeDelta(outcome({ cardScoresToPar: [0, 0, 2, 0] }))).toBe(0);
    expect(r.computeDelta(outcome({ cardScoresToPar: [] }))).toBe(0);
    expect(r.computeDelta(outcome())).toBe(0);
  });

  it('the_classic: 0 (flag only)', () => {
    expect(rule('the_classic').computeDelta(outcome())).toBe(0);
  });

  it('the_marshmallow: -1 if success', () => {
    const r = rule('the_marshmallow');
    expect(r.computeDelta(outcome({ success: true }))).toBe(-1);
    expect(r.computeDelta(outcome({ success: false }))).toBe(0);
  });

  it('scramble_up: 0', () => {
    expect(rule('scramble_up').computeDelta(outcome())).toBe(0);
  });

  it('the_cheap_ass: flat -1', () => {
    expect(rule('the_cheap_ass').computeDelta(outcome())).toBe(-1);
  });

  it('blind_mulligan: 0', () => {
    expect(rule('blind_mulligan').computeDelta(outcome())).toBe(0);
  });

  it('going_steady: flat -3', () => {
    expect(rule('going_steady').computeDelta(outcome())).toBe(-3);
  });

  it('full_moon: flat -1', () => {
    expect(rule('full_moon').computeDelta(outcome())).toBe(-1);
  });

  it('the_trust_fall: -2 if success, else 0', () => {
    const r = rule('the_trust_fall');
    expect(r.computeDelta(outcome({ success: true }))).toBe(-2);
    expect(r.computeDelta(outcome({ success: false }))).toBe(0);
  });

  it('let_the_record_show: -1 if made, +1 if missed', () => {
    const r = rule('let_the_record_show');
    expect(r.computeDelta(outcome({ success: true }))).toBe(-1);
    expect(r.computeDelta(outcome({ success: false }))).toBe(1);
  });

  it('opposite_hand: -2 if bogey-or-better, else 0', () => {
    const r = rule('opposite_hand');
    expect(r.computeDelta(outcome({ strokes: 3, par: 3 }))).toBe(-2); // par
    expect(r.computeDelta(outcome({ strokes: 4, par: 3 }))).toBe(-2); // bogey
    expect(r.computeDelta(outcome({ strokes: 5, par: 3 }))).toBe(0); // double
  });

  it('play_through_parade: -1 when activated', () => {
    expect(rule('play_through_parade').computeDelta(outcome())).toBe(-1);
  });
});

// --------------------------------------------------------------------------
// eligible — common gates
// --------------------------------------------------------------------------

describe('eligible — common gates', () => {
  it('rejects when the rule has already been used by this player', () => {
    const r = rule('the_marshmallow');
    expect(r.eligible(ctx({ usedRuleKeys: new Set(['the_marshmallow']) }))).toBe(false);
  });

  it('rejects when another rule is already applied on this hole', () => {
    const r = rule('the_marshmallow');
    expect(r.eligible(ctx({ ruleAppliedThisHole: 'the_dui' }))).toBe(false);
  });

  it('accepts when this same rule is already the one applied on this hole', () => {
    // Editing a score keeps the same rule selected; eligibility shouldn't drop it.
    const r = rule('the_marshmallow');
    expect(r.eligible(ctx({ ruleAppliedThisHole: 'the_marshmallow' }))).toBe(true);
  });

  it('rejects par-3-only rules on a par-4 hole', () => {
    const r = rule('putter_sabotage');
    expect(
      r.eligible(ctx({ hole: { ...baseHole, par: 4 }, phase: 'declare' })),
    ).toBe(false);
  });

  it('accepts par-3-only rules on a par-3 hole (declare phase)', () => {
    expect(rule('putter_sabotage').eligible(ctx({ phase: 'declare' }))).toBe(true);
  });

  it('rejects putter_sabotage at score entry (mustDeclare)', () => {
    expect(rule('putter_sabotage').eligible(ctx())).toBe(false);
  });
});

// --------------------------------------------------------------------------
// eligible — phase gating
// --------------------------------------------------------------------------

describe('eligible — phase gating', () => {
  it('birdie_for_shurdy (pre_declared) is eligible only in declare phase', () => {
    const r = rule('birdie_for_shurdy');
    expect(r.eligible(ctx({ phase: 'declare' }))).toBe(true);
    expect(r.eligible(ctx({ phase: 'score_entry' }))).toBe(false);
  });

  it('non-pre-declared rules are not eligible in the declare phase', () => {
    expect(rule('the_marshmallow').eligible(ctx({ phase: 'declare' }))).toBe(false);
  });

  it('scramble_up (mustDeclare multi_player) is eligible only in declare phase', () => {
    const r = rule('scramble_up');
    expect(r.eligible(ctx({ phase: 'declare' }))).toBe(true);
    expect(r.eligible(ctx({ phase: 'score_entry' }))).toBe(false);
  });

  it('the_gentlemens_tee (mustDeclare whole_card) is eligible only in declare phase', () => {
    const r = rule('the_gentlemens_tee');
    expect(r.eligible(ctx({ phase: 'declare' }))).toBe(true);
    expect(r.eligible(ctx({ phase: 'score_entry' }))).toBe(false);
  });
});

// --------------------------------------------------------------------------
// eligible — rule-specific
// --------------------------------------------------------------------------

describe('eligible — rule-specific', () => {
  it('the_classic is only eligible on Seven Oaks H6', () => {
    const r = rule('the_classic');
    expect(
      r.eligible(ctx({ hole: { par: 4, course_id: 'seven_oaks', hole_number: 6 } })),
    ).toBe(true);
    expect(
      r.eligible(ctx({ hole: { par: 4, course_id: 'seven_oaks', hole_number: 7 } })),
    ).toBe(false);
    expect(
      r.eligible(ctx({ hole: { par: 4, course_id: 'crockett', hole_number: 6 } })),
    ).toBe(false);
  });

  it('the_shotgun is never eligible from the regular rule picker', () => {
    // Fires from its own dedicated screen, not score entry.
    const r = rule('the_shotgun');
    expect(r.eligible(ctx())).toBe(false);
    expect(r.eligible(ctx({ phase: 'declare' }))).toBe(false);
  });
});

// --------------------------------------------------------------------------
// notificationText
// --------------------------------------------------------------------------

describe('notificationText', () => {
  const players = [
    { player_number: 1, display_name: 'Justin' },
    { player_number: 2, display_name: 'Mike' },
    { player_number: 3, display_name: 'Carl' },
  ];

  it('includes the player name', () => {
    const r = rule('the_marshmallow');
    const text = r.notificationText(
      {
        rule_key: 'the_marshmallow',
        primary_player_number: 1,
        outcome: { success: true },
      },
      players,
    );
    expect(text).toMatch(/Justin/);
    expect(text).toMatch(/held/i);
  });

  it('includes partner names for multi_player rules', () => {
    const r = rule('going_steady');
    const text = r.notificationText(
      {
        rule_key: 'going_steady',
        primary_player_number: 1,
        partner_player_numbers: [2],
      },
      players,
    );
    expect(text).toMatch(/Justin/);
    expect(text).toMatch(/Mike/);
  });

  it('includes the target name for cross-card rules', () => {
    const r = rule('putter_sabotage');
    const text = r.notificationText(
      {
        rule_key: 'putter_sabotage',
        primary_player_number: 1,
        target_player_number: 3,
      },
      players,
    );
    expect(text).toMatch(/Justin/);
    expect(text).toMatch(/Carl/);
  });
});
