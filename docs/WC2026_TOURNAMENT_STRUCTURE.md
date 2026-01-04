# FIFA World Cup 2026 - Tournament Structure

## Overview
- **Total Teams**: 48
- **Format**: Group Stage → Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Final
- **Total Matches**: 104 (48 group + 56 knockout)

## Phase 1: Group Stage (48 matches)

### Groups
- **12 groups** (A through L)
- **4 teams per group**
- **3 matches per team** (round-robin)
- **6 matches per group**
- **Total**: 72 matches

### Advancement Rules
From each group:
- **1st place**: Advances (12 teams)
- **2nd place**: Advances (12 teams)
- **Best 8 third-place teams**: Advance (8 teams)
- **Total qualified**: 32 teams

### Third-Place Ranking Criteria (FIFA Official)
1. Points
2. Goal difference
3. Goals scored
4. Fair play points (yellow/red cards)
5. Drawing of lots (if still tied)

## Phase 2: Round of 32 (16 matches)

### Bracket Structure (Official FIFA 2026)

**Upper Half (Matches 1-8)**:
1. Winner A vs 3rd C/D/E/F
2. Winner C vs 3rd A/B/G/H
3. Winner E vs 3rd A/B/C/D
4. Winner G vs 3rd E/F/G/H
5. Winner B vs 3rd A/D/E/F
6. Winner D vs 3rd B/C/G/H
7. Winner F vs 3rd A/B/C/D
8. Winner H vs 3rd E/F/G/H

**Lower Half (Matches 9-16)**:
9. Winner I vs 3rd J/K/L
10. Winner K vs 3rd I/J/K/L
11. Winner J vs 3rd I/K/L
12. Winner L vs 3rd I/J/K
13. Runner-up A vs Runner-up B
14. Runner-up C vs Runner-up D
15. Runner-up E vs Runner-up F
16. Runner-up G vs Runner-up H

**Special Rules**:
- 3rd place assignments depend on final group rankings
- FIFA assigns to balance bracket and avoid same-group rematches in R32

## Phase 3: Round of 16 (8 matches)

Winners from Round of 32 advance:

**Matches**:
1. W(Match 1) vs W(Match 2)
2. W(Match 3) vs W(Match 4)
3. W(Match 5) vs W(Match 6)
4. W(Match 7) vs W(Match 8)
5. W(Match 9) vs W(Match 10)
6. W(Match 11) vs W(Match 12)
7. W(Match 13) vs W(Match 14)
8. W(Match 15) vs W(Match 16)

## Phase 4: Quarter-finals (4 matches)

1. W(R16-1) vs W(R16-2)
2. W(R16-3) vs W(R16-4)
3. W(R16-5) vs W(R16-6)
4. W(R16-7) vs W(R16-8)

## Phase 5: Semi-finals (2 matches)

1. W(QF-1) vs W(QF-2)
2. W(QF-3) vs W(QF-4)

## Phase 6: Finals (2 matches)

1. **3rd Place Match**: L(SF-1) vs L(SF-2)
2. **Final**: W(SF-1) vs W(SF-2)

---

## Implementation Notes

### Placeholder Format
- Group winners: `"W_A"`, `"W_B"`, etc.
- Group runners-up: `"RU_A"`, `"RU_B"`, etc.
- Third place: `"3rd_RANKED_1"` through `"3rd_RANKED_8"`
- R32 onwards: `"W_R32_1"`, `"W_R16_1"`, etc.

### Resolution Logic
1. **After group stage completes**:
   - Calculate group standings
   - Rank all 12 third-place teams
   - Assign top 8 to R32 matches per FIFA bracket rules
   - Resolve all R32 placeholders

2. **After each knockout round**:
   - Resolve next round placeholders with actual teams
   - Update instance dataJson

### Match IDs
- Group: `m_A_1_1` (Group A, Round 1, Match 1)
- R32: `m_R32_1` through `m_R32_16`
- R16: `m_R16_1` through `m_R16_8`
- QF: `m_QF_1` through `m_QF_4`
- SF: `m_SF_1`, `m_SF_2`
- Finals: `m_3RD`, `m_FINAL`

---

## Data Structure

```typescript
{
  teams: [...], // 48 teams
  phases: [
    { id: "group_stage", name: "Fase de Grupos", ... },
    { id: "round_of_32", name: "Dieciseisavos de Final", ... },
    { id: "round_of_16", name: "Octavos de Final", ... },
    { id: "quarter_finals", name: "Cuartos de Final", ... },
    { id: "semi_finals", name: "Semifinales", ... },
    { id: "finals", name: "Final", ... }
  ],
  matches: [...], // All 104 matches
  advancementRules: {
    groupStage: {
      qualifiers: ["1st", "2nd", "best_8_thirds"],
      thirdPlaceRanking: ["points", "goalDiff", "goalsFor", "fairPlay"]
    }
  }
}
```
