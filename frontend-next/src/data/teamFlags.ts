// frontend/src/data/teamFlags.ts
// Sistema de mapeo de banderas reutilizable para torneos

export type TeamFlagData = {
  country: string;      // Display name (Spanish fallback for nations; locale-independent for clubs)
  code?: string;        // FIFA 3-letter code (nations only) — keys messages/{locale}/teams.json
  iso2: string;         // Código ISO2 para banderas
  flagUrl: string;      // URL del SVG desde flagcdn.com
};

export type TeamFlagMapping = {
  [teamCode: string]: TeamFlagData;
};

/**
 * Mapeo de banderas para FIFA World Cup 2026
 * Fuente: API-Football (api-sports.io) league=1, season=2026
 * Verificado: 2026-04-03 contra ESPN, FIFA.com, NBC Sports
 *
 * Formato: 12 grupos (A-L) de 4 equipos cada uno
 * Todos los 48 equipos confirmados (playoffs resueltos)
 */
export const WC2026_FLAGS: TeamFlagMapping = {
  // Grupo A
  "A1": { country: "México", code: "MEX", iso2: "mx", flagUrl: "https://flagcdn.com/w40/mx.png" },
  "A2": { country: "Corea del Sur", code: "KOR", iso2: "kr", flagUrl: "https://flagcdn.com/w40/kr.png" },
  "A3": { country: "Sudáfrica", code: "RSA", iso2: "za", flagUrl: "https://flagcdn.com/w40/za.png" },
  "A4": { country: "República Checa", code: "CZE", iso2: "cz", flagUrl: "https://flagcdn.com/w40/cz.png" },

  // Grupo B
  "B1": { country: "Canadá", code: "CAN", iso2: "ca", flagUrl: "https://flagcdn.com/w40/ca.png" },
  "B2": { country: "Qatar", code: "QAT", iso2: "qa", flagUrl: "https://flagcdn.com/w40/qa.png" },
  "B3": { country: "Suiza", code: "SUI", iso2: "ch", flagUrl: "https://flagcdn.com/w40/ch.png" },
  "B4": { country: "Bosnia y Herzegovina", code: "BIH", iso2: "ba", flagUrl: "https://flagcdn.com/w40/ba.png" },

  // Grupo C
  "C1": { country: "Brasil", code: "BRA", iso2: "br", flagUrl: "https://flagcdn.com/w40/br.png" },
  "C2": { country: "Haití", code: "HAI", iso2: "ht", flagUrl: "https://flagcdn.com/w40/ht.png" },
  "C3": { country: "Marruecos", code: "MAR", iso2: "ma", flagUrl: "https://flagcdn.com/w40/ma.png" },
  "C4": { country: "Escocia", code: "SCO", iso2: "gb-sct", flagUrl: "https://flagcdn.com/w40/gb-sct.png" },

  // Grupo D
  "D1": { country: "Estados Unidos", code: "USA", iso2: "us", flagUrl: "https://flagcdn.com/w40/us.png" },
  "D2": { country: "Australia", code: "AUS", iso2: "au", flagUrl: "https://flagcdn.com/w40/au.png" },
  "D3": { country: "Paraguay", code: "PAR", iso2: "py", flagUrl: "https://flagcdn.com/w40/py.png" },
  "D4": { country: "Turquía", code: "TUR", iso2: "tr", flagUrl: "https://flagcdn.com/w40/tr.png" },

  // Grupo E
  "E1": { country: "Alemania", code: "GER", iso2: "de", flagUrl: "https://flagcdn.com/w40/de.png" },
  "E2": { country: "Curazao", code: "CUW", iso2: "cw", flagUrl: "https://flagcdn.com/w40/cw.png" },
  "E3": { country: "Costa de Marfil", code: "CIV", iso2: "ci", flagUrl: "https://flagcdn.com/w40/ci.png" },
  "E4": { country: "Ecuador", code: "ECU", iso2: "ec", flagUrl: "https://flagcdn.com/w40/ec.png" },

  // Grupo F
  "F1": { country: "Países Bajos", code: "NED", iso2: "nl", flagUrl: "https://flagcdn.com/w40/nl.png" },
  "F2": { country: "Japón", code: "JPN", iso2: "jp", flagUrl: "https://flagcdn.com/w40/jp.png" },
  "F3": { country: "Túnez", code: "TUN", iso2: "tn", flagUrl: "https://flagcdn.com/w40/tn.png" },
  "F4": { country: "Suecia", code: "SWE", iso2: "se", flagUrl: "https://flagcdn.com/w40/se.png" },

  // Grupo G
  "G1": { country: "Bélgica", code: "BEL", iso2: "be", flagUrl: "https://flagcdn.com/w40/be.png" },
  "G2": { country: "Egipto", code: "EGY", iso2: "eg", flagUrl: "https://flagcdn.com/w40/eg.png" },
  "G3": { country: "Irán", code: "IRN", iso2: "ir", flagUrl: "https://flagcdn.com/w40/ir.png" },
  "G4": { country: "Nueva Zelanda", code: "NZL", iso2: "nz", flagUrl: "https://flagcdn.com/w40/nz.png" },

  // Grupo H
  "H1": { country: "España", code: "ESP", iso2: "es", flagUrl: "https://flagcdn.com/w40/es.png" },
  "H2": { country: "Cabo Verde", code: "CPV", iso2: "cv", flagUrl: "https://flagcdn.com/w40/cv.png" },
  "H3": { country: "Arabia Saudita", code: "KSA", iso2: "sa", flagUrl: "https://flagcdn.com/w40/sa.png" },
  "H4": { country: "Uruguay", code: "URU", iso2: "uy", flagUrl: "https://flagcdn.com/w40/uy.png" },

  // Grupo I
  "I1": { country: "Francia", code: "FRA", iso2: "fr", flagUrl: "https://flagcdn.com/w40/fr.png" },
  "I2": { country: "Senegal", code: "SEN", iso2: "sn", flagUrl: "https://flagcdn.com/w40/sn.png" },
  "I3": { country: "Noruega", code: "NOR", iso2: "no", flagUrl: "https://flagcdn.com/w40/no.png" },
  "I4": { country: "Irak", code: "IRQ", iso2: "iq", flagUrl: "https://flagcdn.com/w40/iq.png" },

  // Grupo J
  "J1": { country: "Argentina", code: "ARG", iso2: "ar", flagUrl: "https://flagcdn.com/w40/ar.png" },
  "J2": { country: "Argelia", code: "ALG", iso2: "dz", flagUrl: "https://flagcdn.com/w40/dz.png" },
  "J3": { country: "Austria", code: "AUT", iso2: "at", flagUrl: "https://flagcdn.com/w40/at.png" },
  "J4": { country: "Jordania", code: "JOR", iso2: "jo", flagUrl: "https://flagcdn.com/w40/jo.png" },

  // Grupo K
  "K1": { country: "Portugal", code: "POR", iso2: "pt", flagUrl: "https://flagcdn.com/w40/pt.png" },
  "K2": { country: "Uzbekistán", code: "UZB", iso2: "uz", flagUrl: "https://flagcdn.com/w40/uz.png" },
  "K3": { country: "Colombia", code: "COL", iso2: "co", flagUrl: "https://flagcdn.com/w40/co.png" },
  "K4": { country: "R.D. del Congo", code: "COD", iso2: "cd", flagUrl: "https://flagcdn.com/w40/cd.png" },

  // Grupo L
  "L1": { country: "Inglaterra", code: "ENG", iso2: "gb-eng", flagUrl: "https://flagcdn.com/w40/gb-eng.png" },
  "L2": { country: "Croacia", code: "CRO", iso2: "hr", flagUrl: "https://flagcdn.com/w40/hr.png" },
  "L3": { country: "Ghana", code: "GHA", iso2: "gh", flagUrl: "https://flagcdn.com/w40/gh.png" },
  "L4": { country: "Panamá", code: "PAN", iso2: "pa", flagUrl: "https://flagcdn.com/w40/pa.png" },
};

