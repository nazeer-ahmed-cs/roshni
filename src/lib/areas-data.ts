export const DISCO_BY_CITY: Record<string, string> = {
  Karachi: "K-Electric",
  Lahore: "LESCO",
  Sukkur: "SEPCO",
  Islamabad: "IESCO",
  Rawalpindi: "IESCO",
  Multan: "MEPCO",
  Faisalabad: "FESCO",
  Hyderabad: "HESCO",
  Peshawar: "PESCO",
  Quetta: "QESCO",
  Gujranwala: "GEPCO",
};

export function discoForCity(city: string): string {
  return DISCO_BY_CITY[city] ?? "Other";
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type AreaSeed = { city: string; area_name: string };

export const AREAS_SEED: AreaSeed[] = [
  // Karachi · K-Electric
  { city: "Karachi", area_name: "DHA Phase 6" },
  { city: "Karachi", area_name: "DHA Phase 2" },
  { city: "Karachi", area_name: "Gulshan-e-Iqbal" },
  { city: "Karachi", area_name: "Gulberg" },
  { city: "Karachi", area_name: "Clifton" },
  { city: "Karachi", area_name: "Saddar" },
  { city: "Karachi", area_name: "Nazimabad" },
  { city: "Karachi", area_name: "North Nazimabad" },
  { city: "Karachi", area_name: "Federal B Area" },
  { city: "Karachi", area_name: "Korangi" },
  { city: "Karachi", area_name: "Malir" },
  { city: "Karachi", area_name: "Shah Faisal Colony" },
  { city: "Karachi", area_name: "Lyari" },
  { city: "Karachi", area_name: "Jamshed Road" },

  // Lahore · LESCO
  { city: "Lahore", area_name: "Model Town" },
  { city: "Lahore", area_name: "Gulberg III" },
  { city: "Lahore", area_name: "Johar Town" },
  { city: "Lahore", area_name: "DHA Lahore" },
  { city: "Lahore", area_name: "Cantt Lahore" },
  { city: "Lahore", area_name: "Faisal Town" },
  { city: "Lahore", area_name: "Iqbal Town" },
  { city: "Lahore", area_name: "Samanabad" },
  { city: "Lahore", area_name: "Wapda Town" },
  { city: "Lahore", area_name: "Bahria Town Lahore" },
  { city: "Lahore", area_name: "Defence Lahore" },
  { city: "Lahore", area_name: "Township" },

  // Sukkur · SEPCO
  { city: "Sukkur", area_name: "Military Road" },
  { city: "Sukkur", area_name: "Barrage Colony" },
  { city: "Sukkur", area_name: "Minara Road" },
  { city: "Sukkur", area_name: "Shikarpur Road" },
  { city: "Sukkur", area_name: "New Sukkur" },
  { city: "Sukkur", area_name: "Al-Madinah Colony" },
  { city: "Sukkur", area_name: "Old Sukkur" },
  { city: "Sukkur", area_name: "Airport Road" },
  { city: "Sukkur", area_name: "Hussain Agahi" },
  { city: "Sukkur", area_name: "Lakhi Dar" },
  { city: "Sukkur", area_name: "Rohri" },
  { city: "Sukkur", area_name: "Kot Diji" },

  // Islamabad · IESCO
  { city: "Islamabad", area_name: "F-6" },
  { city: "Islamabad", area_name: "F-7" },
  { city: "Islamabad", area_name: "F-10" },
  { city: "Islamabad", area_name: "G-6" },
  { city: "Islamabad", area_name: "G-9" },
  { city: "Islamabad", area_name: "G-11" },
  { city: "Islamabad", area_name: "I-8" },
  { city: "Islamabad", area_name: "I-9" },
  { city: "Islamabad", area_name: "I-10" },
  { city: "Islamabad", area_name: "E-11" },
  { city: "Islamabad", area_name: "H-8" },

  // Multan · MEPCO
  { city: "Multan", area_name: "Gulgasht Colony" },
  { city: "Multan", area_name: "Shah Rukn-e-Alam Colony" },
  { city: "Multan", area_name: "Cantt Multan" },
  { city: "Multan", area_name: "New Multan" },
  { city: "Multan", area_name: "Mumtazabad" },
  { city: "Multan", area_name: "Wapda Town Multan" },
  { city: "Multan", area_name: "Bosan Road" },
  { city: "Multan", area_name: "Nishtar Town" },
  { city: "Multan", area_name: "Sher Shah Colony" },
  { city: "Multan", area_name: "Basti Malook" },
];

export const AREAS_SEED_WITH_DISCO: { city: string; disco: string; area_name: string }[] =
  AREAS_SEED.map((a) => ({ ...a, disco: discoForCity(a.city) }));