/**
 * Mapeo de escudos para UEFA Champions League 2025-26
 * Logos desde API-Football (api-sports.io)
 */
const CLUB_LOGO = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

export const UCL_2025_FLAGS: TeamFlagMapping = {
  // Dieciseisavos de Final
  "GAL": { country: "Galatasaray", iso2: "tr", flagUrl: CLUB_LOGO(645) },
  "JUV": { country: "Juventus", iso2: "it", flagUrl: CLUB_LOGO(496) },
  "MON": { country: "Monaco", iso2: "fr", flagUrl: CLUB_LOGO(91) },
  "PSG": { country: "Paris Saint-Germain", iso2: "fr", flagUrl: CLUB_LOGO(85) },
  "BVB": { country: "Borussia Dortmund", iso2: "de", flagUrl: CLUB_LOGO(165) },
  "ATA": { country: "Atalanta", iso2: "it", flagUrl: CLUB_LOGO(499) },
  "BEN": { country: "Benfica", iso2: "pt", flagUrl: CLUB_LOGO(211) },
  "RMA": { country: "Real Madrid", iso2: "es", flagUrl: CLUB_LOGO(541) },
  "QAR": { country: "Qarabağ", iso2: "az", flagUrl: CLUB_LOGO(556) },
  "NEW": { country: "Newcastle United", iso2: "gb-eng", flagUrl: CLUB_LOGO(34) },
  "BOD": { country: "Bodø/Glimt", iso2: "no", flagUrl: CLUB_LOGO(327) },
  "INT": { country: "Inter Milan", iso2: "it", flagUrl: CLUB_LOGO(505) },
  "OLY": { country: "Olympiacos", iso2: "gr", flagUrl: CLUB_LOGO(553) },
  "LEV": { country: "Bayer Leverkusen", iso2: "de", flagUrl: CLUB_LOGO(168) },
  "BRU": { country: "Club Brugge", iso2: "be", flagUrl: CLUB_LOGO(569) },
  "ATM": { country: "Atlético de Madrid", iso2: "es", flagUrl: CLUB_LOGO(530) },
  // Top 8 (seeded for R16)
  "ARS": { country: "Arsenal", iso2: "gb-eng", flagUrl: CLUB_LOGO(42) },
  "BAY": { country: "Bayern München", iso2: "de", flagUrl: CLUB_LOGO(157) },
  "LIV": { country: "Liverpool", iso2: "gb-eng", flagUrl: CLUB_LOGO(40) },
  "TOT": { country: "Tottenham Hotspur", iso2: "gb-eng", flagUrl: CLUB_LOGO(47) },
  "BAR": { country: "FC Barcelona", iso2: "es", flagUrl: CLUB_LOGO(529) },
  "CHE": { country: "Chelsea", iso2: "gb-eng", flagUrl: CLUB_LOGO(49) },
  "SPO": { country: "Sporting CP", iso2: "pt", flagUrl: CLUB_LOGO(228) },
  "MCI": { country: "Manchester City", iso2: "gb-eng", flagUrl: CLUB_LOGO(50) },
  // Placeholder
  "TBD": { country: "Por Definir", iso2: "xx", flagUrl: "" },
};

/**
 * Helper function para obtener datos de bandera/escudo de un equipo
 * @param teamCode Código del equipo (ej: "A1", "B2", "GAL", "RMA")
 * @param tournamentKey Clave del torneo (ej: "wc_2026_sandbox", "ucl-2025")
 * @returns Datos de la bandera/escudo o null si no existe
 */
export function getTeamFlag(teamCode: string, tournamentKey: string): TeamFlagData | null {
  if (tournamentKey === "wc_2026_sandbox") {
    return WC2026_FLAGS[teamCode] || null;
  }
  if (tournamentKey === "ucl-2025") {
    return UCL_2025_FLAGS[teamCode] || null;
  }
  return null;
}

/**
 * Helper para obtener el nombre del país desde un teamId
 * TeamId tiene formato: t_A1, t_B2, etc.
 * @param teamId ID del equipo en el formato del template
 * @param tournamentKey Clave del torneo
 * @returns Nombre del país o el teamId original si no se encuentra
 */
export function getCountryName(teamId: string, tournamentKey: string): string {
  // Extraer código: "t_A1" → "A1"
  const code = teamId.replace("t_", "");
  const flag = getTeamFlag(code, tournamentKey);
  return flag?.country || teamId;
}
